'use client';

/**
 * ParticleField: Universal particle renderer for Theseus VIE.
 *
 * 30K particles as THREE.Points with custom ShaderMaterial.
 * Binary glyph texture atlas renders 0s and 1s (matching DotGrid substrate).
 * Progress uniform interpolates from scattered galaxy to target positions.
 *
 * Accepts optional ShapeResult to set target positions from real graph data,
 * and optional ConstructionPlayback to drive progress from the animation timeline.
 */

import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { mulberry32 } from '@/lib/prng';
import { TYPE_COLORS } from './rendering';
import type { ShapeResult } from './shapes';
import type { ConstructionPlayback } from './rendering';

// ── Glyph atlas: '0' and '1' on a 128x64 canvas ──

function createGlyphAtlas(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, 128, 64);
  ctx.font = '28px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('0', 32, 32);
  ctx.fillText('1', 96, 32);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

// ── Static buffer initialization (scattered + defaults) ──

interface StaticBuffers {
  scattered: Float32Array;
  color: Float32Array;
  size: Float32Array;
  charType: Float32Array;
  defaultTarget: Float32Array;
  defaultTargetColor: Float32Array;
  defaultAlpha: Float32Array;
}

const BASE_COLOR: [number, number, number] = [0.38, 0.36, 0.34];
const GALAXY_RADIUS = 12;

// Derive default palette from TYPE_COLORS (hex -> normalized RGB)
const PALETTE_KEYS = ['source', 'concept', 'person', 'hunch', 'event'] as const;
const DEFAULT_PALETTE: [number, number, number][] = PALETTE_KEYS.map((key) => {
  const hex = TYPE_COLORS[key] ?? '#9A958D';
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
});

function initStaticBuffers(count: number): StaticBuffers {
  const scattered = new Float32Array(count * 3);
  const color = new Float32Array(count * 3);
  const size = new Float32Array(count);
  const charType = new Float32Array(count);
  const defaultTarget = new Float32Array(count * 3);
  const defaultTargetColor = new Float32Array(count * 3);
  const defaultAlpha = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    const rng = mulberry32(i * 1000 + 7919);
    const i3 = i * 3;

    // Scattered galaxy disc
    const theta = rng() * Math.PI * 2;
    const r = GALAXY_RADIUS * Math.sqrt(rng());
    scattered[i3] = r * Math.cos(theta);
    scattered[i3 + 1] = (rng() - 0.5) * 3.0;
    scattered[i3 + 2] = r * Math.sin(theta);

    // Default target: sphere shell (fallback when no ShapeResult provided)
    const tTheta = rng() * Math.PI * 2;
    const tPhi = Math.acos(2 * rng() - 1);
    const tR = 4 + rng() * 2.5;
    defaultTarget[i3] = tR * Math.sin(tPhi) * Math.cos(tTheta);
    defaultTarget[i3 + 1] = tR * Math.sin(tPhi) * Math.sin(tTheta);
    defaultTarget[i3 + 2] = tR * Math.cos(tPhi);

    // Base color: dim warm gray
    color[i3] = BASE_COLOR[0];
    color[i3 + 1] = BASE_COLOR[1];
    color[i3 + 2] = BASE_COLOR[2];

    // Default target color: palette cycle
    const tc = DEFAULT_PALETTE[i % DEFAULT_PALETTE.length];
    defaultTargetColor[i3] = tc[0];
    defaultTargetColor[i3 + 1] = tc[1];
    defaultTargetColor[i3 + 2] = tc[2];

    // Size
    size[i] = 0.8 + rng() * 0.7;

    // Default alpha
    defaultAlpha[i] = 0.006 + rng() * 0.018;

    // Binary character assignment: 20% density (continues same rng sequence)
    if (rng() < 0.20) {
      charType[i] = rng() < 0.5 ? 0.0 : 1.0;
    } else {
      charType[i] = -1.0;
    }
  }

  return { scattered, color, size, charType, defaultTarget, defaultTargetColor, defaultAlpha };
}

// ── Shaders ──

