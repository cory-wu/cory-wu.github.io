import { BoxGeometry, CylinderGeometry, ConeGeometry, Group } from 'three';
import type { BufferGeometry, MeshStandardMaterial, Object3D } from 'three';
import { PALETTE, flatMaterial } from '../palette';
import { mergedMesh, placed } from './parts';

/** Lantern posts at the courtyard edges (clear of cypresses, pergola and shed). */
const POSITIONS: ReadonlyArray<readonly [x: number, z: number]> = [
  [1.15, 0.95],
  [1.15, 3.2],
  [-4.95, 1.0],
  [-0.9, 4.95],
];
const POST_H = 1.1;
const GLASS = 0.2;

export function buildLanterns(): { group: Object3D; glass: MeshStandardMaterial } {
  const iron: BufferGeometry[] = [];
  const panes: BufferGeometry[] = [];
  for (const [x, z] of POSITIONS) {
    iron.push(placed(new CylinderGeometry(0.05, 0.07, POST_H, 6), x, POST_H / 2, z));
    iron.push(placed(new BoxGeometry(0.26, 0.04, 0.26), x, POST_H + 0.02, z));
    iron.push(placed(new ConeGeometry(0.19, 0.16, 4), x, POST_H + GLASS + 0.14, z, Math.PI / 4));
    panes.push(placed(new BoxGeometry(GLASS, GLASS, GLASS), x, POST_H + 0.04 + GLASS / 2, z));
  }
  const glass = flatMaterial(PALETTE.window);
  glass.emissive.set(PALETTE.lanternGlow);
  glass.emissiveIntensity = 0;
  const group = new Group();
  group.add(
    mergedMesh(iron, flatMaterial(PALETTE.ironDark), 'lantern'),
    mergedMesh(panes, glass, 'lantern'),
  );
  return { group, glass };
}
