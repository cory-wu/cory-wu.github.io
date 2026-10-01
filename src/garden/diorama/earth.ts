import { BoxGeometry, Group, Mesh } from 'three';
import type { Object3D } from 'three';
import { PALETTE, flatMaterial } from '../palette';

const SIZE = 12;
const SOIL_TOP = -2;
const BAND_BOTTOM = -3;
const GRASS_CAP = 0.04;

function box(w: number, h: number, d: number, x: number, yTop: number, z: number, mat: Mesh['material']): Mesh {
  const mesh = new Mesh(new BoxGeometry(w, h, d), mat);
  mesh.position.set(x, yTop - h / 2, z);
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  mesh.userData.kind = 'earth';
  return mesh;
}

/** Earth block: grass-topped soil, a darker stone band, and an uneven underside. */
export function buildEarth(): Object3D {
  const group = new Group();
  const grass = flatMaterial(PALETTE.grass);
  const soil = flatMaterial(PALETTE.soil);
  const stone = flatMaterial(PALETTE.stoneDark);

  // Single-material meshes: a multi-material box costs one draw call per face group.
  group.add(box(SIZE, GRASS_CAP, SIZE, 0, 0, 0, grass));
  group.add(box(SIZE, -SOIL_TOP - GRASS_CAP, SIZE, 0, -GRASS_CAP, 0, soil));
  group.add(box(SIZE, SOIL_TOP - BAND_BOTTOM, SIZE, 0, SOIL_TOP, 0, stone));

  const roots: Array<[w: number, h: number, d: number, x: number, z: number]> = [
    [7, 0.8, 6.5, -1, 0.5],
    [4, 1.4, 4.5, 1.5, -1],
    [3, 0.6, 3.5, -2.5, 2],
  ];
  for (const [w, h, d, x, z] of roots) group.add(box(w, h, d, x, BAND_BOTTOM, z, soil));
  return group;
}
