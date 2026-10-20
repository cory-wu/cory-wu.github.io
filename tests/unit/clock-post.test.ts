import { describe, expect, it } from 'vitest';
import { Box3, Mesh, MeshStandardMaterial, Vector3 } from 'three';
import { clockPost, handAngles } from '../../src/garden/landmarks/clock-post';
import { APPROVED_EXTERNAL_HREFS } from '../../src/garden/landmarks/links';
import { PALETTE } from '../../src/garden/palette';

const TURN = Math.PI * 2;

describe('clockPost', () => {
  it('has the expected identity and an approved booking link', () => {
    expect(clockPost.id).toBe('clock-post');
    expect(clockPost.label).toBe('Meet with me');
    expect(clockPost.href).toBe('https://cal.com/cory-wu-upqzhi/15min');
    expect(APPROVED_EXTERNAL_HREFS.has(clockPost.href)).toBe(true);
  });
  it('exposes a single unlit clock-face material as its night light', async () => {
    const { nightLights } = await clockPost.build();
    expect(nightLights).toHaveLength(1);
    expect(nightLights![0].emissiveIntensity).toBe(0);
    expect(nightLights![0].emissive.getHexString()).toBe(PALETTE.clockFace.slice(1));
  });
  it('is a slim post sitting on the ground', async () => {
    const { object } = await clockPost.build();
    const box = new Box3().setFromObject(object);
    const size = box.getSize(new Vector3());
    expect(size.x).toBeLessThanOrEqual(1);
    expect(size.z).toBeLessThanOrEqual(1);
    expect(size.y).toBeGreaterThan(1.5);
    expect(box.min.y).toBeGreaterThanOrEqual(-0.01);
  });
  it('is flat-shaded everywhere, with the post itself casting the shadow', async () => {
    const { object } = await clockPost.build();
    let count = 0;
    object.traverse((o) => {
      if (!(o instanceof Mesh)) return;
      count++;
      expect((o.material as MeshStandardMaterial).flatShading).toBe(true);
    });
    expect(count).toBeGreaterThan(2);
    const post = object.children.find((o) => o.userData.kind === 'clock-post') as Mesh;
    expect(post.castShadow).toBe(true);
  });
  it('turns its hands when given a time', async () => {
    const build = await clockPost.build();
    const hands = (name: string) => {
      const found: Mesh[] = [];
      build.object.traverse((o) => {
        if (o.name === name) found.push(o as Mesh);
      });
      return found;
    };
    build.setTime!(3 * 60);
    const minuteHands = hands('minute-hand');
    const hourHands = hands('hour-hand');
    // One set of hands on each side of the face.
    expect(minuteHands).toHaveLength(2);
    expect(hourHands).toHaveLength(2);
    build.object.updateMatrixWorld(true);
    // Where each hand points, relative to the face centre, in world space.
    const pointing = (h: Mesh) => {
      const centre = h.localToWorld(new Vector3());
      return h.localToWorld(new Vector3(0, 0.1, 0)).sub(centre);
    };
    // At 03:00 the hour hand points to each viewer's right: +x seen from +z, -x seen from -z.
    const [frontHour, backHour] = hourHands.map(pointing);
    expect(frontHour.x).toBeCloseTo(0.1);
    expect(backHour.x).toBeCloseTo(-0.1);
    for (const h of minuteHands) {
      const p = pointing(h);
      expect(p.y).toBeCloseTo(0.1);
    }
  });
});

describe('handAngles', () => {
  it('measures clockwise turns from 12', () => {
    expect(handAngles(0)).toEqual({ hour: 0, minute: 0 });
    expect(handAngles(90).minute).toBeCloseTo(TURN / 2);
    expect(handAngles(90).hour).toBeCloseTo((1.5 / 12) * TURN);
    // 15:00 and 03:00 put the hour hand in the same place.
    expect(handAngles(15 * 60).hour).toBeCloseTo(handAngles(3 * 60).hour);
  });
});
