import { describe, expect, it } from 'vitest';
import { Mesh, Points, Scene } from 'three';
import type { Object3D } from 'three';
import { createAmbient } from '../../src/garden/ambient';
import { buildDiorama } from '../../src/garden/diorama';
import { libraryShed } from '../../src/garden/landmarks/library-shed';

/** Everything drawn by the live (non-reduced) scene: diorama, shed and ambient motion. */
async function liveScene(): Promise<Scene> {
  const scene = new Scene();
  const diorama = buildDiorama();
  scene.add(diorama.group, (await libraryShed.build()).object);
  createAmbient(scene, diorama, { reducedMotion: false });
  return scene;
}

/** A single material draws the whole geometry at once; only multi-material meshes cost one call per group. */
function drawCalls(object: Mesh | Points): number {
  return Array.isArray(object.material) ? Math.max(1, object.geometry.groups.length) : 1;
}

function drawables(root: Object3D): Array<Mesh | Points> {
  const out: Array<Mesh | Points> = [];
  root.traverse((o) => {
    if (o instanceof Mesh || o instanceof Points) out.push(o);
  });
  return out;
}

const FLAT_KINDS = ['earth', 'courtyard', 'pool-rim', 'pool', 'fountain-water'];
const MAX_SHADOW_CASTER_CALLS = 40;

describe('render budget', () => {
  it('keeps main-pass draw calls for diorama + shed + ambient under 60', async () => {
    // Counts butterflies and fireflies together, though only one set is visible at a time.
    const calls = drawables(await liveScene()).reduce((sum, o) => sum + drawCalls(o), 0);
    expect(calls).toBeLessThan(60);
  });

  it('does not cast shadows from flat, low meshes', async () => {
    const flat = drawables(await liveScene()).filter((o) => FLAT_KINDS.includes(o.userData.kind));
    expect(new Set(flat.map((o) => o.userData.kind))).toEqual(new Set(FLAT_KINDS));
    for (const o of flat) expect(o.castShadow, `${o.userData.kind} casts a shadow`).toBe(false);
  });

  it('keeps shadow-pass draw calls down', async () => {
    const casters = drawables(await liveScene()).filter((o) => o.castShadow);
    expect(casters.reduce((sum, o) => sum + drawCalls(o), 0)).toBeLessThanOrEqual(MAX_SHADOW_CASTER_CALLS);
  });
});
