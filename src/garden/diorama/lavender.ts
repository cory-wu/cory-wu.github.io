import { Color, IcosahedronGeometry, InstancedMesh, Matrix4, Quaternion, Vector3 } from 'three';
import type { MeshStandardMaterial } from 'three';
import { PALETTE, flatMaterial } from '../palette';
import type { Rng } from './random';

const X_RANGE: readonly [number, number] = [-0.8, 1.1];
const Z_RANGE: readonly [number, number] = [-4.8, -2.1];
const PITCH_X = 0.3;
const PITCH_Z = 0.32;
const TUFT = 0.15;
/** Per-instance multipliers on the base lavender colour. */
const TONES = ['#ffffff', '#e9defa', '#cdbbee'] as const;

export function buildLavender(rng: Rng): { mesh: InstancedMesh; material: MeshStandardMaterial } {
  const cols = Math.floor((X_RANGE[1] - X_RANGE[0]) / PITCH_X) + 1;
  const rows = Math.floor((Z_RANGE[1] - Z_RANGE[0]) / PITCH_Z) + 1;
  const material = flatMaterial(PALETTE.lavender);
  const mesh = new InstancedMesh(new IcosahedronGeometry(TUFT, 0).translate(0, TUFT, 0), material, cols * rows);
  const m = new Matrix4();
  const q = new Quaternion();
  const tint = new Color();
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const x = X_RANGE[0] + i * PITCH_X + (rng() - 0.5) * 0.08;
      const z = Z_RANGE[0] + j * PITCH_Z + (rng() - 0.5) * 0.08;
      const s = 0.85 + rng() * 0.4;
      const idx = i * rows + j;
      mesh.setMatrixAt(idx, m.compose(new Vector3(x, 0, z), q, new Vector3(s, s * 1.5, s)));
      mesh.setColorAt(idx, tint.set(TONES[Math.floor(rng() * TONES.length)]));
    }
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.kind = 'lavender';
  return { mesh, material };
}
