import { Color } from 'three';

export interface SkyState {
  sunColor: Color;
  sunIntensity: number;
  hemiSky: Color;
  hemiGround: Color;
  hemiIntensity: number;
  skyTop: Color;
  skyBottom: Color;
  fog: Color;
  nightFactor: number;
}

const MINUTES_PER_DAY = 1440;

const PRESETS = {
  night: {
    sunColor: '#9fb4ff', sunIntensity: 0.25,
    hemiSky: '#1d2a4a', hemiGround: '#0e1220', hemiIntensity: 0.35,
    skyTop: '#0b1530', skyBottom: '#2a3358', fog: '#1a2140', nightFactor: 1,
  },
  dawn: {
    sunColor: '#ffb38a', sunIntensity: 1.2,
    hemiSky: '#f6c9b0', hemiGround: '#6b5a4a', hemiIntensity: 0.6,
    skyTop: '#8fb7e0', skyBottom: '#f7c6a3', fog: '#e9c9b6', nightFactor: 0,
  },
  midday: {
    sunColor: '#fff4e0', sunIntensity: 2.4,
    hemiSky: '#cfe8ff', hemiGround: '#7a6a4f', hemiIntensity: 0.8,
    skyTop: '#7fc4ef', skyBottom: '#e6f3fb', fog: '#dcecf5', nightFactor: 0,
  },
  golden: {
    sunColor: '#ffaa55', sunIntensity: 1.6,
    hemiSky: '#f3c08a', hemiGround: '#6a4e36', hemiIntensity: 0.6,
    skyTop: '#6f8fcf', skyBottom: '#f9b67a', fog: '#efc193', nightFactor: 0,
  },
} as const;

type Preset = (typeof PRESETS)[keyof typeof PRESETS];

const KEYFRAMES: ReadonlyArray<{ minute: number; preset: Preset }> = [
  { minute: 0, preset: PRESETS.night },
  { minute: 330, preset: PRESETS.night },
  { minute: 390, preset: PRESETS.dawn },
  { minute: 600, preset: PRESETS.midday },
  { minute: 960, preset: PRESETS.midday },
  { minute: 1080, preset: PRESETS.golden },
  { minute: 1170, preset: PRESETS.night },
];

const COLOR_KEYS = ['sunColor', 'hemiSky', 'hemiGround', 'skyTop', 'skyBottom', 'fog'] as const;

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function mixColor(a: string, b: string, t: number): Color {
  return new Color().lerpColors(new Color(a), new Color(b), t);
}

function normalizedMinutes(minutes: number): number {
  return ((minutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
}

export function sampleSky(minutes: number): SkyState {
  const m = normalizedMinutes(minutes);
  const last = KEYFRAMES[KEYFRAMES.length - 1];
  const first = KEYFRAMES[0];

  let fromFrame = last;
  let toFrame = { minute: first.minute + MINUTES_PER_DAY, preset: first.preset };
  for (let i = 0; i < KEYFRAMES.length - 1; i++) {
    if (m >= KEYFRAMES[i].minute && m < KEYFRAMES[i + 1].minute) {
      fromFrame = KEYFRAMES[i];
      toFrame = KEYFRAMES[i + 1];
      break;
    }
  }

  const span = toFrame.minute - fromFrame.minute;
  const t = (m - fromFrame.minute) / span;
  const a = fromFrame.preset;
  const b = toFrame.preset;

  const colors = Object.fromEntries(
    COLOR_KEYS.map((k) => [k, mixColor(a[k], b[k], t)]),
  ) as Record<(typeof COLOR_KEYS)[number], Color>;

  return {
    ...colors,
    sunIntensity: lerp(a.sunIntensity, b.sunIntensity, t),
    hemiIntensity: lerp(a.hemiIntensity, b.hemiIntensity, t),
    nightFactor: lerp(a.nightFactor, b.nightFactor, t),
  };
}

const SUNRISE_MINUTE = 360;
const SUNSET_MINUTE = 1140;
const MOON: [number, number, number] = normalize([-0.4, 0.8, 0.3]);

function normalize([x, y, z]: [number, number, number]): [number, number, number] {
  const len = Math.hypot(x, y, z);
  return [x / len, y / len, z / len];
}

export function sunDirection(minutes: number): [number, number, number] {
  const m = normalizedMinutes(minutes);
  if (m < SUNRISE_MINUTE || m > SUNSET_MINUTE) return [...MOON];
  const t = ((m - SUNRISE_MINUTE) / (SUNSET_MINUTE - SUNRISE_MINUTE)) * Math.PI;
  return normalize([Math.cos(t), Math.sin(t), 0.45]);
}
