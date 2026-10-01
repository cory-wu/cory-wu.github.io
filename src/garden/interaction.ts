import { Box3, Mesh, MeshStandardMaterial, Raycaster, Vector2, Vector3 } from 'three';
import type { Camera, Material, Object3D } from 'three';
import { isClick, reduceTap } from './pointer-intent';
import type { TapState } from './pointer-intent';
import type { LandmarkBuild, Placement } from './landmarks/types';

export const HIGHLIGHT = { color: '#ffffff', intensity: 0.25 } as const;

const REST_EMISSIVE = '#000000';

type LoadedLandmark = { placement: Placement; build: LandmarkBuild };

export interface Interaction {
  highlight(id: string | null): void;
  updateLabel(): void;
  dispose(): void;
}

export interface InteractionOptions {
  dom: HTMLElement;
  camera: Camera;
  landmarks: LoadedLandmark[];
  label: HTMLElement;
  navigate: (href: string) => void;
  requestRender: () => void;
}

/** Turn the emissive hover highlight on or off. Night-light materials are never touched. */
export function setHighlight(build: LandmarkBuild, on: boolean): void {
  const skip = new Set<Material>(build.nightLights ?? []);
  build.object.traverse((node) => {
    if (!(node instanceof Mesh)) return;
    const materials: Material[] = Array.isArray(node.material) ? node.material : [node.material];
    for (const mat of materials) {
      if (!(mat instanceof MeshStandardMaterial) || skip.has(mat)) continue;
      mat.emissive.set(on ? HIGHLIGHT.color : REST_EMISSIVE);
      mat.emissiveIntensity = on ? HIGHLIGHT.intensity : 0;
    }
  });
}

/** Screen position (px) of the top-centre of the object's bounding box. */
export function projectLabel(
  object: Object3D,
  camera: Camera,
  width: number,
  height: number,
): { x: number; y: number; visible: boolean } {
  camera.updateMatrixWorld();
  const box = new Box3().setFromObject(object);
  const top = new Vector3((box.min.x + box.max.x) / 2, box.max.y, (box.min.z + box.max.z) / 2);
  const viewZ = top.clone().applyMatrix4(camera.matrixWorldInverse).z;
  const ndc = top.project(camera);
  return {
    x: ((ndc.x + 1) / 2) * width,
    y: ((1 - ndc.y) / 2) * height,
    visible: viewZ < 0,
  };
}

export function createInteraction(opts: InteractionOptions): Interaction {
  const { dom, camera, landmarks, label, navigate, requestRender } = opts;
  const win = dom.ownerDocument.defaultView ?? window;
  const raycaster = new Raycaster();
  const ndc = new Vector2();

  let activeId: string | null = null;
  let tapState: TapState = { shownId: null };
  let downPoint: { x: number; y: number } | null = null;
  let pendingMove: { x: number; y: number } | null = null;
  let rafId: number | null = null;

  const find = (id: string | null) =>
    id === null ? undefined : landmarks.find((l) => l.placement.landmark.id === id);

  function hitTest(clientX: number, clientY: number): string | null {
    const rect = dom.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    camera.updateMatrixWorld();
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(
      landmarks.map((l) => l.build.object),
      true,
    );
    if (hits.length === 0) return null;
    const first = hits[0].object;
    const owner = landmarks.find((l) => {
      for (let n: Object3D | null = first; n; n = n.parent) if (n === l.build.object) return true;
      return false;
    });
    return owner ? owner.placement.landmark.id : null;
  }

  function updateLabel(): void {
    if (label.hidden || activeId === null) return;
    const entry = find(activeId);
    if (!entry) return;
    const p = projectLabel(entry.build.object, camera, dom.clientWidth, dom.clientHeight);
    label.style.visibility = p.visible ? '' : 'hidden';
    label.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -100%)`;
  }

  function highlight(id: string | null): void {
    const next = find(id);
    const prev = find(activeId);
    if (prev && prev !== next) setHighlight(prev.build, false);
    if (next) {
      setHighlight(next.build, true);
      activeId = next.placement.landmark.id;
      label.textContent = next.placement.landmark.label;
      label.hidden = false;
      updateLabel();
    } else {
      activeId = null;
      label.hidden = true;
    }
    requestRender();
  }

  const setCursor = (hit: boolean) => {
    dom.style.cursor = hit ? 'pointer' : '';
  };

  function runHover(): void {
    rafId = null;
    const p = pendingMove;
    pendingMove = null;
    if (!p) return;
    const id = hitTest(p.x, p.y);
    setCursor(id !== null);
    if (id !== activeId) highlight(id);
  }

  function onPointerMove(e: PointerEvent): void {
    if (e.pointerType === 'touch') return;
    pendingMove = { x: e.clientX, y: e.clientY };
    if (rafId === null) rafId = win.requestAnimationFrame(runHover);
  }

  function onPointerDown(e: PointerEvent): void {
    downPoint = { x: e.clientX, y: e.clientY };
  }

  function onPointerUp(e: PointerEvent): void {
    const down = downPoint;
    downPoint = null;
    const up = { x: e.clientX, y: e.clientY };
    if (!down || !isClick(down, up)) return;
    const hitId = hitTest(up.x, up.y);
    if (e.pointerType === 'touch') {
      const { state, action } = reduceTap(tapState, hitId);
      tapState = state;
      if (action.kind === 'show') highlight(action.id);
      else if (action.kind === 'dismiss') highlight(null);
      else if (action.kind === 'navigate') {
        const entry = find(action.id);
        if (entry) navigate(entry.placement.landmark.href);
      }
      return;
    }
    if (e.button !== 0) return;
    const entry = find(hitId);
    if (entry) navigate(entry.placement.landmark.href);
  }

  function onPointerLeave(e: PointerEvent): void {
    // Touch pointers "leave" right after lifting; that must not dismiss a tapped label.
    if (e.pointerType === 'touch') return;
    pendingMove = null;
    setCursor(false);
    highlight(null);
  }

  function onPointerCancel(): void {
    downPoint = null;
  }

  dom.addEventListener('pointermove', onPointerMove);
  dom.addEventListener('pointerdown', onPointerDown);
  dom.addEventListener('pointerup', onPointerUp);
  dom.addEventListener('pointerleave', onPointerLeave);
  dom.addEventListener('pointercancel', onPointerCancel);

  function dispose(): void {
    dom.removeEventListener('pointermove', onPointerMove);
    dom.removeEventListener('pointerdown', onPointerDown);
    dom.removeEventListener('pointerup', onPointerUp);
    dom.removeEventListener('pointerleave', onPointerLeave);
    dom.removeEventListener('pointercancel', onPointerCancel);
    if (rafId !== null) win.cancelAnimationFrame(rafId);
    rafId = null;
    pendingMove = null;
  }

  return { highlight, updateLabel, dispose };
}
