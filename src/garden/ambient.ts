import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  DataTexture,
  DoubleSide,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Mesh,
  PlaneGeometry,
  Points,
  PointsMaterial,
} from 'three';
import type { HSL, MeshStandardMaterial, Object3D, Scene } from 'three';
import type { Diorama } from './diorama';
import { mergedMesh, placed } from './diorama/parts';
import { mulberry32 } from './diorama/random';
import type { Rng } from './diorama/random';
import { PALETTE, flatMaterial } from './palette';

export interface Ambient {
  update(elapsed: number, nightFactor: number): void;
}

const NIGHT_THRESHOLD = 0.5;
const SWAY_HEIGHT_FALLBACK = 1;
const WATER = { lightness: 0.03, roughness: 0.08, lightRate: 0.9, roughRate: 1.3 } as const;
const CLOUDS = { count: 3, y: 7, speed: 0.3, span: 30, puffs: 4, seed: 0xc10d5 } as const;
const BUTTERFLIES = {
  count: 3, center: [0.2, -3.45] as const, radius: 0.9, height: 0.65,
  speed: 0.5, flapRate: 14, flapAngle: 0.9, wing: [0.18, 0.13] as const,
} as const;
const FIREFLIES = { count: 12, size: 0.7, half: 5, minY: 0.3, rangeY: 1.2, drift: 0.25, seed: 0xf1ef1 } as const;
const SPRITE_SIZE = 16;

/** Maps x into [-span/2, span/2) so drifting clouds re-enter on the far side. */
export function wrapCloud(x: number, span = 30): number {
  const half = span / 2;
  return ((((x + half) % span) + span) % span) - half;
}

/** Height of the (instanced) geometry drawn with `material`, used to normalize the bend. */
function swayHeight(root: Object3D, material: MeshStandardMaterial): number {
  let height = SWAY_HEIGHT_FALLBACK;
  root.traverse((o) => {
    if (!(o instanceof InstancedMesh) || o.material !== material) return;
    o.geometry.computeBoundingBox();
    height = o.geometry.boundingBox?.max.y ?? height;
  });
  return height;
}

const SWAY_CHUNK = /* glsl */ `#include <begin_vertex>
#ifdef USE_INSTANCING
  vec3 swayBase = instanceMatrix[3].xyz;
#else
  vec3 swayBase = vec3(0.0);
#endif
  float swayH = clamp(position.y / uSwayHeight, 0.0, 1.0);
  float swayBend = sin(uTime * 1.3 + swayBase.x * 1.7 + swayBase.z * 1.1) * 0.04 * swayH * swayH;
  transformed.x += swayBend;
  transformed.z += swayBend * 0.6;`;

function patchSway(material: MeshStandardMaterial, height: number, key: number): { value: number } {
  const uniforms = { uTime: { value: 0 }, uSwayHeight: { value: height } };
  material.userData.uniforms = uniforms;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.uniforms.uSwayHeight = uniforms.uSwayHeight;
    shader.vertexShader =
      'uniform float uTime;\nuniform float uSwayHeight;\n' +
      shader.vertexShader.replace('#include <begin_vertex>', SWAY_CHUNK);
  };
  material.customProgramCacheKey = () => `garden-sway-${key}`;
  material.needsUpdate = true;
  return uniforms.uTime;
}

function waterShimmer(materials: MeshStandardMaterial[]): (t: number) => void {
  const bases = materials.map((m) => ({ hsl: m.color.getHSL({ h: 0, s: 0, l: 0 } as HSL), roughness: m.roughness }));
  return (t) => {
    materials.forEach((m, i) => {
      const { hsl, roughness } = bases[i];
      m.color.setHSL(hsl.h, hsl.s, hsl.l + Math.sin(t * WATER.lightRate + i * 2) * WATER.lightness);
      m.roughness = roughness + Math.sin(t * WATER.roughRate + i) * WATER.roughness;
    });
  };
}

function buildCloud(rng: Rng): Mesh {
  const puffs = Array.from({ length: CLOUDS.puffs }, (_, i) => {
    const r = 0.5 + rng() * 0.4;
    return placed(new IcosahedronGeometry(r, 0), (i - 1.5) * 0.7, rng() * 0.3, (rng() - 0.5) * 0.6);
  });
  const mesh = mergedMesh(puffs, flatMaterial(PALETTE.cloud), 'cloud');
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  return mesh;
}

function buildClouds(): { group: Group; update(t: number): void } {
  const rng = mulberry32(CLOUDS.seed);
  const group = new Group();
  group.name = 'clouds';
  const baseX = Array.from({ length: CLOUDS.count }, (_, i) => -CLOUDS.span / 3 + i * (CLOUDS.span / 3) + rng() * 3);
  for (let i = 0; i < CLOUDS.count; i++) {
    const cloud = buildCloud(rng);
    cloud.position.set(baseX[i], CLOUDS.y + (rng() - 0.5), -9 + rng() * 3);
    group.add(cloud);
  }
  return {
    group,
    update: (t) => {
      group.children.forEach((c, i) => {
        c.position.x = wrapCloud(baseX[i] + t * CLOUDS.speed, CLOUDS.span);
      });
    },
  };
}

