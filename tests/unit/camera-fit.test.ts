import { describe, expect, it } from 'vitest';
import { CAMERA, fitDistance } from '../../src/garden/camera-fit';

describe('fitDistance', () => {
  it('uses the base distance on wide screens', () => {
    expect(fitDistance(16 / 9)).toBe(CAMERA.baseDistance);
    expect(fitDistance(16 / 9)).toBe(34);
  });
  it('pulls back on portrait screens, within the max', () => {
    const d = fitDistance(0.46);
    expect(d).toBeGreaterThan(34);
    expect(d).toBeLessThanOrEqual(55);
  });
  it('clamps to the max distance on very narrow screens', () => {
    expect(fitDistance(0.1)).toBe(55);
  });
  it('is non-increasing as aspect grows', () => {
    let prev = Infinity;
    for (let a = 0.3; a <= 2.0001; a += 0.05) {
      const d = fitDistance(a);
      expect(d).toBeLessThanOrEqual(prev);
      prev = d;
    }
  });
});
