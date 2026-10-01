import { describe, expect, it } from 'vitest';
import { Box3, InstancedMesh, Material, Mesh, Vector3 } from 'three';
import { PALETTE } from '../../src/garden/palette';
import type { Object3D } from 'three';
import { buildDiorama } from '../../src/garden/diorama';

function meshes(root: Object3D): Mesh[] {
  const out: Mesh[] = [];
  root.traverse((o) => {
    if (o instanceof Mesh) out.push(o);
  });
  return out;
}

describe('buildDiorama', () => {
  const d = buildDiorama();

  it('stays within the 12 x 12 footprint and 3 units of height', () => {
    const box = new Box3().setFromObject(d.group);
    expect(box.min.x).toBeGreaterThanOrEqual(-6.01);
    expect(box.max.x).toBeLessThanOrEqual(6.01);
    expect(box.min.z).toBeGreaterThanOrEqual(-6.01);
    expect(box.max.z).toBeLessThanOrEqual(6.01);
    expect(box.max.y).toBeLessThanOrEqual(3);
  });

  it('stays under the draw-call budget', () => {
    // A single material draws the whole geometry at once; only multi-material meshes cost one call per group.
    let calls = 0;
    for (const mesh of meshes(d.group)) calls += Array.isArray(mesh.material) ? Math.max(1, mesh.geometry.groups.length) : 1;
    expect(calls).toBeLessThan(60);
  });

  it('gives the earth block single-material meshes', () => {
    for (const mesh of meshes(d.group).filter((m) => m.userData.kind === 'earth')) {
      expect(Array.isArray(mesh.material)).toBe(false);
    }
  });

  it('tags the fountain water disc separately', () => {
    expect(meshes(d.group).filter((m) => m.userData.kind === 'fountain-water')).toHaveLength(1);
  });

  it('renders the pavers as one InstancedMesh', () => {
    const inst = meshes(d.group).filter((m) => m instanceof InstancedMesh && m.userData.kind === 'courtyard');
    expect(inst).toHaveLength(1);
  });

  it('exposes the fountain and pool water materials', () => {
    expect(d.water).toHaveLength(2);
    for (const m of d.water) expect(m.flatShading).toBe(true);
  });

  it('adds an unlit warm fountain light', () => {
    expect(d.fountainLight.intensity).toBe(0);
    expect(d.fountainLight.color.getHexString()).toBe(PALETTE.fountainGlow.slice(1));
    expect(d.fountainLight.distance).toBe(6);
    expect(d.group.children).toContain(d.fountainLight);
  });

  it('exposes distinct sway materials used only by swaying meshes', () => {
    expect(d.sway.length).toBeGreaterThanOrEqual(2);
    expect(new Set(d.sway).size).toBe(d.sway.length);
    const swayKinds = new Set(['cypress', 'lavender']);
    for (const mesh of meshes(d.group)) {
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      const usesSway = mats.some((m) => d.sway.includes(m as never));
      expect(usesSway).toBe(swayKinds.has(mesh.userData.kind));
    }
  });

  it('exposes unlit lantern glass materials', () => {
    expect(d.lanterns.length).toBeGreaterThanOrEqual(1);
    expect(new Set(d.lanterns).size).toBe(d.lanterns.length);
    for (const m of d.lanterns) {
      expect(m.emissiveIntensity).toBe(0);
      expect(m.emissive.getHexString()).toBe(PALETTE.lanternGlow.slice(1));
    }
  });

  it('adds every plant and prop kind', () => {
    const kinds = new Set(meshes(d.group).map((m) => m.userData.kind));
    for (const k of ['cypress', 'lavender', 'pergola', 'bench', 'pot', 'tree', 'lantern']) {
      expect(kinds.has(k)).toBe(true);
    }
  });

  it('plants six cypresses and a lavender bed as instanced meshes', () => {
    const cypress = meshes(d.group).find((m) => m.userData.kind === 'cypress');
    const lavender = meshes(d.group).find((m) => m.userData.kind === 'lavender');
    expect(cypress).toBeInstanceOf(InstancedMesh);
    expect((cypress as InstancedMesh).count).toBe(6);
    expect(lavender).toBeInstanceOf(InstancedMesh);
  });

  it('keeps decorations out of the shed exclusion box', () => {
    const exempt = new Set(['earth', 'courtyard', 'hedge']);
    const box = new Box3();
    for (const mesh of meshes(d.group)) {
      if (exempt.has(mesh.userData.kind)) continue;
      const b = box.setFromObject(mesh);
      const overlaps = b.max.x > -5.5 && b.min.x < -1.5 && b.max.z > -5.5 && b.min.z < -1.5;
      expect(overlaps, `${mesh.userData.kind} intrudes on the shed`).toBe(false);
    }
  });

  it('lays out cypress instances identically on every build', () => {
    const matrices = (dd: ReturnType<typeof buildDiorama>): number[] => {
      const c = meshes(dd.group).find((m) => m.userData.kind === 'cypress') as InstancedMesh;
      return Array.from(c.instanceMatrix.array);
    };
    expect(matrices(buildDiorama())).toEqual(matrices(d));
  });

  it('uses flat shading on every material', () => {
    for (const mesh of meshes(d.group)) {
      const mats: Material[] = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of mats) expect((m as { flatShading?: boolean }).flatShading).toBe(true);
    }
  });

  it('tags every mesh with a kind and enables shadow receiving', () => {
    for (const mesh of meshes(d.group)) {
      expect(typeof mesh.userData.kind).toBe('string');
      expect(mesh.receiveShadow).toBe(true);
    }
  });

  it('keeps front hedges low and back hedges tall', () => {
    const hedges = meshes(d.group).filter((m) => m.userData.kind === 'hedge');
    const center = new Vector3();
    const box = new Box3();
    const front = hedges.filter((h) => box.setFromObject(h).getCenter(center).z > 5);
    const back = hedges.filter((h) => box.setFromObject(h).getCenter(center).z < -5);
    expect(front.length).toBeGreaterThan(0);
    for (const h of front) expect(box.setFromObject(h).max.y).toBeLessThanOrEqual(0.51);
    expect(Math.max(...back.map((h) => box.setFromObject(h).max.y))).toBeCloseTo(1.2);
  });

  it('leaves an entrance gap in the front hedge', () => {
    const box = new Box3();
    const front = meshes(d.group)
      .filter((m) => m.userData.kind === 'hedge')
      .map((h) => box.setFromObject(h).clone())
      .filter((b) => b.getCenter(new Vector3()).z > 5);
    expect(front.some((b) => b.min.x <= -2 && b.max.x >= -2)).toBe(false);
  });

  it('keeps the library shed footprint clear of hedges', () => {
    const box = new Box3();
    for (const h of meshes(d.group).filter((m) => m.userData.kind === 'hedge')) {
      const b = box.setFromObject(h);
      const overlaps = b.max.x > -5.3 && b.min.x < -1.5 && b.max.z > -5.3 && b.min.z < -1.5;
      expect(overlaps).toBe(false);
    }
  });
});
