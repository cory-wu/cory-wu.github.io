import { Color, ConeGeometry, CylinderGeometry, Euler, Group, IcosahedronGeometry, InstancedMesh, Matrix4, Quaternion, Vector3 } from 'three';
import type { BufferGeometry } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { PALETTE, flatMaterial } from '../palette';
import { POOL_WATER } from './pool';
import { rippleHeight } from './pool-ripples';

/** Positions are in the pool's local frame: origin at the water's centre, y in diorama units. */
export const POOL_LIFE = {
  margin: 0.15, // koi keep this far from the rim
  wiggle: 0.15, // radians of tail-driven yaw either side of the path
  wiggleRate: 6,
  koiDepth: 0.012, // body centre below the surface; the back breaks the water
  koi: [
    { radii: [0.55, 3.4], speed: 0.18, phase: 0, color: PALETTE.koiOrange },
    { radii: [0.45, 2.8], speed: 0.23, phase: 2.1, color: PALETTE.koiPale },
    { radii: [0.6, 3.0], speed: -0.2, phase: 4.0, color: PALETTE.koiGold },
  ],
  pads: [
    { at: [-0.5, 2.6], r: 0.22, flower: true },
    { at: [0.45, 1.4], r: 0.26 },
    { at: [-0.35, -1.2], r: 0.18 },
    { at: [0.5, -2.5], r: 0.24, flower: true },
    { at: [-0.4, -3.6], r: 0.2 },
  ],
  padDrift: 0.12, // radius of each pad's slow circle
  padDriftSpeed: 0.12,
  padFloat: 0.006, // pad centre above the rippled surface
  flowerSize: 0.05,
  flowerLift: 0.03,
} as const;

export interface PoolLife {
  group: Group;
  /** Poses koi and pads for time t (seconds). Deterministic, so any t can be sampled. */
  update(t: number): void;
}

/** A faceted body plus a tail fin, nose along +z, about 0.33 long. */
function koiGeometry(): BufferGeometry {
  const body = new IcosahedronGeometry(1, 0).scale(0.09, 0.045, 0.18);
  const tail = new ConeGeometry(0.075, 0.13, 3).rotateX(-Math.PI / 2).scale(1, 0.4, 1).translate(0, 0, -0.22);
  const merged = mergeGeometries([body, tail.toNonIndexed()]);
  if (!merged) throw new Error('could not merge koi geometry');
  return merged;
}

function batch(geometry: BufferGeometry, color: string, count: number, kind: string): InstancedMesh {
  const mesh = new InstancedMesh(geometry, flatMaterial(color), count);
  mesh.userData.kind = kind;
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  // Instances move every frame; a cached bounding sphere would cull them wrongly.
  mesh.frustumCulled = false;
  return mesh;
}

export function buildPoolLife(): PoolLife {
  const koi = batch(koiGeometry(), '#ffffff', POOL_LIFE.koi.length, 'koi');
  POOL_LIFE.koi.forEach((k, i) => koi.setColorAt(i, new Color(k.color)));

  const pads = batch(new CylinderGeometry(1, 1, 0.012, 10), PALETTE.lilyPad, POOL_LIFE.pads.length, 'lily-pad');
  const flowering = POOL_LIFE.pads.filter((p) => 'flower' in p && p.flower);
  const flowers = batch(new IcosahedronGeometry(1, 0), PALETTE.flowerPink, flowering.length, 'lily-flower');

  const group = new Group();
  group.name = 'pool-life';
  group.position.set((POOL_WATER.x[0] + POOL_WATER.x[1]) / 2, 0, (POOL_WATER.z[0] + POOL_WATER.z[1]) / 2);
  group.add(koi, pads, flowers);

  const matrix = new Matrix4();
  const position = new Vector3();
  const rotation = new Quaternion();
  const euler = new Euler();
  const scale = new Vector3();

  const update = (t: number): void => {
    POOL_LIFE.koi.forEach((k, i) => {
      const [rx, rz] = k.radii;
      const a = k.phase + k.speed * t;
      const dir = Math.sign(k.speed);
      // Tangent of the ellipse in the direction of travel.
      const heading = Math.atan2(-rx * Math.sin(a) * dir, rz * Math.cos(a) * dir);
      const yaw = heading + POOL_LIFE.wiggle * Math.sin(t * POOL_LIFE.wiggleRate + i * 1.7);
      position.set(rx * Math.cos(a), POOL_WATER.y - POOL_LIFE.koiDepth, rz * Math.sin(a));
      rotation.setFromEuler(euler.set(0, yaw, 0));
      koi.setMatrixAt(i, matrix.compose(position, rotation, scale.set(1, 1, 1)));
    });

    let f = 0;
    POOL_LIFE.pads.forEach((p, i) => {
      const a = i * 1.3 + POOL_LIFE.padDriftSpeed * t * (i % 2 === 0 ? 1 : -1);
      const x = p.at[0] + POOL_LIFE.padDrift * Math.cos(a);
      const z = p.at[1] + POOL_LIFE.padDrift * Math.sin(a);
      const y = POOL_WATER.y + rippleHeight(x, z, t) + POOL_LIFE.padFloat;
      rotation.setFromEuler(euler.set(0, a * 0.5, 0));
      pads.setMatrixAt(i, matrix.compose(position.set(x, y, z), rotation, scale.set(p.r, 1, p.r)));
      if ('flower' in p && p.flower) {
        const s = POOL_LIFE.flowerSize;
        flowers.setMatrixAt(f++, matrix.compose(position.set(x, y + POOL_LIFE.flowerLift, z), rotation, scale.set(s, s, s)));
      }
    });

    for (const m of [koi, pads, flowers]) m.instanceMatrix.needsUpdate = true;
  };
  // Starting pose doubles as the frozen pose under reduced motion.
  update(0);
  return { group, update };
}