function buildButterfly(color: string): Group {
  const [w, d] = BUTTERFLIES.wing;
  const material = flatMaterial(color);
  material.side = DoubleSide;
  const wingGeo = (dir: number) => new PlaneGeometry(w, d).rotateX(-Math.PI / 2).translate((dir * w) / 2, 0, 0);
  const butterfly = new Group();
  butterfly.add(new Mesh(wingGeo(1), material), new Mesh(wingGeo(-1), material));
  return butterfly;
}

function buildButterflies(): { group: Group; update(t: number): void } {
  const group = new Group();
  group.name = 'butterflies';
  const colors = [PALETTE.butterflyLemon, PALETTE.butterflyRose, PALETTE.flowerWhite];
  for (const c of colors.slice(0, BUTTERFLIES.count)) group.add(buildButterfly(c));
  const [cx, cz] = BUTTERFLIES.center;
  return {
    group,
    update: (t) => {
      group.children.forEach((b, i) => {
        const a = t * BUTTERFLIES.speed * (1 + i * 0.2) + (i * Math.PI * 2) / BUTTERFLIES.count;
        const r = BUTTERFLIES.radius * (0.7 + 0.3 * Math.sin(t * 0.7 + i));
        b.position.set(cx + Math.cos(a) * r, BUTTERFLIES.height + Math.sin(t * 2.3 + i) * 0.12, cz + Math.sin(a) * r);
        b.rotation.y = -a;
        const flap = Math.sin(t * BUTTERFLIES.flapRate + i) * BUTTERFLIES.flapAngle;
        b.children[0].rotation.z = flap;
        b.children[1].rotation.z = -flap;
      });
    },
  };
}

/** Soft round sprite built from raw pixels, so it needs no 2D canvas. */
function glowSprite(): DataTexture {
  const data = new Uint8Array(SPRITE_SIZE * SPRITE_SIZE * 4);
  const mid = (SPRITE_SIZE - 1) / 2;
  for (let y = 0; y < SPRITE_SIZE; y++) {
    for (let x = 0; x < SPRITE_SIZE; x++) {
      const falloff = Math.max(0, 1 - Math.hypot(x - mid, y - mid) / mid);
      data.set([255, 255, 255, Math.round(falloff * falloff * 255)], (y * SPRITE_SIZE + x) * 4);
    }
  }
  const texture = new DataTexture(data, SPRITE_SIZE, SPRITE_SIZE);
  texture.needsUpdate = true;
  return texture;
}

function buildFireflies(): { points: Points; update(t: number): void } {
  const rng = mulberry32(FIREFLIES.seed);
  const base = Float32Array.from({ length: FIREFLIES.count * 3 }, (_, k) =>
    k % 3 === 1 ? FIREFLIES.minY + rng() * FIREFLIES.rangeY : (rng() * 2 - 1) * FIREFLIES.half,
  );
  const position = new BufferAttribute(base.slice(), 3);
  const geometry = new BufferGeometry().setAttribute('position', position);
  const material = new PointsMaterial({
    color: PALETTE.firefly, size: FIREFLIES.size, sizeAttenuation: true, map: glowSprite(),
    transparent: true, depthWrite: false, blending: AdditiveBlending,
  });
  const points = new Points(geometry, material);
  points.name = 'fireflies';
  return {
    points,
    update: (t) => {
      for (let i = 0; i < FIREFLIES.count; i++) {
        position.setXYZ(
          i,
          base[i * 3] + Math.sin(t * 0.6 + i) * FIREFLIES.drift,
          base[i * 3 + 1] + Math.sin(t * 0.9 + i * 2) * FIREFLIES.drift * 0.6,
          base[i * 3 + 2] + Math.cos(t * 0.5 + i * 1.3) * FIREFLIES.drift,
        );
      }
      position.needsUpdate = true;
    },
  };
}

function buildCritters(): { group: Group; update(t: number, nightFactor: number): void } {
  const butterflies = buildButterflies();
  const fireflies = buildFireflies();
  const group = new Group();
  group.name = 'critters';
  group.add(butterflies.group, fireflies.points);
  const showNight = (night: boolean) => {
    butterflies.group.visible = !night;
    fireflies.points.visible = night;
  };
  showNight(false);
  return {
    group,
    update: (t, nightFactor) => {
      const night = nightFactor >= NIGHT_THRESHOLD;
      showNight(night);
      if (night) fireflies.update(t);
      else butterflies.update(t);
    },
  };
}

export function createAmbient(scene: Scene, diorama: Diorama, opts: { reducedMotion: boolean }): Ambient {
  if (opts.reducedMotion) return { update: () => {} };

  const swayTimes = diorama.sway.map((m, i) => patchSway(m, swayHeight(diorama.group, m), i));
  const shimmer = waterShimmer(diorama.water);
  const clouds = buildClouds();
  const critters = buildCritters();
  scene.add(clouds.group, critters.group);

  return {
    update: (elapsed, nightFactor) => {
      for (const uTime of swayTimes) uTime.value = elapsed;
      shimmer(elapsed);
      clouds.update(elapsed);
      critters.update(elapsed, nightFactor);
    },
  };
}
