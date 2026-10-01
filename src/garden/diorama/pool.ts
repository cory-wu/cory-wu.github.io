import { BoxGeometry, Group, Mesh } from 'three';
import type { BufferGeometry, Object3D } from 'three';
import { PALETTE, flatMaterial } from '../palette';
import { mergedMesh, placed } from './parts';
import { waterMaterial } from './water';

const X: readonly [number, number] = [2.5, 5];
const Z: readonly [number, number] = [-5, 4];
const RIM = 0.25;
const RIM_HEIGHT = 0.2;
const WATER_Y = 0.06;
const WATER_THICKNESS = 0.02;

export function buildPool(): Object3D {
  const group = new Group();
  const stone = flatMaterial(PALETTE.stone);
  const water = waterMaterial();
  group.userData.water = water;

  const side = (xa: number, xb: number, za: number, zb: number): BufferGeometry =>
    placed(new BoxGeometry(xb - xa, RIM_HEIGHT, zb - za), (xa + xb) / 2, RIM_HEIGHT / 2, (za + zb) / 2);
  // Rim hugs the outside of the water extents, so it stays inside the pool area.
  const [x0, x1, z0, z1] = [X[0], X[1], Z[0], Z[1]];
  const rim = mergedMesh(
    [
      side(x0, x1, z0, z0 + RIM), // back
      side(x0, x1, z1 - RIM, z1), // front
      side(x0, x0 + RIM, z0 + RIM, z1 - RIM), // left
      side(x1 - RIM, x1, z0 + RIM, z1 - RIM), // right
    ],
    stone,
    'pool-rim',
  );
  // A 20 cm kerb: its shadow on the water is a thin sliver, not worth a shadow-pass draw.
  rim.castShadow = false;
  group.add(rim);

  const surface = new Mesh(
    new BoxGeometry(x1 - x0 - 2 * RIM, WATER_THICKNESS, z1 - z0 - 2 * RIM),
    water,
  );
  surface.position.set((x0 + x1) / 2, WATER_Y - WATER_THICKNESS / 2, (z0 + z1) / 2);
  surface.receiveShadow = true;
  surface.userData.kind = 'pool';
  group.add(surface);
  return group;
}
