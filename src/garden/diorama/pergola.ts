import { BoxGeometry, IcosahedronGeometry } from 'three';
import type { BufferGeometry, Object3D } from 'three';
import { Group } from 'three';
import { PALETTE, flatMaterial } from '../palette';
import { mergedMesh, placed } from './parts';
import type { Rng } from './random';

const X: readonly [number, number] = [-4.9, -3.1];
const Z: readonly [number, number] = [3.1, 4.9];
const POST = 0.14;
const HEIGHT = 1.7;
const BEAM = 0.1;
const RAFTERS = 5;

/** Flowered pergola: four posts, two long beams, cross rafters, flower clusters on top. */
export function buildPergola(rng: Rng): Object3D {
  const wood: BufferGeometry[] = [];
  const leaves: BufferGeometry[] = [];
  const pink: BufferGeometry[] = [];
  const white: BufferGeometry[] = [];
  const cx = (X[0] + X[1]) / 2;
  const cz = (Z[0] + Z[1]) / 2;
  const w = X[1] - X[0];
  const d = Z[1] - Z[0];

  for (const x of X) for (const z of Z) wood.push(placed(new BoxGeometry(POST, HEIGHT, POST), x, HEIGHT / 2, z));
  for (const z of Z) wood.push(placed(new BoxGeometry(w + 0.3, BEAM, BEAM * 1.4), cx, HEIGHT + BEAM / 2, z));
  for (let i = 0; i < RAFTERS; i++) {
    const x = X[0] + (i * w) / (RAFTERS - 1);
    wood.push(placed(new BoxGeometry(BEAM * 0.8, BEAM * 0.8, d + 0.3), x, HEIGHT + BEAM * 1.4, cz));
  }

  const top = HEIGHT + BEAM * 1.8;
  const leaf = new IcosahedronGeometry(0.17, 0);
  const bloom = new IcosahedronGeometry(0.1, 0);
  for (let i = 0; i < 9; i++) {
    const x = X[0] - 0.05 + rng() * (w + 0.1);
    const z = Z[0] - 0.05 + rng() * (d + 0.1);
    leaves.push(placed(leaf, x, top + 0.02, z));
    const target = rng() < 0.5 ? pink : white;
    target.push(placed(bloom, x + (rng() - 0.5) * 0.12, top + 0.15, z + (rng() - 0.5) * 0.12));
  }
  // Vines climbing the posts.
  for (const x of X) for (const z of Z) leaves.push(placed(new IcosahedronGeometry(0.15, 0), x, HEIGHT * 0.72, z));

  const group = new Group();
  group.add(
    mergedMesh(wood, flatMaterial(PALETTE.wood), 'pergola'),
    mergedMesh(leaves, flatMaterial(PALETTE.leaf), 'pergola'),
    mergedMesh(pink, flatMaterial(PALETTE.flowerPink), 'pergola'),
    mergedMesh(white, flatMaterial(PALETTE.flowerWhite), 'pergola'),
  );
  return group;
}
