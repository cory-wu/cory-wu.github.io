import type { PerspectiveCamera } from 'three';
import { MathUtils, Spherical, Vector3 } from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CAMERA, fitDistance } from './camera-fit';

export interface GardenControls {
  controls: OrbitControls;
  resetView(aspect: number): void;
  /**
   * Re-frames after a viewport aspect change: moves to the new fit distance
   * if the camera is closer than it or the user has not zoomed since the last
   * fit; keeps azimuth and polar angle.
   */
  refit(aspect: number): void;
  update(): void;
  dispose(): void;
}

export interface ControlsOptions {
  reducedMotion: boolean;
  onChange: () => void;
}

const DAMPING_FACTOR = 0.08;
const AZIMUTH_STEP = MathUtils.degToRad(15);
const POLAR_STEP = MathUtils.degToRad(8);
/** Radius change below which the camera still counts as sitting at its last fit. */
const FIT_TOLERANCE = 1e-3;

const KEY_DELTAS: Readonly<Record<string, readonly [azimuth: number, polar: number]>> = {
  ArrowLeft: [AZIMUTH_STEP, 0],
  ArrowRight: [-AZIMUTH_STEP, 0],
  ArrowUp: [0, -POLAR_STEP],
  ArrowDown: [0, POLAR_STEP],
};

function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) ||
    target.isContentEditable ||
    target.getAttribute('contenteditable') === '' ||
    target.getAttribute('contenteditable') === 'true'
  );
}

export function createControls(
  camera: PerspectiveCamera,
  dom: HTMLElement,
  opts: ControlsOptions,
): GardenControls {
  const controls = new OrbitControls(camera, dom);
  controls.enablePan = false;
  controls.enableDamping = !opts.reducedMotion;
  controls.dampingFactor = DAMPING_FACTOR;
  controls.minDistance = CAMERA.minDistance;
  controls.maxDistance = CAMERA.maxDistance;
  controls.minPolarAngle = CAMERA.minPolar;
  controls.maxPolarAngle = CAMERA.maxPolar;
  controls.target.set(0, 0, 0);
  controls.addEventListener('change', opts.onChange);

  let lastFit: number | null = null;

  function place(radius: number, polar: number, azimuth: number): void {
    const p = MathUtils.clamp(polar, CAMERA.minPolar, CAMERA.maxPolar);
    const r = MathUtils.clamp(radius, CAMERA.minDistance, CAMERA.maxDistance);
    camera.position.setFromSpherical(new Spherical(r, p, azimuth)).add(controls.target);
    camera.lookAt(controls.target);
    controls.update();
  }

  const current = () => new Spherical().setFromVector3(new Vector3().subVectors(camera.position, controls.target));
  const safeFit = (aspect: number) => fitDistance(Number.isFinite(aspect) && aspect > 0 ? aspect : 1);

  function resetView(aspect: number): void {
    lastFit = safeFit(aspect);
    place(lastFit, CAMERA.polar, CAMERA.azimuth);
  }

  function refit(aspect: number): void {
    const fit = safeFit(aspect);
    const s = current();
    const untouched = lastFit !== null && Math.abs(s.radius - lastFit) < FIT_TOLERANCE;
    if (!untouched && s.radius >= fit) return;
    lastFit = fit;
    place(fit, s.phi, s.theta);
  }

  function onKeyDown(event: KeyboardEvent): void {
    const delta = KEY_DELTAS[event.key];
    if (!delta) return;
    if (event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) return;
    if (isEditable(event.target)) return;
    event.preventDefault();
    const s = current();
    place(s.radius, s.phi + delta[1], s.theta + delta[0]);
  }
  window.addEventListener('keydown', onKeyDown);

  return {
    controls,
    resetView,
    refit,
    update: () => {
      controls.update();
    },
    dispose: () => {
      window.removeEventListener('keydown', onKeyDown);
      controls.removeEventListener('change', opts.onChange);
      controls.dispose();
    },
  };
}
