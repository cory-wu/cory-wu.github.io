import { BoxGeometry, Group, InstancedMesh, Matrix4 } from 'three';
import type { Object3D } from 'three';
import { PALETTE, flatMaterial } from '../palette';

const PAVER = { w: 0.9, h: 0.08, d: 0.9 } as const;
const GAP = 0.06;
const PITCH_X = PAVER.w + GAP;
const PITCH_Z = PAVER.d + GAP;
const X_RANGE: readonly [number, number] = [-5, 1];
const Z_RANGE: readonly [number, number] = [-1, 5];

export function buildCourtyard(): Object3D {
  const cols = Math.floor((X_RANGE[1] - X_RANGE[0]) / PITCH_X);
  const rows = Math.floor((Z_RANGE[1] - Z_RANGE[0]) / PITCH_Z);
  const cx = (X_RANGE[0] + X_RANGE[1]) / 2;
  const cz = (Z_RANGE[0] + Z_RANGE[1]) / 2;

  const pavers = new InstancedMesh(
    new BoxGeometry(PAVER.w, PAVER.h, PAVER.d),
    flatMaterial(PALETTE.stone),
    cols * rows,
  );
  const m = new Matrix4();
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const x = cx + (i - (cols - 1) / 2) * PITCH_X;
      const z = cz + (j - (rows - 1) / 2) * PITCH_Z;
      pavers.setMatrixAt(i * rows + j, m.makeTranslation(x, PAVER.h / 2, z));
    }
  }
  pavers.instanceMatrix.needsUpdate = true;
  // 8 cm pavers flush with the grass: their shadow is a sliver in the gaps, not worth a shadow-pass draw.
  pavers.castShadow = false;
  pavers.receiveShadow = true;
  pavers.userData.kind = 'courtyard';

  const group = new Group();
  group.add(pavers);
  return group;
}
