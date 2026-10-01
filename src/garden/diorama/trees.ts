import { CylinderGeometry, Group, IcosahedronGeometry } from 'three';
import type { BufferGeometry, Object3D } from 'three';
import { PALETTE, flatMaterial } from '../palette';
import { mergedMesh, placed } from './parts';

interface TreeSpec {
  x: number;
  z: number;
  /** Radius of the lower canopy; the upper one is smaller. */
  canopy: number;
}

const TREES: readonly TreeSpec[] = [
  { x: 4.8, z: 5, canopy: 0.55 },
  { x: -4.7, z: -0.8, canopy: 0.5 },
];
const TRUNK_H = 0.8;

export function buildTrees(): Object3D {
  const trunks: BufferGeometry[] = [];
  const canopies: BufferGeometry[] = [];
  for (const { x, z, canopy } of TREES) {
    trunks.push(placed(new CylinderGeometry(0.09, 0.12, TRUNK_H, 6), x, TRUNK_H / 2, z));
    canopies.push(placed(new IcosahedronGeometry(canopy, 0), x, TRUNK_H + canopy * 0.7, z));
    canopies.push(placed(new IcosahedronGeometry(canopy * 0.7, 0), x + 0.04, TRUNK_H + canopy * 1.6, z - 0.03, 0.6));
  }
  const group = new Group();
  group.add(
    mergedMesh(trunks, flatMaterial(PALETTE.wood), 'tree'),
    mergedMesh(canopies, flatMaterial(PALETTE.canopy), 'tree'),
  );
  return group;
}
