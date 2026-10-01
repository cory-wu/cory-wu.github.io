import { Mesh } from 'three';
import type { BufferGeometry, Material } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** Returns a copy of `geo` translated (and optionally yawed) into its place in the diorama. */
export function placed(geo: BufferGeometry, x: number, y: number, z: number, yaw = 0): BufferGeometry {
  const out = geo.clone();
  if (yaw !== 0) out.rotateY(yaw);
  out.translate(x, y, z);
  return out;
}

/** Merges placed parts into one single-material mesh so a prop costs one draw call. */
export function mergedMesh(parts: BufferGeometry[], material: Material, kind: string): Mesh {
  const flat = parts.map((p) => (p.index ? p.toNonIndexed() : p));
  const geometry = mergeGeometries(flat);
  if (!geometry) throw new Error(`could not merge ${kind} parts`);
  const mesh = new Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.kind = kind;
  return mesh;
}
