import { describe, expect, it, vi } from 'vitest';
import { Group } from 'three';
import { loadLandmarks, placements, validatePlacements } from '../../src/garden/landmarks/registry';
import type { Landmark, Placement } from '../../src/garden/landmarks/types';

const fake = (id: string, href = '/x/', build?: Landmark['build']): Landmark => ({
  id,
  label: id,
  href,
  build: build ?? (async () => ({ object: new Group() })),
});
const place = (l: Landmark, position: [number, number] = [0, 0], rotationY = 0): Placement => ({
  landmark: l,
  position,
  rotationY,
});

describe('validatePlacements', () => {
  it('accepts the shipped placements', () => {
    expect(validatePlacements(placements)).toEqual([]);
  });
  it('reports duplicate ids', () => {
    const msgs = validatePlacements([place(fake('dup')), place(fake('dup'))]);
    expect(msgs).toHaveLength(1);
    expect(msgs[0]).toContain('dup');
  });
  it('rejects hrefs not starting with /', () => {
    for (const href of ['writing/', 'https://x']) {
      const msgs = validatePlacements([place(fake('a', href))]);
      expect(msgs).toHaveLength(1);
      expect(msgs[0]).toContain('must start with /');
      expect(msgs[0]).toContain('a');
    }
  });
  it('rejects positions outside the diorama', () => {
    for (const pos of [[6.5, 0], [0, -6.1]] as [number, number][]) {
      const msgs = validatePlacements([place(fake('far'), pos)]);
      expect(msgs).toHaveLength(1);
      expect(msgs[0]).toContain('outside diorama');
      expect(msgs[0]).toContain('far');
    }
  });
});

describe('loadLandmarks', () => {
  it('drops rejected builds, logs once, and positions the good ones', async () => {
    const object = new Group();
    const good = place(fake('good', '/g/', async () => ({ object })), [2, -3], 0.5);
    const bad = place(fake('bad', '/b/', async () => { throw new Error('boom'); }));
    const log = vi.fn();
    const out = await loadLandmarks([good, bad], log);
    expect(out).toHaveLength(1);
    expect(out[0].placement).toBe(good);
    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0][0]).toContain('bad');
    expect(object.position.x).toBe(2);
    expect(object.position.y).toBe(0);
    expect(object.position.z).toBe(-3);
    expect(object.rotation.y).toBe(0.5);
  });
  it('treats a build that throws synchronously like a rejection', async () => {
    const object = new Group();
    const good = place(fake('good', '/g/', async () => ({ object })));
    const sync = place(
      fake('sync', '/s/', () => {
        throw new Error('sync boom');
      }),
    );
    const log = vi.fn();
    const out = await loadLandmarks([sync, good], log);
    expect(out.map((l) => l.placement)).toEqual([good]);
    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0][0]).toContain('sync');
  });
});