const VERTEX_SHADER = /* glsl */ `
uniform float progress;
uniform float time;

attribute vec3 scattered;
attribute vec3 target;
attribute vec3 aColor;
attribute vec3 aTargetColor;
attribute float aSize;
attribute float aAlpha;
attribute float aCharType;

varying vec3 vColor;
varying float vAlpha;
varying float vCharType;

void main() {
  float p = smoothstep(0.0, 1.0, progress);

  vec3 pos = mix(scattered, target, p);

  // Idle drift (diminishes as progress increases)
  float drift = (1.0 - p) * 0.3;
  pos += vec3(
    sin(time * 0.2 + pos.x * 3.0) * drift,
    cos(time * 0.15 + pos.y * 2.5) * drift,
    sin(time * 0.18 + pos.z * 2.0) * drift
  );

  // Subtle residual movement even when crystallized
  pos += vec3(
    sin(time * 0.08 + pos.x * 1.5) * 0.02,
    cos(time * 0.06 + pos.y * 1.2) * 0.02,
    sin(time * 0.07 + pos.z * 1.0) * 0.02
  );

  vColor = mix(aColor, aTargetColor, smoothstep(0.1, 0.8, progress));
  vAlpha = mix(aAlpha, aAlpha + 0.04, smoothstep(0.0, 0.6, progress));
  vCharType = aCharType;

  vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
  gl_PointSize = aSize * (200.0 / -mvPosition.z);
  gl_Position = projectionMatrix * mvPosition;
}
`;

const FRAGMENT_SHADER = /* glsl */ `
uniform sampler2D glyphAtlas;

varying vec3 vColor;
varying float vAlpha;
varying float vCharType;

void main() {
  if (vCharType >= 0.0) {
    vec2 uv = gl_PointCoord;
    uv.x = uv.x * 0.5 + vCharType * 0.5;
    float glyph = texture2D(glyphAtlas, uv).a;
    if (glyph < 0.1) discard;
    gl_FragColor = vec4(vColor, glyph * vAlpha);
  } else {
    vec2 center = gl_PointCoord - vec2(0.5);
    float dist = dot(center, center);
    if (dist > 0.25) discard;
    float edge = 1.0 - smoothstep(0.15, 0.25, dist);
    gl_FragColor = vec4(vColor, edge * vAlpha);
  }
}
`;

// ── Playback to progress mapping ──

function playbackToProgress(playback: ConstructionPlayback | null): number {
  if (!playback) return 0;
  if (playback.isComplete) return 1;
  const { phaseProgress: pp } = playback;
  // Weighted blend across phases matching the spec timeline
  return (
    pp.focal_nodes_appear * 0.15 +
    pp.supporting_nodes_appear * 0.10 +
    pp.edges_draw * 0.15 +
    pp.clusters_coalesce * 0.15 +
    pp.data_builds * 0.10 +
    pp.labels_fade_in * 0.10 +
    pp.crystallize * 0.25
  );
}

// ── ParticleSystem (lives inside Canvas) ──

interface ParticleSystemProps {
  particleCount: number;
  progress: number;
  shapeResult: ShapeResult | null;
}

