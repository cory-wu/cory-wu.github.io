import type { MeshStandardMaterial, Object3D } from 'three';

export interface LandmarkBuild {
  object: Object3D;
  /** Materials whose emissiveIntensity is raised at night. */
  nightLights?: MeshStandardMaterial[];
}

export interface Landmark {
  id: string;
  label: string;
  href: string;
  build(): Promise<LandmarkBuild>;
}

export interface Placement {
  landmark: Landmark;
  /** [x, z] on the grass plane. */
  position: [number, number];
  rotationY: number;
}
