import { BoxGeometry, Group } from 'three';
import type { BufferGeometry, Material, Mesh, Object3D } from 'three';
import { PALETTE, flatMaterial } from '../palette';
import { mergedMesh, placed } from './parts';

const SIZE = 12;
const SOIL_TOP = -2;
const BAND_BOTTOM = -3;
const GRASS_CAP = 0.04;

/** A box of height `h` hanging from `yTop`, placed in diorama space. */
function slab(w: number, h: number, d: number, x: number, yTop: number, z: number): BufferGeometry {
  return placed(new BoxGeometry(w, h, d), x, yTop - h / 2, z);
}

/**
 * One single-material mesh per earth colour. The block is flat-topped and sits
 * below everything else, so it receives shadows but casts none worth a shadow-pass draw.
 */
function earthMesh(parts: BufferGeometry[], material: Material): Mesh {
  const mesh = mergedMesh(parts, material, 'earth');
  mesh.castShadow = false;
  return mesh;
}

/** Earth block: grass-topped soil, a darker stone band, and an uneven underside. */
export function buildEarth(): Object3D {
  const group = new Group();
  const grass = flatMaterial(PALETTE.grass);
  const soil = flatMaterial(PALETTE.soil);
  const stone = flatMaterial(PALETTE.stoneDark);

  const roots: Array<[w: number, h: number, d: number, x: number, z: number]> = [
    [7, 0.8, 6.5, -1, 0.5],
    [4, 1.4, 4.5, 1.5, -1],
    [3, 0.6, 3.5, -2.5, 2],
  ];

  // Single-material meshes: a multi-material box costs one draw call per face group.
  // The soil slab and the soil roots under the stone band share a material, so they merge.
  group.add(earthMesh([slab(SIZE, GRASS_CAP, SIZE, 0, 0, 0)], grass));
  group.add(
    earthMesh(
      [
        slab(SIZE, -SOIL_TOP - GRASS_CAP, SIZE, 0, -GRASS_CAP, 0),
        ...roots.map(([w, h, d, x, z]) => slab(w, h, d, x, BAND_BOTTOM, z)),
      ],
      soil,
    ),
  );
  group.add(earthMesh([slab(SIZE, SOIL_TOP - BAND_BOTTOM, SIZE, 0, SOIL_TOP, 0)], stone));
  return group;
}
