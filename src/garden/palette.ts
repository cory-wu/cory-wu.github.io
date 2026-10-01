import { MeshStandardMaterial } from 'three';

export const PALETTE = {
  stone: '#e8d9b5',
  stoneDark: '#b8a888',
  grass: '#6fae4a',
  soil: '#8a5a36',
  hedge: '#3f8a3f',
  cypress: '#2f6b3a',
  water: '#5aa9d6',
  lavender: '#9b7fd1',
  shedWall: '#f1e6cc',
  roof: '#b5533c',
  wood: '#7a4a2a',
  window: '#ffd27a',
} as const;

export function flatMaterial(color: string): MeshStandardMaterial {
  return new MeshStandardMaterial({ color, flatShading: true, roughness: 0.9, metalness: 0 });
}
