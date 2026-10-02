import { describe, expect, it } from 'vitest';
import { InstancedMesh, Matrix4, Mesh, MeshStandardMaterial, PlaneGeometry, Quaternion, Scene, Vector3 } from 'three';
import type { WebGLProgramParametersWithUniforms } from 'three';
import { createAmbient } from '../../src/garden/ambient';
import { buildDiorama } from '../../src/garden/diorama';
import { POOL_WATER } from '../../src/garden/diorama/pool';
import { POOL_LIFE, buildPoolLife } from '../../src/garden/diorama/pool-life';
import { RIPPLE, patchRipples, rippleHeight } from '../../src/garden/diorama/pool-ripples';

const [X0, X1] = POOL_WATER.x;
const [Z0, Z1] = POOL_WATER.z;
const CENTER = { x: (X0 + X1) / 2, z: (Z0 + Z1) / 2 };

interface Pose {
  position: Vector3;
  quaternion: Quaternion;
  scale: Vector3;
}

function poses(mesh: InstancedMesh): Pose[] {
  const m = new Matrix4();
  return Array.from({ length: mesh.count }, (_, i) => {
    mesh.getMatrixAt(i, m);
    const pose = { position: new Vector3(), quaternion: new Quaternion(), scale: new Vector3() };
    m.decompose(pose.position, pose.quaternion, pose.scale);
    return pose;
  });
}

function byKind(root: { traverse(cb: (o: unknown) => void): void }, kind: string): InstancedMesh {
  let found: InstancedMesh | undefined;
  root.traverse((o) => {
    if (o instanceof InstancedMesh && o.userData.kind === kind) found = o;
  });
  if (!found) throw new Error(`no ${kind}`);
  return found;
}

describe('rippleHeight', () => {
  it('stays within ±RIPPLE.amplitude everywhere on the pool over time', () => {
    let max = 0;
    for (let t = 0; t < 20; t += 0.37) {
      for (let x = -1; x <= 1; x += 0.25) {
        for (let z = -4.25; z <= 4.25; z += 0.5) max = Math.max(max, Math.abs(rippleHeight(x, z, t)));
      }
    }
    expect(RIPPLE.amplitude).toBe(0.012);
    expect(max).toBeLessThanOrEqual(RIPPLE.amplitude + 1e-9);
    expect(max).toBeGreaterThan(RIPPLE.amplitude / 2);
  });

  it('changes with time', () => {
    expect(rippleHeight(0.3, 1.1, 0)).not.toBeCloseTo(rippleHeight(0.3, 1.1, 1.5), 4);
  });
});

