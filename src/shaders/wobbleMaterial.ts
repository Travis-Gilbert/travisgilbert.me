/**
 * WobbleMaterial: MeshStandardMaterial with subtle vertex displacement
 * for the hand-drawn NPR aesthetic.
 *
 * Uses onBeforeCompile to inject sinusoidal vertex offset into the
 * standard PBR shader. Amplitude is small (0.02) so objects look
 * slightly imprecise without being distracting.
 *
 * Usage in R3F:
 *   <meshStandardMaterial
 *     ref={materialRef}
 *     onBeforeCompile={applyWobble}
 *     color={color}
 *     roughness={0.85}
 *     metalness={0.05}
 *   />
 *
 * Or use the createWobbleMaterial() factory.
 */

import * as THREE from 'three';

const WOBBLE_AMPLITUDE = 0.02;
const WOBBLE_FREQUENCY = 4.0;

/** GLSL vertex displacement injected before the projection step */
const WOBBLE_VERTEX_GLSL = /* glsl */ `
  // Wobble: sinusoidal vertex displacement for hand-drawn feel
  float wobbleX = sin(position.y * ${WOBBLE_FREQUENCY.toFixed(1)} + position.z * 2.3) * ${WOBBLE_AMPLITUDE.toFixed(3)};
  float wobbleY = sin(position.z * ${WOBBLE_FREQUENCY.toFixed(1)} + position.x * 1.7) * ${WOBBLE_AMPLITUDE.toFixed(3)};
  float wobbleZ = sin(position.x * ${WOBBLE_FREQUENCY.toFixed(1)} + position.y * 3.1) * ${WOBBLE_AMPLITUDE.toFixed(3)};
  transformed += vec3(wobbleX, wobbleY, wobbleZ);
`;

/**
 * Callback for MeshStandardMaterial.onBeforeCompile.
 * Injects wobble vertex displacement into the shader.
 */
export function applyWobble(shader: THREE.WebGLProgramParametersWithUniforms): void {
  shader.vertexShader = shader.vertexShader.replace(
    '#include <begin_vertex>',
    `#include <begin_vertex>
${WOBBLE_VERTEX_GLSL}`,
  );
}

/**
 * Factory: create a MeshStandardMaterial with wobble pre-configured.
 */
export function createWobbleMaterial(
  params: THREE.MeshStandardMaterialParameters = {},
): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({
    roughness: 0.85,
    metalness: 0.05,
    ...params,
  });
  mat.onBeforeCompile = applyWobble;
  return mat;
}
