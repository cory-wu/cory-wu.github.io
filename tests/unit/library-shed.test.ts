import { describe, expect, it } from 'vitest';
import { Box3, Mesh, MeshStandardMaterial, Vector3 } from 'three';
import { libraryShed } from '../../src/garden/landmarks/library-shed';
import { PALETTE } from '../../src/garden/palette';

describe('libraryShed', () => {
  it('has the expected identity', () => {
    expect(libraryShed.id).toBe('library-shed');
    expect(libraryShed.label).toBe('Writing');
    expect(libraryShed.href).toBe('/writing/');
  });
  it('exposes a single unlit window material', async () => {
    const { nightLights } = await libraryShed.build();
    expect(nightLights).toHaveLength(1);
    const m = nightLights![0];
    expect(m.emissiveIntensity).toBe(0);
    expect(m.emissive.getHexString()).toBe(PALETTE.window.slice(1));
  });
  it('fits a 3x3 footprint, sitting on the ground', async () => {
    const { object } = await libraryShed.build();
    const size = new Box3().setFromObject(object).getSize(new Vector3());
    expect(size.x).toBeLessThanOrEqual(3);
    expect(size.z).toBeLessThanOrEqual(3);
    expect(new Box3().setFromObject(object).min.y).toBeGreaterThanOrEqual(-0.01);
  });
  it('is flat-shaded and shadowed on every mesh', async () => {
    const { object } = await libraryShed.build();
    let count = 0;
    object.traverse((o) => {
      if (!(o instanceof Mesh)) return;
      count++;
      expect((o.material as MeshStandardMaterial).flatShading).toBe(true);
      expect(o.castShadow).toBe(true);
      expect(o.receiveShadow).toBe(true);
    });
    expect(count).toBeGreaterThan(5);
  });
});
