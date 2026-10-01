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

const angleDeg = (a: [number, number, number], b: [number, number, number]): number =>
  (Math.acos(Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])) * 180) / Math.PI;

const sunArc = (minutes: number): [number, number, number] => {
  const t = ((minutes - 360) / (1140 - 360)) * Math.PI;
  const v = new Vector3(Math.cos(t), Math.sin(t), 0.45).normalize();
  return [v.x, v.y, v.z];
};

const expectDir = (actual: [number, number, number], expected: [number, number, number]): void => {
  actual.forEach((c, i) => expect(c).toBeCloseTo(expected[i], 9));
};

describe('sunDirection', () => {
  it('is high at midday and the moon at night', () => {
    expect(sunDirection(750)[1]).toBeGreaterThan(0.8);
    expectDir(sunDirection(100), [moon.x, moon.y, moon.z]);
  });

  it('is the pure moon outside the twilight blends and the pure sun arc inside daylight', () => {
    expectDir(sunDirection(330), [moon.x, moon.y, moon.z]);
    expectDir(sunDirection(1170), [moon.x, moon.y, moon.z]);
    expectDir(sunDirection(390), sunArc(390));
    expectDir(sunDirection(1110), sunArc(1110));
  });

  it('is between the moon and the horizon sun at 06:00 and 19:00', () => {
    for (const m of [360, 1140]) {
      const [, y] = sunDirection(m);
      expect(y).toBeGreaterThan(0);
      expect(y).toBeLessThan(moon.y);
    }
  });

  it('turns by less than 5 degrees per minute across 05:30-06:30 and 18:30-19:30', () => {
    for (const [from, to] of [[330, 390], [1110, 1170]]) {
      for (let m = from - 1; m < to + 1; m++) {
        expect(angleDeg(sunDirection(m), sunDirection(m + 1)), `minute ${m}`).toBeLessThan(5);
      }
    }
  });

  it('returns unit vectors', () => {
    for (let m = 0; m < 1440; m += 7) {
      const [x, y, z] = sunDirection(m);
      expect(Math.abs(Math.hypot(x, y, z) - 1)).toBeLessThan(1e-6);
    }
  });
});
