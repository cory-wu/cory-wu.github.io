import { Group, PointLight } from 'three';
import type { MeshStandardMaterial } from 'three';
import { buildCourtyard } from './courtyard';
import { buildEarth } from './earth';
import { buildFountain, FOUNTAIN_POSITION } from './fountain';
import { buildFountainSpray } from './fountain-spray';
import type { FountainSpray } from './fountain-spray';
import { buildHedges } from './hedges';
import { buildPool } from './pool';
import { buildCypresses } from './cypresses';
import { buildLanterns } from './lanterns';
import { buildLavender } from './lavender';
import { buildPergola } from './pergola';
import { buildBenches, buildPots } from './props';
import { mulberry32 } from './random';
import { buildTrees } from './trees';
import { PALETTE } from '../palette';

export interface Diorama {
  group: Group;
  water: MeshStandardMaterial[];
  sway: MeshStandardMaterial[];
  lanterns: MeshStandardMaterial[];
  fountainLight: PointLight;
  fountainSpray: FountainSpray;
}

const LAYOUT_SEED = 0x6a7d3e;
const FOUNTAIN_LIGHT = { color: PALETTE.fountainGlow, distance: 6, height: 1.4 } as const;

export function buildDiorama(): Diorama {
  const group = new Group();
  const fountain = buildFountain();
  const pool = buildPool();
  const rng = mulberry32(LAYOUT_SEED);
  const cypresses = buildCypresses(rng);
  const lavender = buildLavender(rng);
  const lanterns = buildLanterns();
  group.add(buildEarth(), buildHedges(), buildCourtyard(), fountain, pool);
  group.add(cypresses.mesh, lavender.mesh, buildPergola(rng), buildBenches(), buildPots(), buildTrees(), lanterns.group);

  const fountainLight = new PointLight(FOUNTAIN_LIGHT.color, 0, FOUNTAIN_LIGHT.distance);
  fountainLight.position.set(FOUNTAIN_POSITION[0], FOUNTAIN_LIGHT.height, FOUNTAIN_POSITION[1]);
  group.add(fountainLight);

  const fountainSpray = buildFountainSpray();
  fountainSpray.group.position.set(FOUNTAIN_POSITION[0], 0, FOUNTAIN_POSITION[1]);
  group.add(fountainSpray.group);

  return {
    group,
    water: [fountain.userData.water as MeshStandardMaterial, pool.userData.water as MeshStandardMaterial],
    sway: [cypresses.material, lavender.material],
    lanterns: [lanterns.glass],
    fountainLight,
    fountainSpray,
  };
}
