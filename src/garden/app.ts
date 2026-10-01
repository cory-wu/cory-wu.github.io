import { Box3, Vector3 } from 'three';
import type { Camera, Object3D, WebGLRenderer } from 'three';
import { createAmbient } from './ambient';
import { detectEnv, selectMode, showFallback } from './boot';
import type { Mode } from './boot';
import { createControls } from './controls';
import { buildDiorama } from './diorama';
import { createInteraction } from './interaction';
import type { Interaction } from './interaction';
import { loadLandmarks, placements, validatePlacements } from './landmarks/registry';
import { buildNav } from './nav';
import { createSky } from './sky';
import { sampleSky } from './sky-keyframes';
import { createStage } from './stage';
import { currentMinutes, parseTimeParam } from './time';

export interface GardenDeps {
  /** Test seam: build the renderer (a throw here exercises the fallback path). */
  createRenderer?: () => WebGLRenderer;
}

/** E2E hook on `window.__garden`; exposed only in dev or with `?e2e` in the URL. */
export interface GardenTestHook {
  /** Viewport CSS-pixel position of the landmark's projected centre, or null if unknown. */
  landmarkScreenPosition(id: string): { x: number; y: number } | null;
}

declare global {
  interface Window {
    __garden?: GardenTestHook;
  }
}

type SceneMode = Exclude<Mode, 'fallback'>;

/** True when the query string carries an `e2e` parameter (`?e2e`, `?e2e=1`, `?time=12:00&e2e`). */
export function hasE2eFlag(search: string): boolean {
  return new URLSearchParams(search).has('e2e');
}

function testHookEnabled(win: Window): boolean {
  return import.meta.env.DEV || hasE2eFlag(win.location.search);
}

/** Viewport CSS-pixel position of the centre of `object`'s bounding box. */
function projectCenter(object: Object3D, camera: Camera, canvas: HTMLElement): { x: number; y: number } {
  camera.updateMatrixWorld();
  const ndc = new Box3().setFromObject(object).getCenter(new Vector3()).project(camera);
  const rect = canvas.getBoundingClientRect();
  return {
    x: rect.left + ((ndc.x + 1) / 2) * rect.width,
    y: rect.top + ((1 - ndc.y) / 2) * rect.height,
  };
}

const MINUTE_MS = 60_000;
const READY_CLASS = 'is-ready';

function requireElement(doc: Document, id: string): HTMLElement {
  const el = doc.getElementById(id);
  if (!el) throw new Error(`garden: #${id} is missing from the page`);
  return el;
}

/**
 * Builds the three.js scene into #garden and starts rendering.
 * Throws if any step of setup fails; the caller shows the fallback.
 */
async function mountScene(
  win: Window,
  mode: SceneMode,
  deps: GardenDeps,
  setInteraction: (next: Interaction | null) => void,
): Promise<void> {
  const doc = win.document;
  const host = requireElement(doc, 'garden');
  const label = requireElement(doc, 'landmark-label');
  const resetButton = requireElement(doc, 'reset-view');
  const reduced = mode === 'reduced';

  const stage = createStage(host, {
    onDemand: reduced,
    renderer: deps.createRenderer?.(),
    // Frames only run after stage.start(), by which point failToFallback exists.
    onError: (err) => {
      console.error('garden: rendering failed, showing the static fallback', err);
      failToFallback();
    },
  });
  // Runs last: releases the renderer, ResizeObserver and visibility listener.
  const cleanup: Array<() => void> = [() => stage.dispose()];
  let mounted = true;
  const teardown = () => {
    mounted = false;
    setInteraction(null);
    for (const fn of cleanup.splice(0).reverse()) fn();
  };
  const failToFallback = () => {
    teardown();
    showFallback(doc);
  };

  try {
    const canvas = stage.renderer.domElement;
    const controls = createControls(stage.camera, canvas, {
      reducedMotion: reduced,
      onChange: () => {
        if (reduced) stage.requestRender();
      },
    });
    cleanup.push(() => controls.dispose());
    controls.resetView(stage.camera.aspect);

    const diorama = buildDiorama();
    for (const message of validatePlacements(placements)) console.error(`garden: ${message}`);
    const landmarks = await loadLandmarks(placements);
    stage.scene.add(diorama.group, ...landmarks.map((l) => l.build.object));

    const sky = createSky(stage.scene, {
      nightLights: landmarks.flatMap((l) => l.build.nightLights ?? []),
      lanterns: diorama.lanterns,
      fountainLight: diorama.fountainLight,
    });
    const ambient = createAmbient(stage.scene, diorama, { reducedMotion: reduced });
    const interaction = createInteraction({
      dom: canvas,
      camera: stage.camera,
      landmarks,
      label,
      navigate: (href) => win.location.assign(href),
      requestRender: stage.requestRender,
    });
    cleanup.push(() => interaction.dispose());
    cleanup.push(() => {
      label.hidden = true;
    });
    setInteraction(interaction);

    if (testHookEnabled(win)) {
      win.__garden = {
        landmarkScreenPosition: (id) => {
          const entry = landmarks.find((l) => l.placement.landmark.id === id);
          return entry ? projectCenter(entry.build.object, stage.camera, canvas) : null;
        },
      };
      cleanup.push(() => {
        delete win.__garden;
      });
    }

    const override = parseTimeParam(win.location.search);
    let nightFactor = 0;
    const applyTime = () => {
      const minutes = override ?? currentMinutes(new Date());
      sky.apply(minutes);
      nightFactor = sampleSky(minutes).nightFactor;
      if (reduced) stage.requestRender();
    };
    applyTime();
    if (mode === 'live' && override === null) {
      const timer = win.setInterval(applyTime, MINUTE_MS);
      cleanup.push(() => win.clearInterval(timer));
    }

    let firstFrame = true;
    stage.onFrame((_dt, elapsed) => {
      controls.update();
      ambient.update(elapsed, nightFactor);
      interaction.updateLabel();
      if (firstFrame) {
        firstFrame = false;
        // Runs after this frame's renderer.render() call returns; skipped if that render threw.
        queueMicrotask(() => {
          if (mounted) host.classList.add(READY_CLASS);
        });
      }
    });

    const onReset = () => {
      controls.resetView(stage.camera.aspect);
      stage.requestRender();
    };
    resetButton.addEventListener('click', onReset);
    cleanup.push(() => resetButton.removeEventListener('click', onReset));

    canvas.addEventListener('webglcontextlost', failToFallback, { once: true });
    cleanup.push(() => canvas.removeEventListener('webglcontextlost', failToFallback));

    // The first render (on-demand or continuous) happens here, with every object in the scene.
    stage.start();
  } catch (err) {
    teardown();
    throw err;
  }
}

/** Builds the nav, picks a mode, and mounts the scene or the static fallback. */
export async function startGarden(win: Window, deps: GardenDeps = {}): Promise<{ mode: Mode }> {
  const doc = win.document;
  let interaction: Interaction | null = null;

  const list = doc.getElementById('site-nav-list') as HTMLUListElement | null;
  if (list) {
    buildNav(list, placements, {
      onFocus: (id) => interaction?.highlight(id),
      onBlur: () => interaction?.highlight(null),
    });
  }

  const mode = selectMode(detectEnv(win));
  if (mode === 'fallback') {
    showFallback(doc);
    return { mode };
  }

  try {
    await mountScene(win, mode, deps, (next) => {
      interaction = next;
    });
    return { mode };
  } catch (err) {
    console.error('garden: scene setup failed, showing the static fallback', err);
    showFallback(doc);
    return { mode: 'fallback' };
  }
}
