import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CanvasTexture, Color, Fog, MeshStandardMaterial, PointLight, Scene } from 'three';
import { createSky } from '../../src/garden/sky';
import { sunDirection } from '../../src/garden/sky-keyframes';

function fakeContext() {
  return {
    createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    fillRect: vi.fn(),
    fillStyle: '' as unknown,
  };
}

function setup() {
  const scene = new Scene();
  const glow = {
    nightLights: [new MeshStandardMaterial(), new MeshStandardMaterial()],
    lanterns: [new MeshStandardMaterial()],
    fountainLight: new PointLight('#ffffff', 0),
  };
  const sky = createSky(scene, glow);
  const glowMaterials = [...glow.nightLights, ...glow.lanterns];
  return { scene, glow, sky, glowMaterials };
}

describe('createSky', () => {
  let getContext: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    getContext = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockImplementation((() => fakeContext()) as unknown as HTMLCanvasElement['getContext']);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('adds the sun and hemisphere light to the scene', () => {
    const { scene, sky } = setup();
    expect(scene.children).toContain(sky.sun);
    expect(scene.children).toContain(sky.hemi);
  });

  it('configures one crisp sun shadow', () => {
    const { sky } = setup();
    const { shadow } = sky.sun;
    expect(sky.sun.castShadow).toBe(true);
    expect(shadow.mapSize.x).toBe(2048);
    expect(shadow.mapSize.y).toBe(2048);
    expect(shadow.camera.left).toBe(-9);
    expect(shadow.camera.right).toBe(9);
    expect(shadow.camera.top).toBe(9);
    expect(shadow.camera.bottom).toBe(-9);
    expect(shadow.bias).toBe(-0.0005);
  });

  it('lights midday at full sun with glows off', () => {
    const { sky, glow, glowMaterials } = setup();
    sky.apply(750);
    expect(sky.sun.intensity).toBe(2.4);
    for (const m of glowMaterials) expect(m.emissiveIntensity).toBe(0);
    expect(glow.fountainLight.intensity).toBe(0);
  });

  it('places the sun along sunDirection at distance 20', () => {
    const { sky } = setup();
    sky.apply(750);
    const [x, y, z] = sunDirection(750);
    expect(sky.sun.position.x).toBeCloseTo(x * 20);
    expect(sky.sun.position.y).toBeCloseTo(y * 20);
    expect(sky.sun.position.z).toBeCloseTo(z * 20);
  });

  it('turns glows up at midnight', () => {
    const { sky, glow, glowMaterials } = setup();
    sky.apply(0);
    for (const m of glowMaterials) expect(m.emissiveIntensity).toBeCloseTo(1.2);
    expect(glow.fountainLight.intensity).toBeCloseTo(1.5);
  });

  it('sets hemisphere colours and a far fog', () => {
    const { scene, sky } = setup();
    sky.apply(750);
    expect(sky.hemi.intensity).toBeCloseTo(0.8);
    expect(scene.fog).toBeInstanceOf(Fog);
    const fog = scene.fog as Fog;
    expect(fog.near).toBe(80);
    expect(fog.far).toBe(160);
    expect(fog.color.getHexString()).toBe(new Color('#dcecf5').getHexString());
  });

  it('paints a gradient background and reuses it while colours hold', () => {
    const { scene, sky } = setup();
    sky.apply(700);
    const first = scene.background;
    expect(first).toBeInstanceOf(CanvasTexture);
    sky.apply(750);
    expect(scene.background).toBe(first);
  });

  it('replaces and disposes the gradient when colours change', () => {
    const { scene, sky } = setup();
    sky.apply(750);
    const first = scene.background as CanvasTexture;
    const dispose = vi.spyOn(first, 'dispose');
    sky.apply(0);
    expect(scene.background).toBeInstanceOf(CanvasTexture);
    expect(scene.background).not.toBe(first);
    expect(dispose).toHaveBeenCalledOnce();
  });

  it('falls back to a flat colour when 2D canvas is unavailable', () => {
    getContext.mockImplementation((() => null) as unknown as HTMLCanvasElement['getContext']);
    const { scene, sky } = setup();
    expect(() => sky.apply(750)).not.toThrow();
    expect(scene.background).toBeInstanceOf(Color);
    expect((scene.background as Color).getHexString()).toBe(new Color('#e6f3fb').getHexString());
  });
});
