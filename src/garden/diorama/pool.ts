import { BoxGeometry, Group, Mesh } from 'three';
import type { Object3D } from 'three';
import { PALETTE, flatMaterial } from '../palette';
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

  const add = (xa: number, xb: number, za: number, zb: number): void => {
    const mesh = new Mesh(new BoxGeometry(xb - xa, RIM_HEIGHT, zb - za), stone);
    mesh.position.set((xa + xb) / 2, RIM_HEIGHT / 2, (za + zb) / 2);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.kind = 'pool-rim';
    group.add(mesh);
  };
  // Rim hugs the outside of the water extents, so it stays inside the pool area.
  const [x0, x1, z0, z1] = [X[0], X[1], Z[0], Z[1]];
  add(x0, x1, z0, z0 + RIM); // back
  add(x0, x1, z1 - RIM, z1); // front
  add(x0, x0 + RIM, z0 + RIM, z1 - RIM); // left
  add(x1 - RIM, x1, z0 + RIM, z1 - RIM); // right

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
