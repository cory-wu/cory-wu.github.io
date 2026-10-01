import { describe, expect, it } from 'vitest';
import { Object3D, Points, Scene } from 'three';
import type { MeshStandardMaterial, WebGLProgramParametersWithUniforms, WebGLRenderer } from 'three';
import { createAmbient, wrapCloud } from '../../src/garden/ambient';
import { buildDiorama } from '../../src/garden/diorama';

function setup(reducedMotion: boolean) {
  const scene = new Scene();
  const diorama = buildDiorama();
  scene.add(diorama.group);
  const before = scene.children.length;
  const ambient = createAmbient(scene, diorama, { reducedMotion });
  return { scene, diorama, ambient, before };
}

function fakeShader(): WebGLProgramParametersWithUniforms {
  return {
    uniforms: {},
    vertexShader: 'void main() {\n#include <begin_vertex>\n#include <project_vertex>\n}',
    fragmentShader: 'void main() {}',
  } as unknown as WebGLProgramParametersWithUniforms;
}

function compile(material: MeshStandardMaterial): WebGLProgramParametersWithUniforms {
  const shader = fakeShader();
  material.onBeforeCompile(shader, {} as WebGLRenderer);
  return shader;
}

function byName(scene: Scene, name: string): Object3D {
  const found = scene.getObjectByName(name);
  if (!found) throw new Error(`missing ${name}`);
  return found;
}

describe('wrapCloud', () => {
  it('wraps into [-15, 15)', () => {
    expect(wrapCloud(15.1)).toBeCloseTo(-14.9);
    expect(wrapCloud(-15.2)).toBeCloseTo(14.8);
    expect(wrapCloud(3)).toBe(3);
    expect(wrapCloud(15)).toBeCloseTo(-15);
  });

  it('honours a custom span', () => {
    expect(wrapCloud(6, 10)).toBeCloseTo(-4);
  });
});

describe('createAmbient with reduced motion', () => {
  it('adds nothing to the scene', () => {
    const { scene, before } = setup(true);
    expect(scene.children.length).toBe(before);
  });

  it('leaves materials untouched on update', () => {
    const { diorama, ambient } = setup(true);
    const snapshot = diorama.water.map((m) => [m.color.getHex(), m.roughness]);
    ambient.update(10, 1);
    expect(diorama.water.map((m) => [m.color.getHex(), m.roughness])).toEqual(snapshot);
    for (const m of diorama.sway) {
      expect(m.userData.uniforms).toBeUndefined();
      const shader = compile(m);
      expect(shader.uniforms.uTime).toBeUndefined();
      expect(shader.vertexShader).not.toContain('uTime');
    }
  });
});

describe('createAmbient with motion', () => {
  it('adds a clouds group that drifts in +x', () => {
    const { scene, ambient, before } = setup(false);
    expect(scene.children.length).toBeGreaterThan(before);
    const clouds = byName(scene, 'clouds');
    expect(clouds.children).toHaveLength(3);
    ambient.update(0, 0);
    const start = clouds.children.map((c) => c.position.x);
    ambient.update(10, 0);
    const moved = clouds.children.map((c) => c.position.x);
    moved.forEach((x, i) => expect(x).toBeCloseTo(wrapCloud(start[i] + 3)));
    for (const c of clouds.children) expect(c.position.y).toBeCloseTo(7, 0);
  });

  it('patches each sway material with a uTime uniform and a bend', () => {
    const { diorama, ambient } = setup(false);
    const keys = new Set<string>();
    for (const m of diorama.sway) {
      const shader = compile(m);
      expect(shader.uniforms.uTime).toBeDefined();
      expect(shader.uniforms.uSwayHeight).toBeDefined();
      expect(shader.vertexShader).toContain('uniform float uTime;');
      expect(shader.vertexShader).toContain('instanceMatrix[3].xyz');
      expect(shader.vertexShader).toContain('#ifdef USE_INSTANCING');
      expect(shader.vertexShader.indexOf('#include <begin_vertex>')).toBeLessThan(
        shader.vertexShader.indexOf('sin(uTime * 1.3'),
      );
      keys.add(m.customProgramCacheKey());
      ambient.update(5, 0);
      expect(shader.uniforms.uTime.value).toBe(5);
    }
    expect(keys.size).toBe(2);
  });

  it('normalizes sway by each plant height', () => {
    const { diorama } = setup(false);
    const [cypress, lavender] = diorama.sway.map((m) => compile(m).uniforms.uSwayHeight.value as number);
    expect(cypress).toBeCloseTo(2.6);
    expect(lavender).toBeGreaterThan(0.1);
    expect(lavender).toBeLessThan(0.5);
  });

  it('shimmers water around its base colour without drift', () => {
    const { diorama, ambient } = setup(false);
    const base = diorama.water.map((m) => m.color.getHSL({ h: 0, s: 0, l: 0 }).l);
    const seen = new Set<number>();
    for (let t = 0; t < 20; t += 0.7) {
      ambient.update(t, 0);
      diorama.water.forEach((m, i) => {
        const l = m.color.getHSL({ h: 0, s: 0, l: 0 }).l;
        expect(Math.abs(l - base[i])).toBeLessThanOrEqual(0.0301);
        seen.add(Math.round(m.roughness * 1000));
      });
    }
    expect(seen.size).toBeGreaterThan(1);
    ambient.update(3, 0);
    const a = diorama.water.map((m) => [m.color.getHex(), m.roughness]);
    ambient.update(17, 0);
    ambient.update(3, 0);
    expect(diorama.water.map((m) => [m.color.getHex(), m.roughness])).toEqual(a);
  });

  it('shows butterflies by day and fireflies at night', () => {
    const { scene, ambient } = setup(false);
    const butterflies = byName(scene, 'butterflies');
    const fireflies = byName(scene, 'fireflies');
    expect(byName(scene, 'critters').children).toEqual(expect.arrayContaining([butterflies, fireflies]));
    expect(butterflies.children).toHaveLength(3);
    expect(fireflies).toBeInstanceOf(Points);
    expect((fireflies as Points).geometry.getAttribute('position').count).toBe(12);

    ambient.update(1, 0.2);
    expect(butterflies.visible).toBe(true);
    expect(fireflies.visible).toBe(false);
    ambient.update(2, 0.5);
    expect(butterflies.visible).toBe(false);
    expect(fireflies.visible).toBe(true);
  });

  it('flaps butterfly wings over time', () => {
    const { scene, ambient } = setup(false);
    const wing = byName(scene, 'butterflies').children[0].children[0];
    ambient.update(0.1, 0);
    const a = wing.rotation.z;
    ambient.update(0.2, 0);
    expect(wing.rotation.z).not.toBeCloseTo(a);
  });
});
