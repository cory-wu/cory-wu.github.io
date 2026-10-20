import { BoxGeometry, CircleGeometry, ConeGeometry, CylinderGeometry, Group, Mesh } from 'three';
import type { MeshStandardMaterial } from 'three';
import { mergedMesh, placed } from '../diorama/parts.ts';
import { flatMaterial, PALETTE } from '../palette.ts';
import type { Landmark, LandmarkBuild } from './types.ts';

const POLE = { r: 0.055, h: 1.55 };
const HEAD = { r: 0.32, depth: 0.14 };
const HEAD_Y = POLE.h + 0.12 + HEAD.r;
const FACE_R = 0.26;
const HANDS = {
  hour: { w: 0.04, len: 0.14 },
  minute: { w: 0.026, len: 0.21 },
};
const TURN = Math.PI * 2;

/** Clockwise turns from 12 o'clock, in radians, for local minutes since midnight. */
export function handAngles(minutes: number): { hour: number; minute: number } {
  return {
    hour: ((minutes % 720) / 720) * TURN,
    minute: ((minutes % 60) / 60) * TURN,
  };
}

/** A hand whose pivot is the face centre, pointing at 12 when unrotated. */
function hand(name: string, { w, len }: { w: number; len: number }, mat: MeshStandardMaterial, z: number): Mesh {
  const mesh = new Mesh(new BoxGeometry(w, len, 0.012).translate(0, len / 2 - w / 2, 0), mat);
  mesh.name = name;
  mesh.position.z = z;
  // Too small and too close to the face for a visible shadow; skipping saves shadow-pass calls.
  mesh.castShadow = false;
  return mesh;
}

async function build(): Promise<LandmarkBuild> {
  const group = new Group();
  const ironMat = flatMaterial(PALETTE.clockPost);
  const faceMat = flatMaterial(PALETTE.clockFace);
  faceMat.emissive.set(PALETTE.clockFace);
  faceMat.emissiveIntensity = 0;

  // Drum axis runs along z, so the two faces look out along ±z.
  const drum = new CylinderGeometry(HEAD.r, HEAD.r, HEAD.depth, 16).rotateX(Math.PI / 2);
  group.add(
    mergedMesh(
      [
        placed(new CylinderGeometry(0.16, 0.2, 0.12, 8), 0, 0.06, 0),
        placed(new CylinderGeometry(POLE.r, POLE.r * 1.3, POLE.h, 8), 0, POLE.h / 2, 0),
        placed(new CylinderGeometry(0.09, 0.07, 0.12, 8), 0, POLE.h + 0.06, 0),
        placed(drum, 0, HEAD_Y, 0),
        placed(new ConeGeometry(0.05, 0.12, 6), 0, HEAD_Y + HEAD.r + 0.05, 0),
      ],
      ironMat,
      'clock-post',
    ),
  );

  const faceZ = HEAD.depth / 2 + 0.002;
  const back = new CircleGeometry(FACE_R, 16).rotateY(Math.PI);
  const faces = mergedMesh(
    [placed(new CircleGeometry(FACE_R, 16), 0, HEAD_Y, faceZ), placed(back, 0, HEAD_Y, -faceZ)],
    faceMat,
    'clock-face',
  );
  faces.castShadow = false;
  group.add(faces);

  // One set of hands per face; the back set is turned around so it also reads clockwise.
  const hourHands: Mesh[] = [];
  const minuteHands: Mesh[] = [];
  for (const yaw of [0, Math.PI]) {
    const side = new Group();
    side.position.y = HEAD_Y;
    side.rotation.y = yaw;
    const hour = hand('hour-hand', HANDS.hour, ironMat, faceZ + 0.008);
    const minute = hand('minute-hand', HANDS.minute, ironMat, faceZ + 0.016);
    side.add(hour, minute);
    hourHands.push(hour);
    minuteHands.push(minute);
    group.add(side);
  }

  const setTime = (minutes: number): void => {
    const { hour, minute } = handAngles(minutes);
    // Negative z rotation is clockwise for a viewer facing the hands.
    for (const h of hourHands) h.rotation.z = -hour;
    for (const m of minuteHands) m.rotation.z = -minute;
  };

  return { object: group, nightLights: [faceMat], setTime };
}

export const clockPost: Landmark = {
  id: 'clock-post',
  label: 'Meet with me',
  href: 'https://cal.com/cory-wu-upqzhi/15min',
  build,
};