function ParticleSystem({ particleCount, progress, shapeResult }: ParticleSystemProps) {
  const pointsRef = useRef<THREE.Points>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const geometryRef = useRef<THREE.BufferGeometry>(null);

  const glyphAtlas = useMemo(() => createGlyphAtlas(), []);
  const staticBuffers = useMemo(() => initStaticBuffers(particleCount), [particleCount]);

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();

    // position shares scattered buffer (vertex shader reads scattered directly)
    geo.setAttribute('position', new THREE.BufferAttribute(staticBuffers.scattered, 3));
    geo.setAttribute('scattered', new THREE.BufferAttribute(staticBuffers.scattered, 3));
    // target/targetColor/alpha get their own buffers (mutated by useEffect on shapeResult change)
    const targetBuf = new Float32Array(staticBuffers.defaultTarget);
    const targetColorBuf = new Float32Array(staticBuffers.defaultTargetColor);
    const alphaBuf = new Float32Array(staticBuffers.defaultAlpha);
    geo.setAttribute('target', new THREE.BufferAttribute(targetBuf, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(staticBuffers.color, 3));
    geo.setAttribute('aTargetColor', new THREE.BufferAttribute(targetColorBuf, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(staticBuffers.size, 1));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(alphaBuf, 1));
    geo.setAttribute('aCharType', new THREE.BufferAttribute(staticBuffers.charType, 1));

    return geo;
  }, [staticBuffers]);

  // Keep ref in sync for imperative buffer updates
  useEffect(() => {
    geometryRef.current = geometry;
  }, [geometry]);

  // Update target/color/alpha buffers when shapeResult changes
  useEffect(() => {
    const geo = geometryRef.current;
    if (!geo) return;

    const targetAttr = geo.getAttribute('target') as THREE.BufferAttribute;
    const colorAttr = geo.getAttribute('aTargetColor') as THREE.BufferAttribute;
    const alphaAttr = geo.getAttribute('aAlpha') as THREE.BufferAttribute;

    if (shapeResult) {
      (targetAttr.array as Float32Array).set(shapeResult.target);
      (colorAttr.array as Float32Array).set(shapeResult.targetColor);
      (alphaAttr.array as Float32Array).set(shapeResult.alpha);
    } else {
      (targetAttr.array as Float32Array).set(staticBuffers.defaultTarget);
      (colorAttr.array as Float32Array).set(staticBuffers.defaultTargetColor);
      (alphaAttr.array as Float32Array).set(staticBuffers.defaultAlpha);
    }

    targetAttr.needsUpdate = true;
    colorAttr.needsUpdate = true;
    alphaAttr.needsUpdate = true;
  }, [shapeResult, staticBuffers]);

  const uniforms = useMemo(() => ({
    progress: { value: 0.0 },
    time: { value: 0.0 },
    glyphAtlas: { value: glyphAtlas },
  }), [glyphAtlas]);

  useEffect(() => {
    if (materialRef.current) {
      materialRef.current.uniforms.progress.value = progress;
    }
  }, [progress]);

  useFrame((_, delta) => {
    if (materialRef.current) {
      materialRef.current.uniforms.time.value += delta;
    }
  });

  useEffect(() => {
    return () => {
      geometry.dispose();
      glyphAtlas.dispose();
    };
  }, [geometry, glyphAtlas]);

  return (
    <points ref={pointsRef} geometry={geometry}>
      <shaderMaterial
        ref={materialRef}
        vertexShader={VERTEX_SHADER}
        fragmentShader={FRAGMENT_SHADER}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

// ── Region click handler (invisible spheres for raycasting) ──

function RegionClickHandler({
  regions,
  onSelect,
}: {
  regions: ShapeResult['regions'];
  onSelect?: (nodeId: string) => void;
}) {
  if (!onSelect || regions.length === 0) return null;

  return (
    <group>
      {regions.map((region) => (
        <mesh
          key={region.id}
          position={region.center}
          onClick={(e) => {
            e.stopPropagation();
            const firstId = region.objectIds[0];
            if (firstId) onSelect(firstId);
          }}
        >
          <sphereGeometry args={[region.radius, 8, 8]} />
          <meshBasicMaterial visible={false} />
        </mesh>
      ))}
    </group>
  );
}

// ── Public component ──

interface ParticleFieldProps {
  /** Direct progress override (0.0 to 1.0). Used when no playback provided. */
  progress?: number;
  /** ConstructionAnimator playback state. Takes precedence over progress prop. */
  playback?: ConstructionPlayback | null;
  /** ShapeResult from a ShapeGenerator (graph, heatmap, etc.). Null = default sphere. */
  shapeResult?: ShapeResult | null;
  /** Called when user clicks a region in the particle field. */
  onSelectNode?: (nodeId: string) => void;
  particleCount?: number;
  className?: string;
}

export default function ParticleField({
  progress = 0,
  playback = null,
  shapeResult = null,
  onSelectNode,
  particleCount = 30_000,
  className,
}: ParticleFieldProps) {
  const effectiveProgress = playback ? playbackToProgress(playback) : progress;

  const cameraPosition = shapeResult?.cameraPosition ?? [0, 8, 14];

  return (
    <div
      className={className}
      style={{
        width: '100%',
        height: '100%',
        background: '#0f1012',
      }}
    >
      <Canvas
        camera={{ position: cameraPosition as [number, number, number], fov: 60 }}
        gl={{ antialias: true, alpha: false }}
        style={{ width: '100%', height: '100%' }}
      >
        <color attach="background" args={['#0f1012']} />
        <ParticleSystem
          particleCount={particleCount}
          progress={effectiveProgress}
          shapeResult={shapeResult}
        />
        {shapeResult && (
          <RegionClickHandler
            regions={shapeResult.regions}
            onSelect={onSelectNode}
          />
        )}
        <OrbitControls
          enablePan
          enableZoom
          enableRotate
          autoRotate
          autoRotateSpeed={0.15}
          minDistance={5}
          maxDistance={30}
        />
      </Canvas>
    </div>
  );
}
