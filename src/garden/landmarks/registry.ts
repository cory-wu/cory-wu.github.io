import { libraryShed } from './library-shed';
import type { LandmarkBuild, Placement } from './types';

const DIORAMA_HALF = 6;

export const placements: Placement[] = [
  { landmark: libraryShed, position: [-3.5, -3.5], rotationY: Math.PI / 4 },
];

export function validatePlacements(ps: Placement[]): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const { landmark, position } of ps) {
    const { id, href } = landmark;
    if (seen.has(id)) errors.push(`landmark "${id}": duplicate id`);
    seen.add(id);
    if (!href.startsWith('/') || href.startsWith('//')) {
      errors.push(`landmark "${id}": href "${href}" must start with /`);
    }
    const [x, z] = position;
    if (Math.abs(x) > DIORAMA_HALF || Math.abs(z) > DIORAMA_HALF) {
      errors.push(`landmark "${id}": position [${x}, ${z}] is outside diorama`);
    }
  }
  return errors;
}

export async function loadLandmarks(
  ps: Placement[],
  log: (msg: string, err: unknown) => void = console.error,
): Promise<Array<{ placement: Placement; build: LandmarkBuild }>> {
  const results = await Promise.allSettled(ps.map((p) => p.landmark.build()));
  const loaded: Array<{ placement: Placement; build: LandmarkBuild }> = [];
  results.forEach((result, i) => {
    const placement = ps[i];
    if (result.status === 'rejected') {
      log(`landmark "${placement.landmark.id}" failed to build`, result.reason);
      return;
    }
    const { object } = result.value;
    object.position.set(placement.position[0], 0, placement.position[1]);
    object.rotation.y = placement.rotationY;
    loaded.push({ placement, build: result.value });
  });
  return loaded;
}
