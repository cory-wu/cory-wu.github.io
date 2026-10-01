import type { MeshStandardMaterial } from 'three';
import { PALETTE, flatMaterial } from '../palette';

const WATER_ROUGHNESS = 0.3;

export function waterMaterial(): MeshStandardMaterial {
  const m = flatMaterial(PALETTE.water);
  m.roughness = WATER_ROUGHNESS;
  return m;
}
