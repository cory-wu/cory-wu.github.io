import { CylinderGeometry, Group, IcosahedronGeometry, InstancedMesh, Matrix4, Mesh } from 'three';
import { PALETTE, flatMaterial } from '../palette';
import { mulberry32 } from './random';

/** Heights and radii are in the fountain's local frame (origin at the basin's centre, y = 0 on the grass). */
export const SPRAY = {
  jetBase: 1.0, // top of the fountain's upper bowl
  jetHeight: 0.8,
  jetRadii: [0.07, 0.12] as const, // top, bottom
  jetSegments: 8,
  jetPulse: 0.08,
  jetPeriod: 2,
  droplets: 32,
  dropletRadius: 0.05,
  gravity: 6,
  launchSpeed: [0.4, 0.8] as const, // upward speed at the jet's top
  landingRadius: [0.6, 0.8] as const, // clear of the 0.45 upper bowl, inside the basin
  waterY: 0.52, // basin water surface
  basinRadius: 0.85,
  opacity: 0.75,
  roughness: 0.2,
  seed: 0x5b1a54,
} as const;

export interface FountainSpray {
  group: Group;
  /** Poses the jet and droplets for time t (seconds). Deterministic, so any t can be sampled. */
  update(t: number): void;
}

interface Droplet {
  angle: number;
  launch: number; // upward speed
  radius: number; // landing distance from the jet
  flight: number; // seconds from jet top to water
  phase: number; // 0..1 offset along the loop
}

/** Time for a droplet launched upward at `launch` to fall from the jet top to the water. */
function flightTime(launch: number): number {
  const drop = SPRAY.jetBase + SPRAY.jetHeight - SPRAY.waterY;
  return (launch + Math.sqrt(launch * launch + 2 * SPRAY.gravity * drop)) / SPRAY.gravity;
}

function droplets(): Droplet[] {
  const rng = mulberry32(SPRAY.seed);
  const between = ([lo, hi]: readonly [number, number]) => lo + rng() * (hi - lo);
  return Array.from({ length: SPRAY.droplets }, (_, i) => {
    const launch = between(SPRAY.launchSpeed);
    return {
      angle: ((i + rng() * 0.6) / SPRAY.droplets) * Math.PI * 2,
      launch,
      radius: between(SPRAY.landingRadius),
      flight: flightTime(launch),
      phase: rng(),
    };
  });
}

export function buildFountainSpray(): FountainSpray {
  const material = flatMaterial(PALETTE.spray);
  material.transparent = true;
  material.opacity = SPRAY.opacity;
  material.roughness = SPRAY.roughness;

  const [top, bottom] = SPRAY.jetRadii;
  const jet = new Mesh(
    new CylinderGeometry(top, bottom, SPRAY.jetHeight, SPRAY.jetSegments).translate(0, SPRAY.jetHeight / 2, 0),
    material,
  );
  jet.position.y = SPRAY.jetBase;
  jet.userData.kind = 'fountain-jet';

  const drops = droplets();
  const batch = new InstancedMesh(new IcosahedronGeometry(SPRAY.dropletRadius, 0), material, drops.length);
  batch.userData.kind = 'fountain-spray';
  // Instances move every frame; a cached bounding sphere would cull them wrongly.
  batch.frustumCulled = false;

  for (const mesh of [jet, batch]) {
    mesh.castShadow = false;
    mesh.receiveShadow = true;
  }

  const group = new Group();
  group.name = 'fountain-spray';
  group.add(jet, batch);

  const matrix = new Matrix4();
  const launchY = SPRAY.jetBase + SPRAY.jetHeight;
  const update = (t: number): void => {
    jet.scale.y = 1 + SPRAY.jetPulse * Math.sin((t / SPRAY.jetPeriod) * Math.PI * 2);
    drops.forEach((d, i) => {
      const loop = (((t / d.flight + d.phase) % 1) + 1) % 1;
      const age = loop * d.flight;
      const r = (d.radius * age) / d.flight;
      const y = launchY + d.launch * age - 0.5 * SPRAY.gravity * age * age;
      matrix.makeTranslation(Math.cos(d.angle) * r, Math.max(y, SPRAY.waterY), Math.sin(d.angle) * r);
      batch.setMatrixAt(i, matrix);
    });
    batch.instanceMatrix.needsUpdate = true;
  };
  // Starting pose doubles as the frozen pose under reduced motion: droplets spread along their arcs.
  update(0);
  return { group, update };
}
