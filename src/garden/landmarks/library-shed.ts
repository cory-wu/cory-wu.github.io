import { BoxGeometry, ExtrudeGeometry, Group, Mesh, Shape } from 'three';
import type { BufferGeometry, MeshStandardMaterial } from 'three';
import { flatMaterial, PALETTE } from '../palette.ts';
import type { Landmark, LandmarkBuild } from './types.ts';

const WALL = { w: 2.5, h: 1.8, d: 2.4 };
const ROOF = { w: 2.8, d: 2.7, rise: 0.85 };

function part(geo: BufferGeometry, mat: MeshStandardMaterial, x: number, y: number, z: number): Mesh {
  const mesh = new Mesh(geo, mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** Triangular prism: gable profile in z/y, ridge running along x. */
function gableRoof(): ExtrudeGeometry {
  const half = ROOF.d / 2;
  const profile = new Shape().moveTo(-half, 0).lineTo(half, 0).lineTo(0, ROOF.rise).closePath();
  const geo = new ExtrudeGeometry(profile, { depth: ROOF.w, bevelEnabled: false });
  geo.translate(0, 0, -ROOF.w / 2);
  geo.rotateY(Math.PI / 2);
  return geo;
}

async function build(): Promise<LandmarkBuild> {
  const group = new Group();
  const wallMat = flatMaterial(PALETTE.shedWall);
  const roofMat = flatMaterial(PALETTE.roof);
  const woodMat = flatMaterial(PALETTE.wood);
  const windowMat = flatMaterial(PALETTE.window);
  windowMat.emissive.set(PALETTE.window);
  windowMat.emissiveIntensity = 0;

  const frontZ = WALL.d / 2;
  group.add(part(new BoxGeometry(WALL.w, WALL.h, WALL.d), wallMat, 0, WALL.h / 2, 0));
  group.add(part(gableRoof(), roofMat, 0, WALL.h, 0));

  // Door and two windows, proud of the front wall face.
  group.add(part(new BoxGeometry(0.6, 1.2, 0.08), woodMat, 0, 0.6, frontZ + 0.04));
  for (const x of [-0.85, 0.85]) {
    group.add(part(new BoxGeometry(0.5, 0.5, 0.06), windowMat, x, 1.0, frontZ + 0.03));
  }

  // Sign above the door.
  group.add(part(new BoxGeometry(0.7, 0.22, 0.05), woodMat, 0, 1.5, frontZ + 0.05));

  // Small book stack beside the door.
  const bookColors = [PALETTE.roof, PALETTE.lavender, PALETTE.hedge];
  bookColors.forEach((color, i) => {
    group.add(part(new BoxGeometry(0.4 - i * 0.04, 0.1, 0.28), flatMaterial(color), 1.0, 0.05 + i * 0.1, frontZ + 0.3));
  });

  return { object: group, nightLights: [windowMat] };
}

export const libraryShed: Landmark = {
  id: 'library-shed',
  label: 'Writing',
  href: '/writing/',
  build,
};
