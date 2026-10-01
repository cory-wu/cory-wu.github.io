import { PCFShadowMap, PerspectiveCamera, Scene, SRGBColorSpace, WebGLRenderer } from 'three';
import { CAMERA } from './camera-fit';

export type FrameCallback = (dt: number, elapsed: number) => void;

export interface Stage {
  scene: Scene;
  camera: PerspectiveCamera;
  renderer: WebGLRenderer;
  requestRender(): void;
  onFrame(cb: FrameCallback): void;
  resize(width: number, height: number): void;
  start(): void;
  stop(): void;
  dispose(): void;
}

export interface StageOptions {
  /** Test seam: inject a stub renderer instead of constructing a WebGLRenderer. */
  renderer?: WebGLRenderer;
  /** true: render only after requestRender(); false: continuous rAF loop. */
  onDemand: boolean;
  /** Test seam: clock in milliseconds. Defaults to performance.now. */
  now?: () => number;
  /** Called once if a frame callback or render throws; the loop has already stopped. */
  onError?: (err: unknown) => void;
}

const MAX_PIXEL_RATIO = 2;
const MS_PER_SECOND = 1000;

export function createStage(host: HTMLElement, opts: StageOptions): Stage {
  const now = opts.now ?? (() => performance.now());
  const renderer = opts.renderer ?? new WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;
  renderer.outputColorSpace = SRGBColorSpace;
  host.appendChild(renderer.domElement);

  const scene = new Scene();
  const camera = new PerspectiveCamera(CAMERA.fov, 1, 0.1, 200);
  camera.lookAt(0, 0, 0);

  const frameCallbacks: FrameCallback[] = [];
  let frameId: number | null = null;
  let wantsRunning = false;
  let renderPending = false;
  let lastTime = now();
  let elapsed = 0;
  let disposed = false;
  let failed = false;

  function renderFrame(): void {
    const t = now();
    const dt = Math.max(0, (t - lastTime) / MS_PER_SECOND);
    lastTime = t;
    elapsed += dt;
    for (const cb of frameCallbacks) cb(dt, elapsed);
    renderer.render(scene, camera);
  }

  function fail(err: unknown): void {
    failed = true;
    stop();
    if (opts.onError) opts.onError(err);
    else throw err;
  }

  function schedule(): void {
    if (frameId !== null || disposed || failed || document.hidden) return;
    frameId = requestAnimationFrame(onAnimationFrame);
  }

  function onAnimationFrame(): void {
    frameId = null;
    if (disposed || document.hidden) return;
    const shouldRender = !opts.onDemand || renderPending;
    renderPending = false;
    if (shouldRender) {
      try {
        renderFrame();
      } catch (err) {
        fail(err);
        return;
      }
    }
    if (!opts.onDemand && wantsRunning) schedule();
  }

  function cancelFrame(): void {
    if (frameId !== null) cancelAnimationFrame(frameId);
    frameId = null;
  }

  function requestRender(): void {
    if (disposed) return;
    renderPending = true;
    schedule();
  }

  function begin(): void {
    lastTime = now();
    if (opts.onDemand) requestRender();
    else schedule();
  }

  function start(): void {
    if (wantsRunning || disposed || failed) return;
    wantsRunning = true;
    begin();
  }

  function stop(): void {
    wantsRunning = false;
    cancelFrame();
  }

  function resize(width: number, height: number): void {
    if (width <= 0 || height <= 0) return;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    if (opts.onDemand) requestRender();
  }

  function onVisibility(): void {
    if (document.hidden) {
      cancelFrame();
    } else if (wantsRunning) {
      begin();
    } else if (renderPending) {
      schedule();
    }
  }
  document.addEventListener('visibilitychange', onVisibility);

  const observer = new ResizeObserver((entries) => {
    const rect = entries[entries.length - 1]?.contentRect;
    if (rect) resize(rect.width, rect.height);
  });
  observer.observe(host);
  resize(host.clientWidth, host.clientHeight);

  function dispose(): void {
    if (disposed) return;
    stop();
    disposed = true;
    document.removeEventListener('visibilitychange', onVisibility);
    observer.disconnect();
    frameCallbacks.length = 0;
    renderer.domElement.remove();
    renderer.dispose();
  }

  return {
    scene,
    camera,
    renderer,
    requestRender,
    onFrame: (cb) => {
      frameCallbacks.push(cb);
    },
    resize,
    start,
    stop,
    dispose,
  };
}
