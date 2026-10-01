import { afterEach, describe, expect, it, vi } from 'vitest';
import { PerspectiveCamera, Spherical, Vector3 } from 'three';
import { CAMERA, fitDistance } from '../../src/garden/camera-fit';
import { createControls, type GardenControls } from '../../src/garden/controls';

const made: GardenControls[] = [];

function setup(reducedMotion = false) {
  const camera = new PerspectiveCamera(CAMERA.fov, 1, 0.1, 200);
  const dom = document.createElement('div');
  const onChange = vi.fn();
  const gc = createControls(camera, dom, { reducedMotion, onChange });
  made.push(gc);
  gc.resetView(16 / 9);
  onChange.mockClear();
  return { camera, gc, onChange };
}

function spherical(camera: PerspectiveCamera): Spherical {
  return new Spherical().setFromVector3(camera.position.clone().sub(new Vector3()));
}

function press(key: string, init: KeyboardEventInit = {}, target: EventTarget = window): void {
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }));
}

afterEach(() => {
  while (made.length) made.pop()?.dispose();
});

describe('createControls settings', () => {
  it('configures limits from CAMERA and disables pan', () => {
    const { gc } = setup();
    expect(gc.controls.enablePan).toBe(false);
    expect(gc.controls.minDistance).toBe(CAMERA.minDistance);
    expect(gc.controls.maxDistance).toBe(CAMERA.maxDistance);
    expect(gc.controls.maxPolarAngle).toBe(CAMERA.maxPolar);
    expect(gc.controls.minPolarAngle).toBe(CAMERA.minPolar);
    expect(gc.controls.dampingFactor).toBe(0.08);
    expect(gc.controls.target.length()).toBe(0);
  });
  it('enables damping unless reduced motion is requested', () => {
    expect(setup(false).gc.controls.enableDamping).toBe(true);
    expect(setup(true).gc.controls.enableDamping).toBe(false);
  });
});

describe('resetView', () => {
  it('places the camera at the base distance on wide screens', () => {
    const { camera, gc } = setup();
    gc.resetView(16 / 9);
    expect(Math.abs(camera.position.length() - 34)).toBeLessThan(1e-6);
    const s = spherical(camera);
    expect(s.phi).toBeCloseTo(CAMERA.polar, 6);
    expect(s.theta).toBeCloseTo(CAMERA.azimuth, 6);
  });
  it('uses fitDistance on tall screens', () => {
    const { camera, gc } = setup();
    gc.resetView(0.46);
    expect(camera.position.length()).toBeCloseTo(fitDistance(0.46), 9);
  });
  it('treats non-finite or non-positive aspect as 1', () => {
    for (const bad of [0, -2, NaN, Infinity]) {
      const { camera, gc } = setup();
      gc.resetView(bad);
      expect(camera.position.length()).toBeCloseTo(fitDistance(1), 9);
    }
  });
});

describe('arrow keys', () => {
  it('never tilts past the minimum polar angle', () => {
    const { camera } = setup();
    for (let i = 0; i < 20; i++) {
      press('ArrowUp');
      expect(spherical(camera).phi).toBeGreaterThanOrEqual(CAMERA.minPolar - 1e-9);
    }
  });
  it('never tilts past the maximum polar angle', () => {
    const { camera } = setup();
    for (let i = 0; i < 20; i++) press('ArrowDown');
    expect(spherical(camera).phi).toBeLessThanOrEqual(CAMERA.maxPolar + 1e-9);
  });
  it('rotates azimuth by 15 degrees and notifies', () => {
    const { camera, onChange } = setup();
    const before = spherical(camera).theta;
    press('ArrowLeft');
    const delta = Math.abs(spherical(camera).theta - before);
    expect(Math.abs(delta - (15 * Math.PI) / 180)).toBeLessThan(1e-6);
    expect(onChange).toHaveBeenCalled();
  });
  it('rotates the opposite way for ArrowRight', () => {
    const { camera } = setup();
    const before = spherical(camera).theta;
    press('ArrowLeft');
    press('ArrowRight');
    expect(spherical(camera).theta).toBeCloseTo(before, 6);
  });
  it('ignores events targeting form fields', () => {
    const { camera, onChange } = setup();
    const before = camera.position.clone();
    const input = document.createElement('input');
    document.body.appendChild(input);
    press('ArrowLeft', {}, input);
    input.remove();
    expect(camera.position.distanceTo(before)).toBe(0);
    expect(onChange).not.toHaveBeenCalled();
  });
  it('ignores events with modifier keys', () => {
    const { camera, onChange } = setup();
    const before = camera.position.clone();
    for (const mod of ['shiftKey', 'ctrlKey', 'altKey', 'metaKey']) press('ArrowLeft', { [mod]: true });
    expect(camera.position.distanceTo(before)).toBe(0);
    expect(onChange).not.toHaveBeenCalled();
  });
  it('stops listening after dispose', () => {
    const { camera, gc } = setup();
    const before = camera.position.clone();
    gc.dispose();
    press('ArrowLeft');
    expect(camera.position.distanceTo(before)).toBe(0);
  });
});
