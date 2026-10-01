import { BoxGeometry, CylinderGeometry, Group, IcosahedronGeometry } from 'three';
import type { BufferGeometry, Object3D } from 'three';
import { PALETTE, flatMaterial } from '../palette';
import { FOUNTAIN_POSITION } from './fountain';
import { mergedMesh, placed } from './parts';

const BENCH_W = 1.3;
const BENCH_D = 0.4;
const SEAT_H = 0.34;
const BENCH_STANCE = 1.65;

/** Pot positions near the courtyard corners; the tree and pergola own the other spots. */
export const POT_POSITIONS: ReadonlyArray<readonly [x: number, z: number]> = [
  [-3.2, -0.55],
  [0.55, -0.55],
  [0.55, 4.55],
  [-2.65, 4.6],
];

/** A bench at `position` whose seat faces the fountain. */
function bench(wood: BufferGeometry[], legs: BufferGeometry[], x: number, z: number): void {
  const yaw = Math.atan2(FOUNTAIN_POSITION[0] - x, FOUNTAIN_POSITION[1] - z) - Math.PI;
  const at = (geo: BufferGeometry, lx: number, ly: number, lz: number): BufferGeometry => {
    // Local +z is the back of the bench; yaw orients the open side to the fountain.
    const out = geo.clone().translate(lx, ly, lz).rotateY(yaw).translate(x, 0, z);
    return out;
  };
  wood.push(at(new BoxGeometry(BENCH_W, 0.07, BENCH_D), 0, SEAT_H, 0));
  wood.push(at(new BoxGeometry(BENCH_W, 0.3, 0.06), 0, SEAT_H + 0.22, BENCH_D / 2 - 0.03));
  for (const lx of [-BENCH_W / 2 + 0.1, BENCH_W / 2 - 0.1]) {
    legs.push(at(new BoxGeometry(0.08, SEAT_H, BENCH_D - 0.06), lx, SEAT_H / 2, 0));
  }
}

export function buildBenches(): Object3D {
  const wood: BufferGeometry[] = [];
  const legs: BufferGeometry[] = [];
  bench(wood, legs, FOUNTAIN_POSITION[0], FOUNTAIN_POSITION[1] - BENCH_STANCE);
  bench(wood, legs, FOUNTAIN_POSITION[0] + BENCH_STANCE, FOUNTAIN_POSITION[1]);
  const group = new Group();
  group.add(
    mergedMesh(wood, flatMaterial(PALETTE.wood), 'bench'),
    mergedMesh(legs, flatMaterial(PALETTE.stoneDark), 'bench'),
  );
  return group;
}

export function buildPots(): Object3D {
  const pots: BufferGeometry[] = [];
  const foliage: BufferGeometry[] = [];
  const blooms: BufferGeometry[] = [];
  const potGeo = new CylinderGeometry(0.2, 0.14, 0.32, 7);
  const bush = new IcosahedronGeometry(0.24, 0);
  const bloom = new IcosahedronGeometry(0.07, 0);
  for (const [x, z] of POT_POSITIONS) {
    pots.push(placed(potGeo, x, 0.16 + 0.08, z));
    foliage.push(placed(bush, x, 0.5, z));
    blooms.push(placed(bloom, x + 0.12, 0.66, z + 0.05), placed(bloom, x - 0.1, 0.6, z - 0.1));
  }
  const group = new Group();
  group.add(
    mergedMesh(pots, flatMaterial(PALETTE.terracotta), 'pot'),
    mergedMesh(foliage, flatMaterial(PALETTE.leaf), 'pot'),
    mergedMesh(blooms, flatMaterial(PALETTE.flowerPink), 'pot'),
  );
  return group;
}
