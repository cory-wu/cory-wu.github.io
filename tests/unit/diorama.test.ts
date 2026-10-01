import { describe, expect, it } from 'vitest';
import { Box3, InstancedMesh, Material, Mesh, Vector3 } from 'three';
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

  it('keeps the mesh count low', () => {
    expect(meshes(d.group).length).toBeLessThan(40);
  });

  it('renders the pavers as one InstancedMesh', () => {
    const inst = meshes(d.group).filter((m) => m instanceof InstancedMesh);
    expect(inst).toHaveLength(1);
    expect(inst[0].userData.kind).toBe('courtyard');
  });

  it('exposes the fountain and pool water materials', () => {
    expect(d.water).toHaveLength(2);
    for (const m of d.water) expect(m.flatShading).toBe(true);
  });

  it('adds an unlit warm fountain light', () => {
    expect(d.fountainLight.intensity).toBe(0);
    expect(d.fountainLight.color.getHexString()).toBe('ffd9a0');
    expect(d.fountainLight.distance).toBe(6);
    expect(d.group.children).toContain(d.fountainLight);
  });

  it('leaves sway and lanterns for later tasks', () => {
    expect(d.sway).toEqual([]);
    expect(d.lanterns).toEqual([]);
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
