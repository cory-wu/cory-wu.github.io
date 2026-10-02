import { BoxGeometry, Group, Mesh, PlaneGeometry } from 'three';
import type { BufferGeometry, Object3D } from 'three';
import { PALETTE, flatMaterial } from '../palette';
import { mergedMesh, placed } from './parts';
import { patchRipples } from './pool-ripples';
import { waterMaterial } from './water';

const X: readonly [number, number] = [2.5, 5];
const Z: readonly [number, number] = [-5, 4];
const RIM = 0.25;
const RIM_HEIGHT = 0.2;
const WATER_Y = 0.06;
const SURFACE_SEGMENTS = { x: 8, z: 32 } as const;

/** Open water inside the rim, in diorama coordinates; the surface sits at y. */
export const POOL_WATER = {
  x: [X[0] + RIM, X[1] - RIM] as const,
  z: [Z[0] + RIM, Z[1] - RIM] as const,
  y: WATER_Y,
} as const;

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

  // A subdivided grid so the ripple patch has vertices to move; the rim hides its edges.
  const [wx0, wx1] = POOL_WATER.x;
  const [wz0, wz1] = POOL_WATER.z;
  const surface = new Mesh(
    new PlaneGeometry(wx1 - wx0, wz1 - wz0, SURFACE_SEGMENTS.x, SURFACE_SEGMENTS.z).rotateX(-Math.PI / 2),
    water,
  );
  surface.name = 'pool-surface';
  surface.position.set((wx0 + wx1) / 2, WATER_Y, (wz0 + wz1) / 2);
  patchRipples(water);
  surface.receiveShadow = true;
  surface.userData.kind = 'pool';
  group.add(surface);
  return group;
}
