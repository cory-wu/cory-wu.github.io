import { CylinderGeometry, Group, Mesh } from 'three';
import type { Object3D } from 'three';
import { PALETTE, flatMaterial } from '../palette';
import { waterMaterial } from './water';

export const FOUNTAIN_POSITION: readonly [x: number, z: number] = [-2, 2];
const SEGMENTS = 12;

export function buildFountain(): Object3D {
  const group = new Group();
  group.position.set(FOUNTAIN_POSITION[0], 0, FOUNTAIN_POSITION[1]);
  const stone = flatMaterial(PALETTE.stone);
  const water = waterMaterial();
  group.userData.water = water;

  const add = (kind: string, geo: CylinderGeometry, y: number, mat = stone, shadow = true): void => {
    const mesh = new Mesh(geo, mat);
    mesh.position.y = y;
    mesh.castShadow = shadow;
    mesh.receiveShadow = true;
    mesh.userData.kind = kind;
    group.add(mesh);
  };

  const basinH = 0.5;
  add('fountain', new CylinderGeometry(1.0, 1.05, basinH, SEGMENTS), basinH / 2);
  add('fountain', new CylinderGeometry(0.85, 0.85, 0.02, SEGMENTS), basinH + 0.01, water, false);
  const pedestalH = 0.8;
  add('fountain', new CylinderGeometry(0.2, 0.26, pedestalH, SEGMENTS), pedestalH / 2);
  add('fountain', new CylinderGeometry(0.45, 0.22, 0.2, SEGMENTS), pedestalH + 0.1);
  return group;
}

