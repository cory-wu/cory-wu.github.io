import { Group, PointLight } from 'three';
import type { MeshStandardMaterial } from 'three';
import { buildCourtyard } from './courtyard';
import { buildEarth } from './earth';
import { buildFountain, FOUNTAIN_POSITION } from './fountain';
import { buildHedges } from './hedges';
import { buildPool } from './pool';

export interface Diorama {
  group: Group;
  water: MeshStandardMaterial[];
  sway: MeshStandardMaterial[];
  lanterns: MeshStandardMaterial[];
  fountainLight: PointLight;
}

const FOUNTAIN_LIGHT = { color: '#ffd9a0', distance: 6, height: 1.4 } as const;

export function buildDiorama(): Diorama {
  const group = new Group();
  const fountain = buildFountain();
  const pool = buildPool();
  group.add(buildEarth(), buildHedges(), buildCourtyard(), fountain, pool);

  const fountainLight = new PointLight(FOUNTAIN_LIGHT.color, 0, FOUNTAIN_LIGHT.distance);
  fountainLight.position.set(FOUNTAIN_POSITION[0], FOUNTAIN_LIGHT.height, FOUNTAIN_POSITION[1]);
  group.add(fountainLight);

  return {
    group,
    water: [fountain.userData.water as MeshStandardMaterial, pool.userData.water as MeshStandardMaterial],
    sway: [],
    lanterns: [],
    fountainLight,
  };
}
