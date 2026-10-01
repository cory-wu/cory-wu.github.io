import { CanvasTexture, Color, DirectionalLight, Fog, HemisphereLight, SRGBColorSpace } from 'three';
import type { MeshStandardMaterial, PointLight, Scene } from 'three';
import { sampleSky, sunDirection } from './sky-keyframes';

export interface SkyGlow {
  nightLights: MeshStandardMaterial[];
  lanterns: MeshStandardMaterial[];
  fountainLight: PointLight;
}

export interface Sky {
  sun: DirectionalLight;
  hemi: HemisphereLight;
  apply(minutes: number): void;
}

const SUN_DISTANCE = 20;
const SHADOW = { mapSize: 2048, bound: 9, near: 1, far: 50, bias: -0.0005 } as const;
const FOG = { near: 80, far: 160 } as const;
const GLOW_EMISSIVE = 1.2;
const FOUNTAIN_INTENSITY = 1.5;
const GRADIENT = { width: 2, height: 256 } as const;
const COLOR_EPSILON = 1 / 255;

function createSun(): DirectionalLight {
  const sun = new DirectionalLight('#ffffff', 0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(SHADOW.mapSize, SHADOW.mapSize);
  const cam = sun.shadow.camera;
  cam.left = -SHADOW.bound;
  cam.right = SHADOW.bound;
  cam.top = SHADOW.bound;
  cam.bottom = -SHADOW.bound;
  cam.near = SHADOW.near;
  cam.far = SHADOW.far;
  cam.updateProjectionMatrix();
  sun.shadow.bias = SHADOW.bias;
  return sun;
}

function colorsDiffer(a: Color, b: Color): boolean {
  return Math.max(Math.abs(a.r - b.r), Math.abs(a.g - b.g), Math.abs(a.b - b.b)) > COLOR_EPSILON;
}

/** Vertical skyTop -> skyBottom gradient, or null where 2D canvas is unavailable (e.g. jsdom). */
function paintGradient(top: Color, bottom: Color): CanvasTexture | null {
  const canvas = document.createElement('canvas');
  canvas.width = GRADIENT.width;
  canvas.height = GRADIENT.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const gradient = ctx.createLinearGradient(0, 0, 0, GRADIENT.height);
  gradient.addColorStop(0, top.getStyle());
  gradient.addColorStop(1, bottom.getStyle());
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, GRADIENT.width, GRADIENT.height);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

export function createSky(scene: Scene, glow: SkyGlow): Sky {
  const sun = createSun();
  const hemi = new HemisphereLight('#ffffff', '#000000', 0);
  scene.add(sun, sun.target, hemi);
  const fog = new Fog('#ffffff', FOG.near, FOG.far);
  scene.fog = fog;
  const glowMaterials = [...glow.nightLights, ...glow.lanterns];

  let gradient: CanvasTexture | null = null;
  let painted: { top: Color; bottom: Color } | null = null;

  function applyBackground(top: Color, bottom: Color): void {
    if (painted && !colorsDiffer(painted.top, top) && !colorsDiffer(painted.bottom, bottom)) return;
    const next = paintGradient(top, bottom);
    gradient?.dispose();
    gradient = next;
    painted = { top: top.clone(), bottom: bottom.clone() };
    scene.background = next ?? bottom.clone();
  }

  function apply(minutes: number): void {
    const state = sampleSky(minutes);
    const [x, y, z] = sunDirection(minutes);
    sun.position.set(x * SUN_DISTANCE, y * SUN_DISTANCE, z * SUN_DISTANCE);
    sun.color.copy(state.sunColor);
    sun.intensity = state.sunIntensity;
    hemi.color.copy(state.hemiSky);
    hemi.groundColor.copy(state.hemiGround);
    hemi.intensity = state.hemiIntensity;
    fog.color.copy(state.fog);
    applyBackground(state.skyTop, state.skyBottom);
    for (const m of glowMaterials) m.emissiveIntensity = state.nightFactor * GLOW_EMISSIVE;
    glow.fountainLight.intensity = state.nightFactor * FOUNTAIN_INTENSITY;
  }

  return { sun, hemi, apply };
}
