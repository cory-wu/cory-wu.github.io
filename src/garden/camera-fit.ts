export const CAMERA = {
  fov: 30,
  azimuth: Math.PI / 4,
  polar: 0.95,
  baseDistance: 34,
  minDistance: 14,
  maxDistance: 72,
  minPolar: 0.2,
  maxPolar: 1.2,
  fitRadius: 8.5,
} as const;

/** Distance at which a sphere of `fitRadius` fits both FOV axes, clamped to [base, max]. */
export function fitDistance(aspect: number): number {
  const vHalf = (CAMERA.fov * Math.PI) / 360;
  const hHalf = Math.atan(Math.tan(vHalf) * aspect);
  const required = CAMERA.fitRadius / Math.sin(Math.min(vHalf, hHalf));
  return Math.min(CAMERA.maxDistance, Math.max(CAMERA.baseDistance, required));
}
