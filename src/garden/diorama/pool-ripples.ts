import type { MeshStandardMaterial } from 'three';

/**
 * Two slow crossing sine waves, in the pool surface's local frame (origin at the water's
 * centre). `rippleHeight` and the shader patch share these constants so floating things
 * bob on the same surface the GPU draws.
 */
export const RIPPLE = {
  amplitude: 0.012,
  waves: [
    { kx: 5.2, kz: 1.4, speed: 0.9 },
    { kx: 1.1, kz: 3.6, speed: -0.65 },
  ],
} as const;

/** Surface offset at local (x, z) and time t; always within ±RIPPLE.amplitude. */
export function rippleHeight(x: number, z: number, t: number): number {
  const sum = RIPPLE.waves.reduce((s, w) => s + Math.sin(w.kx * x + w.kz * z + w.speed * t), 0);
  return (RIPPLE.amplitude * sum) / RIPPLE.waves.length;
}

const glsl = (n: number): string => (Number.isInteger(n) ? `${n}.0` : `${n}`);

const RIPPLE_CHUNK = /* glsl */ `#include <begin_vertex>
  transformed.y += uRippleAmp * (${RIPPLE.waves
    .map((w) => `sin(${glsl(w.kx)} * position.x + ${glsl(w.kz)} * position.z + ${glsl(w.speed)} * uTime)`)
    .join(' + ')}) / ${glsl(RIPPLE.waves.length)};`;

/**
 * Displaces the (flat-shaded) pool grid on the GPU; flat shading derives facet normals per
 * fragment, so tilted facets catch the light without recomputing normals. Returns the time
 * uniform, also kept on `material.userData.rippleTime`.
 */
export function patchRipples(material: MeshStandardMaterial): { value: number } {
  const uniforms = { uTime: { value: 0 }, uRippleAmp: { value: RIPPLE.amplitude } };
  material.userData.rippleTime = uniforms.uTime;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.uniforms.uRippleAmp = uniforms.uRippleAmp;
    shader.vertexShader =
      'uniform float uTime;\nuniform float uRippleAmp;\n' +
      shader.vertexShader.replace('#include <begin_vertex>', RIPPLE_CHUNK);
  };
  material.customProgramCacheKey = () => 'garden-pool-ripple';
  material.needsUpdate = true;
  return uniforms.uTime;
}
