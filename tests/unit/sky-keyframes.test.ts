import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { sampleSky, sunDirection } from '../../src/garden/sky-keyframes';

const moon = new Vector3(-0.4, 0.8, 0.3).normalize();

describe('sampleSky', () => {
  it('hits preset values at keyframes', () => {
    expect(sampleSky(750).sunIntensity).toBe(2.4);
    expect(sampleSky(0).nightFactor).toBe(1);
  });

  it('blends between night and golden at dusk', () => {
    const f = sampleSky(1125).nightFactor;
    expect(f).toBeGreaterThan(0);
    expect(f).toBeLessThan(1);
  });

  it('wraps 1439 to 0 seamlessly', () => {
    const a = sampleSky(1439);
    const b = sampleSky(0);
    for (const k of ['sunIntensity', 'hemiIntensity', 'nightFactor'] as const) {
      expect(Math.abs(a[k] - b[k])).toBeLessThan(1e-6);
    }
    for (const k of ['sunColor', 'hemiSky', 'hemiGround', 'skyTop', 'skyBottom', 'fog'] as const) {
      expect(a[k].equals(b[k])).toBe(true);
    }
  });

  it('returns fresh colors each call', () => {
    sampleSky(750).skyTop.set('#ff0000');
    const fresh = sampleSky(750).skyTop;
    expect(fresh.getHexString()).toBe('7fc4ef');
  });

  it('lerps colors halfway between dawn and midday', () => {
    const s = sampleSky(495);
    expect(s.sunIntensity).toBeCloseTo((1.2 + 2.4) / 2, 6);
  });
});

describe('sunDirection', () => {
  it('is high at midday, on the horizon at 06:00, and the moon at night', () => {
    expect(sunDirection(750)[1]).toBeGreaterThan(0.8);
    expect(Math.abs(sunDirection(360)[1])).toBeLessThan(1e-6);
    const n = sunDirection(100);
    expect(n[0]).toBeCloseTo(moon.x, 9);
    expect(n[1]).toBeCloseTo(moon.y, 9);
    expect(n[2]).toBeCloseTo(moon.z, 9);
  });

  it('returns unit vectors', () => {
    for (let m = 0; m < 1440; m += 37) {
      const [x, y, z] = sunDirection(m);
      expect(Math.abs(Math.hypot(x, y, z) - 1)).toBeLessThan(1e-6);
    }
  });
});
