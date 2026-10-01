import { BoxGeometry, Group, Mesh } from 'three';
import type { Object3D } from 'three';
import { PALETTE, flatMaterial } from '../palette';

const THICKNESS = 0.6;
const EDGE = 6 - THICKNESS / 2;
const TALL = 1.2;
const LOW = 0.5;
const GAP = 0.14;
const ENTRANCE: readonly [from: number, to: number] = [-2.9, -1.1];

/** Splits [from, to] into `count` equal runs separated by small gaps. */
function runs(from: number, to: number, count: number): Array<[number, number]> {
  const len = (to - from - GAP * (count - 1)) / count;
  return Array.from({ length: count }, (_, i) => {
    const start = from + i * (len + GAP);
    return [start, start + len] as [number, number];
  });
}

export function buildHedges(): Object3D {
  const group = new Group();
  const mat = flatMaterial(PALETTE.hedge);

  const add = (xa: number, xb: number, za: number, zb: number, h: number): void => {
    const mesh = new Mesh(new BoxGeometry(xb - xa, h, zb - za), mat);
    mesh.position.set((xa + xb) / 2, h / 2, (za + zb) / 2);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.kind = 'hedge';
    group.add(mesh);
  };

  const back = EDGE - THICKNESS / 2;
  const front = EDGE + THICKNESS / 2;
  // Back walls (-z owns the corner), tall.
  for (const [a, b] of runs(-6, 6, 3)) add(a, b, -front, -back, TALL);
  for (const [a, b] of runs(-back, back, 3)) add(-front, -back, a, b, TALL);
  // Front walls (+z with the entrance, +x), low.
  for (const [a, b] of [...runs(-6, ENTRANCE[0], 2), ...runs(ENTRANCE[1], 6, 2)]) add(a, b, back, front, LOW);
  for (const [a, b] of runs(-back, back, 3)) add(back, front, a, b, LOW);
  return group;
}