describe('patchRipples', () => {
  it('injects the time and amplitude uniforms and displaces after begin_vertex', () => {
    const material = new MeshStandardMaterial();
    const uTime = patchRipples(material);
    const shader = {
      uniforms: {},
      vertexShader: 'void main() {\n#include <begin_vertex>\n}',
    } as unknown as WebGLProgramParametersWithUniforms;
    material.onBeforeCompile(shader, undefined as never);
    expect(shader.uniforms.uTime).toBe(uTime);
    expect(shader.uniforms.uRippleAmp.value).toBe(RIPPLE.amplitude);
    expect(shader.vertexShader).toContain('uniform float uTime;');
    expect(shader.vertexShader).toMatch(/#include <begin_vertex>[\s\S]*transformed\.y \+=/);
    expect(material.customProgramCacheKey()).toBe('garden-pool-ripple');
  });
});

describe('pool surface', () => {
  it('is a subdivided, flat-shaded grid that receives but does not cast shadows', () => {
    const d = buildDiorama();
    let surface: Mesh | undefined;
    d.group.traverse((o) => {
      if (o instanceof Mesh && o.userData.kind === 'pool') surface = o;
    });
    expect(surface?.geometry).toBeInstanceOf(PlaneGeometry);
    const { widthSegments, heightSegments } = (surface!.geometry as PlaneGeometry).parameters;
    expect(widthSegments * heightSegments).toBeGreaterThanOrEqual(8 * 32);
    expect((surface!.material as MeshStandardMaterial).flatShading).toBe(true);
    expect(surface!.castShadow).toBe(false);
    expect(surface!.receiveShadow).toBe(true);
  });
});

describe('buildPoolLife', () => {
  it('has three koi in three colours, five lily pads and two flowers, none casting shadows', () => {
    const life = buildPoolLife();
    const koi = byKind(life.group, 'koi');
    const pads = byKind(life.group, 'lily-pad');
    const flowers = byKind(life.group, 'lily-flower');
    expect([koi.count, pads.count, flowers.count]).toEqual([3, 5, 2]);
    expect(koi.instanceColor).not.toBeNull();
    const colours = new Set(Array.from({ length: 3 }, (_, i) => koi.instanceColor!.getX(i).toFixed(3)));
    expect(colours.size).toBe(3);
    for (const m of [koi, pads, flowers]) {
      expect(m.castShadow).toBe(false);
      expect(m.receiveShadow).toBe(true);
      expect((m.material as MeshStandardMaterial).flatShading).toBe(true);
    }
  });

  it('keeps koi, pads and flowers inside the pool rim at all times', () => {
    const life = buildPoolLife();
    const koi = byKind(life.group, 'koi');
    const pads = byKind(life.group, 'lily-pad');
    const flowers = byKind(life.group, 'lily-flower');
    for (let t = 0; t < 60; t += 0.5) {
      life.update(t);
      for (const { position } of poses(koi)) {
        expect(Math.abs(position.x)).toBeLessThanOrEqual((X1 - X0) / 2 - POOL_LIFE.margin);
        expect(Math.abs(position.z)).toBeLessThanOrEqual((Z1 - Z0) / 2 - POOL_LIFE.margin);
      }
      for (const { position, scale } of [...poses(pads), ...poses(flowers)]) {
        expect(Math.abs(position.x) + scale.x).toBeLessThanOrEqual((X1 - X0) / 2);
        expect(Math.abs(position.z) + scale.z).toBeLessThanOrEqual((Z1 - Z0) / 2);
      }
    }
  });

  it('keeps koi backs just breaking the surface and pads floating on the ripples', () => {
    const life = buildPoolLife();
    life.update(3.2);
    for (const { position } of poses(byKind(life.group, 'koi'))) {
      expect(position.y).toBeLessThan(POOL_WATER.y);
      expect(position.y).toBeGreaterThan(POOL_WATER.y - 0.05);
    }
    for (const { position } of poses(byKind(life.group, 'lily-pad'))) {
      const surface = POOL_WATER.y + rippleHeight(position.x, position.z, 3.2);
      expect(position.y).toBeGreaterThan(surface);
      expect(position.y).toBeLessThan(surface + 0.02);
    }
  });

  it('turns each koi to face the way it swims', () => {
    const life = buildPoolLife();
    const koi = byKind(life.group, 'koi');
    life.update(10);
    const a = poses(koi);
    life.update(10.05);
    const b = poses(koi);
    a.forEach((pose, i) => {
      const travel = b[i].position.clone().sub(pose.position).setY(0).normalize();
      const facing = new Vector3(0, 0, 1).applyQuaternion(pose.quaternion).setY(0).normalize();
      // Tail wiggle swings the heading a little either side of the path.
      expect(travel.dot(facing)).toBeGreaterThan(Math.cos(POOL_LIFE.wiggle + 0.1));
    });
  });

  it('is deterministic', () => {
    const a = buildPoolLife();
    const b = buildPoolLife();
    a.update(7.7);
    b.update(7.7);
    expect(poses(byKind(a.group, 'koi'))).toEqual(poses(byKind(b.group, 'koi')));
    expect(poses(byKind(a.group, 'lily-pad'))).toEqual(poses(byKind(b.group, 'lily-pad')));
  });
});

describe('pool motion in the diorama', () => {
  it('centres the pool life on the water', () => {
    const d = buildDiorama();
    const group = d.group.getObjectByName('pool-life')!;
    expect(group.position.x).toBeCloseTo(CENTER.x);
    expect(group.position.z).toBeCloseTo(CENTER.z);
  });

  it('is driven by the live ambient loop', () => {
    const d = buildDiorama();
    const koi = byKind(d.group, 'koi');
    const before = poses(koi).map((p) => p.position);
    createAmbient(new Scene(), d, { reducedMotion: false }).update(4, 0);
    expect(poses(koi).some((p, i) => p.position.distanceTo(before[i]) > 0.01)).toBe(true);
    const ripple = d.group.getObjectByProperty('name', 'pool-surface') as Mesh;
    expect((ripple.material as MeshStandardMaterial).userData.rippleTime.value).toBe(4);
  });

  it('stays put under reduced motion', () => {
    const d = buildDiorama();
    const koi = byKind(d.group, 'koi');
    const pads = byKind(d.group, 'lily-pad');
    const before = [...poses(koi), ...poses(pads)];
    createAmbient(new Scene(), d, { reducedMotion: true }).update(9, 0);
    expect([...poses(koi), ...poses(pads)]).toEqual(before);
  });
});
