import { describe, expect, it } from 'vitest';
import { InstancedMesh, Matrix4, Mesh, Scene, Vector3 } from 'three';
import { createAmbient } from '../../src/garden/ambient';
import { buildDiorama } from '../../src/garden/diorama';
import { FOUNTAIN_POSITION } from '../../src/garden/diorama/fountain';
import { SPRAY, buildFountainSpray } from '../../src/garden/diorama/fountain-spray';

function dropletPositions(droplets: InstancedMesh): Vector3[] {
  const m = new Matrix4();
  return Array.from({ length: droplets.count }, (_, i) => {
    droplets.getMatrixAt(i, m);
    return new Vector3().setFromMatrixPosition(m);
  });
}

function sprayParts(spray: ReturnType<typeof buildFountainSpray>): { jet: Mesh; droplets: InstancedMesh } {
  const jet = spray.group.children.find((o) => o.userData.kind === 'fountain-jet') as Mesh;
  const droplets = spray.group.children.find((o) => o.userData.kind === 'fountain-spray') as InstancedMesh;
  return { jet, droplets };
}

describe('buildFountainSpray', () => {
  it('is one jet mesh plus one instanced droplet batch, neither casting shadows', () => {
    const spray = buildFountainSpray();
    const { jet, droplets } = sprayParts(spray);
    expect(jet).toBeInstanceOf(Mesh);
    expect(droplets).toBeInstanceOf(InstancedMesh);
    expect(droplets.count).toBe(SPRAY.droplets);
    expect(spray.group.children).toHaveLength(2);
    for (const o of [jet, droplets]) {
      expect(o.castShadow).toBe(false);
      expect(o.receiveShadow).toBe(true);
    }
  });

  it('keeps every droplet above the water and inside the basin at all times', () => {
    const spray = buildFountainSpray();
    const { droplets } = sprayParts(spray);
    for (let t = 0; t < 6; t += 0.05) {
      spray.update(t);
      for (const p of dropletPositions(droplets)) {
        expect(p.y).toBeGreaterThanOrEqual(SPRAY.waterY - 1e-6);
        expect(Math.hypot(p.x, p.z)).toBeLessThanOrEqual(SPRAY.basinRadius + 1e-6);
      }
    }
  });

  it('pulses the jet height within ±8%', () => {
    const spray = buildFountainSpray();
    const { jet } = sprayParts(spray);
    const scales: number[] = [];
    for (let t = 0; t < 4; t += 0.05) {
      spray.update(t);
      scales.push(jet.scale.y);
    }
    expect(Math.min(...scales)).toBeGreaterThanOrEqual(1 - SPRAY.jetPulse - 1e-6);
    expect(Math.max(...scales)).toBeLessThanOrEqual(1 + SPRAY.jetPulse + 1e-6);
    expect(Math.max(...scales) - Math.min(...scales)).toBeGreaterThan(SPRAY.jetPulse);
  });

  it('moves the droplets over time', () => {
    const spray = buildFountainSpray();
    const { droplets } = sprayParts(spray);
    const before = dropletPositions(droplets);
    spray.update(0.3);
    const after = dropletPositions(droplets);
    expect(after.some((p, i) => p.distanceTo(before[i]) > 0.01)).toBe(true);
  });

  it('produces the same pattern on every build', () => {
    const a = buildFountainSpray();
    const b = buildFountainSpray();
    a.update(1.7);
    b.update(1.7);
    expect(dropletPositions(sprayParts(a).droplets)).toEqual(dropletPositions(sprayParts(b).droplets));
  });
});

describe('fountain spray in the diorama', () => {
  it('sits on the fountain', () => {
    const d = buildDiorama();
    expect(d.fountainSpray.group.position.x).toBe(FOUNTAIN_POSITION[0]);
    expect(d.fountainSpray.group.position.z).toBe(FOUNTAIN_POSITION[1]);
    expect(d.group.children).toContain(d.fountainSpray.group);
  });

  it('is animated by the live ambient loop', () => {
    const d = buildDiorama();
    const { droplets } = sprayParts(d.fountainSpray);
    const before = dropletPositions(droplets);
    createAmbient(new Scene(), d, { reducedMotion: false }).update(0.4, 0);
    expect(dropletPositions(droplets).some((p, i) => p.distanceTo(before[i]) > 0.01)).toBe(true);
  });

  it('stays frozen mid-spray under reduced motion', () => {
    const d = buildDiorama();
    const { jet, droplets } = sprayParts(d.fountainSpray);
    const before = dropletPositions(droplets);
    const ambient = createAmbient(new Scene(), d, { reducedMotion: true });
    ambient.update(2.5, 0);
    expect(dropletPositions(droplets)).toEqual(before);
    expect(jet.scale.y).toBe(1);
    // Frozen pose still reads as a running fountain: droplets are spread along their arcs.
    const heights = before.map((p) => p.y);
    expect(Math.max(...heights) - Math.min(...heights)).toBeGreaterThan(0.5);
  });
});
