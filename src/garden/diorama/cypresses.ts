import { ConeGeometry, InstancedMesh, Matrix4, Quaternion, Vector3 } from 'three';
import type { MeshStandardMaterial } from 'three';
import { PALETTE, flatMaterial } from '../palette';
import type { Rng } from './random';

const X = 1.8;
const Z_RANGE: readonly [number, number] = [-4.5, 3.5];
const COUNT = 6;
const RADIUS = 0.35;
const HEIGHT = 2.6;
const SEGMENTS = 7;
const JITTER = 0.12;

export function buildCypresses(rng: Rng): { mesh: InstancedMesh; material: MeshStandardMaterial } {
  const material = flatMaterial(PALETTE.cypress);
  const geo = new ConeGeometry(RADIUS, HEIGHT, SEGMENTS).translate(0, HEIGHT / 2, 0);
  const mesh = new InstancedMesh(geo, material, COUNT);
  const m = new Matrix4();
  const q = new Quaternion();
  for (let i = 0; i < COUNT; i++) {
    const z = Z_RANGE[0] + (i * (Z_RANGE[1] - Z_RANGE[0])) / (COUNT - 1);
    const girth = 1 + (rng() - 0.5) * 2 * JITTER;
    const tall = 1 + (rng() - 0.5) * 2 * JITTER;
    m.compose(new Vector3(X, 0, z), q, new Vector3(girth, tall, girth));
    mesh.setMatrixAt(i, m);
  }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.kind = 'cypress';
  return { mesh, material };
}
