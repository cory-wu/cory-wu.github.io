import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BoxGeometry, Group, Mesh, MeshStandardMaterial, PerspectiveCamera } from 'three';
import type { Camera, Object3D } from 'three';
import { createInteraction, HIGHLIGHT, projectLabel, setHighlight } from '../../src/garden/interaction';
import { libraryShed } from '../../src/garden/landmarks/library-shed';
import type { LandmarkBuild } from '../../src/garden/landmarks/types';

function materialsOf(object: Object3D): MeshStandardMaterial[] {
  const out: MeshStandardMaterial[] = [];
  object.traverse((n) => {
    if (n instanceof Mesh) out.push(...(Array.isArray(n.material) ? n.material : [n.material]));
  });
  return out;
}

describe('setHighlight', () => {
  it('lights non-night-light materials and leaves night lights alone', async () => {
    const build = await libraryShed.build();
    const night = build.nightLights![0];
    night.emissiveIntensity = 1;
    const others = materialsOf(build.object).filter((m) => m !== night);

    setHighlight(build, true);
    for (const m of others) {
      expect(m.emissive.getHexString()).toBe('ffffff');
      expect(m.emissiveIntensity).toBe(HIGHLIGHT.intensity);
    }
    expect(night.emissiveIntensity).toBe(1);

    setHighlight(build, false);
    for (const m of others) {
      expect(m.emissive.getHexString()).toBe('000000');
      expect(m.emissiveIntensity).toBe(0);
    }
    expect(night.emissiveIntensity).toBe(1);
  });

  it('handles material arrays and skips non-standard materials', () => {
    const a = new MeshStandardMaterial();
    const b = new MeshStandardMaterial();
    const group = new Group().add(new Mesh(new BoxGeometry(), [a, b]));
    setHighlight({ object: group, nightLights: [b] }, true);
    expect(a.emissiveIntensity).toBe(HIGHLIGHT.intensity);
    expect(b.emissiveIntensity).toBe(1); // night light untouched (default intensity)
  });
});

function lookDownCamera(): PerspectiveCamera {
  const cam = new PerspectiveCamera(30, 800 / 600, 0.1, 100);
  cam.position.set(0, 10, 10);
  cam.lookAt(0, 0, 0);
  cam.updateMatrixWorld();
  return cam;
}

describe('projectLabel', () => {
  const box = () => new Mesh(new BoxGeometry(1, 1, 1));

  it('projects the box top to the screen centre column', () => {
    const p = projectLabel(box(), lookDownCamera(), 800, 600);
    expect(p.visible).toBe(true);
    expect(p.x).toBeCloseTo(400, 3);
  });

  it('is not visible behind the camera', () => {
    const b = box();
    b.position.set(0, 10, 20);
    expect(projectLabel(b, lookDownCamera(), 800, 600).visible).toBe(false);
  });
});

function fire(
  el: HTMLElement,
  type: string,
  x: number,
  y: number,
  pointerType = 'mouse',
): void {
  const e = new MouseEvent(type, { clientX: x, clientY: y, button: 0, bubbles: true });
  Object.defineProperty(e, 'pointerType', { value: pointerType });
  el.dispatchEvent(e);
}

describe('createInteraction', () => {
  let dom: HTMLElement;
  let label: HTMLElement;
  let camera: Camera;
  let build: LandmarkBuild;
  let navigate: ReturnType<typeof vi.fn<(href: string) => void>>;
  let requestRender: ReturnType<typeof vi.fn<() => void>>;
  let hit: { x: number; y: number };
  let wall: MeshStandardMaterial;
  let api: ReturnType<typeof createInteraction>;

  beforeEach(async () => {
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', () => {});
    dom = document.createElement('div');
    dom.getBoundingClientRect = () => new DOMRect(0, 0, 800, 600);
    label = document.createElement('div');
    label.hidden = true;
    camera = lookDownCamera();
    build = await libraryShed.build();
    build.object.updateMatrixWorld(true);
    const projected = projectLabel(build.object, camera, 800, 600);
    // Aim a little below the roof top, at the shed body.
    hit = { x: projected.x, y: projected.y + 60 };
    navigate = vi.fn();
    requestRender = vi.fn();
    wall = materialsOf(build.object).find((m) => m !== build.nightLights![0])!;
    api = createInteraction({
      dom,
      camera,
      landmarks: [{ placement: { landmark: libraryShed, position: [0, 0], rotationY: 0 }, build }],
      label,
      navigate,
      requestRender,
    });
  });

  afterEach(() => {
    api.dispose();
    vi.unstubAllGlobals();
  });

  it('navigates on a mouse click on the shed', () => {
    fire(dom, 'pointerdown', hit.x, hit.y);
    fire(dom, 'pointerup', hit.x, hit.y);
    expect(navigate).toHaveBeenCalledWith('/writing/');
  });

  it('does not navigate when the pointer moved 20px', () => {
    fire(dom, 'pointerdown', hit.x, hit.y);
    fire(dom, 'pointerup', hit.x + 20, hit.y);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('does not navigate when clicking empty space', () => {
    fire(dom, 'pointerdown', 5, 5);
    fire(dom, 'pointerup', 5, 5);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('hover highlights, shows the label and sets the cursor; leave clears all', () => {
    fire(dom, 'pointermove', hit.x, hit.y);
    expect(dom.style.cursor).toBe('pointer');
    expect(label.hidden).toBe(false);
    expect(label.textContent).toBe(libraryShed.label);
    expect(wall.emissiveIntensity).toBe(HIGHLIGHT.intensity);

    fire(dom, 'pointerleave', hit.x, hit.y);
    expect(label.hidden).toBe(true);
    expect(wall.emissiveIntensity).toBe(0);
    expect(dom.style.cursor).toBe('');
  });

  it('touch: first tap shows the label, second navigates', () => {
    fire(dom, 'pointerdown', hit.x, hit.y, 'touch');
    fire(dom, 'pointerup', hit.x, hit.y, 'touch');
    fire(dom, 'pointerleave', hit.x, hit.y, 'touch');
    expect(label.hidden).toBe(false);
    expect(navigate).not.toHaveBeenCalled();

    fire(dom, 'pointerdown', hit.x, hit.y, 'touch');
    fire(dom, 'pointerup', hit.x, hit.y, 'touch');
    expect(navigate).toHaveBeenCalledWith('/writing/');
  });

  it('touch: tapping empty space dismisses the label', () => {
    fire(dom, 'pointerdown', hit.x, hit.y, 'touch');
    fire(dom, 'pointerup', hit.x, hit.y, 'touch');
    fire(dom, 'pointerdown', 5, 5, 'touch');
    fire(dom, 'pointerup', 5, 5, 'touch');
    expect(label.hidden).toBe(true);
  });

  it('highlight(id) serves keyboard focus; null and unknown ids clear it', () => {
    api.highlight('library-shed');
    expect(label.hidden).toBe(false);
    expect(wall.emissiveIntensity).toBe(HIGHLIGHT.intensity);
    expect(requestRender).toHaveBeenCalled();
    expect(label.style.transform).toContain('translate(');

    api.highlight('nope');
    expect(label.hidden).toBe(true);
    expect(wall.emissiveIntensity).toBe(0);
  });

  it('updateLabel is a no-op while hidden', () => {
    api.updateLabel();
    expect(label.style.transform).toBe('');
  });

  it('dispose removes listeners', () => {
    api.dispose();
    fire(dom, 'pointerdown', hit.x, hit.y);
    fire(dom, 'pointerup', hit.x, hit.y);
    expect(navigate).not.toHaveBeenCalled();
  });
});
