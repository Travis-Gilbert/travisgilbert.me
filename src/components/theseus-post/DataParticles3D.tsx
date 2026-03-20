'use client';

// DataParticles3D.tsx: 3D particle system replacing 2D binary text stream.
// Two layers: path-following data particles + ambient dust for atmosphere.
// Uses THREE.Points with custom ShaderMaterial for glowing dot rendering.
// Normal blending with soft alpha falloff for subtle presence on light backgrounds.
// Particles flow along BINARY_PATHS with z-axis oscillation for true 3D depth.

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { mulberry32 } from './roughMaze';
import { BINARY_PATHS, ZONE_COLORS, type MazeZone } from './MazeWalls';

// ── Particle counts ──
const PATH_PARTICLES = 220;
const MOBILE_PATH = 120;
const DUST_COUNT = 180;
const MOBILE_DUST = 80;
const TRAIL_LENGTH = 3; // points per lead particle (lead + 2 followers)

// ── Shader: vertex ──
const vertexShader = /* glsl */ `
  attribute float aSize;
  attribute vec3 aColor;
  attribute float aOpacity;

  varying vec3 vColor;
  varying float vOpacity;

  void main() {
    vColor = aColor;
    vOpacity = aOpacity;

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    // Small particles with subtle depth scaling
    gl_PointSize = aSize * (80.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

// ── Shader: fragment (soft dot, works on light backgrounds) ──
const fragmentShader = /* glsl */ `
  varying vec3 vColor;
  varying float vOpacity;

  void main() {
    float dist = length(gl_PointCoord - vec2(0.5));
    if (dist > 0.5) discard;

    // Soft circular dot with gentle edge falloff
    float alpha = smoothstep(0.5, 0.15, dist) * vOpacity;

    gl_FragColor = vec4(vColor, alpha);
  }
`;

// ── Inactive particle tint ──
const INACTIVE_COLOR = new THREE.Color('#b0a890');

// ── Pre-parse zone colors ──
const ZONE_COLOR_MAP: Record<string, THREE.Color> = {};
for (const [zone, hex] of Object.entries(ZONE_COLORS)) {
  ZONE_COLOR_MAP[zone] = new THREE.Color(hex);
}

// ── Particle state types ──
interface PathParticle {
  pathIndex: number;
  t: number;
  trailIndex: number; // 0 = lead, 1+ = follower
  size: number;
  baseOpacity: number;
  opacity: number;
  zOffset: number;
  zFreq: number;
}

interface DustParticle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  size: number;
  opacity: number;
  phase: number;
}

// ── Inner scene component ──
function ParticleField({
  activeZones,
  isDark,
}: {
  activeZones: Set<MazeZone>;
  isDark: boolean;
}) {
  const { viewport } = useThree();
  const pointsRef = useRef<THREE.Points>(null);
  const activeZonesRef = useRef(activeZones);

  // Keep zones ref current without triggering re-renders
  useEffect(() => {
    activeZonesRef.current = activeZones;
  }, [activeZones]);

  // Initialize particle state
  const state = useMemo(() => {
    const rand = mulberry32(1952 + 42);
    const isMobile =
      typeof window !== 'undefined' && window.innerWidth < 768;

    const pathCount = isMobile ? MOBILE_PATH : PATH_PARTICLES;
    const dustCount = isMobile ? MOBILE_DUST : DUST_COUNT;
    const leadsPerPath = Math.floor(
      pathCount / BINARY_PATHS.length / TRAIL_LENGTH,
    );
    const actualPathCount = leadsPerPath * BINARY_PATHS.length * TRAIL_LENGTH;
    const totalCount = actualPathCount + dustCount;

    // Path particles (with trails)
    const pathParticles: PathParticle[] = [];
    for (let pi = 0; pi < BINARY_PATHS.length; pi++) {
      for (let li = 0; li < leadsPerPath; li++) {
        const baseT = rand();
        const baseZ = (rand() - 0.5) * 8;
        const baseSize = 1.0 + rand() * 1.2;
        const baseOp = 0.15 + rand() * 0.12;
        const freq = 0.4 + rand() * 1.2;

        for (let ti = 0; ti < TRAIL_LENGTH; ti++) {
          pathParticles.push({
            pathIndex: pi,
            t: baseT - ti * 0.015, // trail offsets
            trailIndex: ti,
            size: baseSize * (1 - ti * 0.2), // followers shrink
            baseOpacity: baseOp * (1 - ti * 0.3), // followers fade
            opacity: baseOp * (1 - ti * 0.3),
            zOffset: baseZ + ti * 0.4,
            zFreq: freq,
          });
        }
      }
    }

    // Dust particles (ambient atmosphere)
    const dustParticles: DustParticle[] = [];
    for (let i = 0; i < dustCount; i++) {
      dustParticles.push({
        x: (rand() - 0.5) * 40,
        y: (rand() - 0.5) * 30,
        z: (rand() - 0.5) * 20,
        vx: (rand() - 0.5) * 0.3,
        vy: (rand() - 0.5) * 0.2,
        vz: (rand() - 0.5) * 0.15,
        size: 0.4 + rand() * 0.6,
        opacity: 0.03 + rand() * 0.05,
        phase: rand() * Math.PI * 2,
      });
    }

    return { pathParticles, dustParticles, totalCount };
  }, []);

  // Geometry with buffer attributes
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(state.totalCount * 3);
    const colors = new Float32Array(state.totalCount * 3);
    const sizes = new Float32Array(state.totalCount);
    const opacities = new Float32Array(state.totalCount);

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute('aOpacity', new THREE.BufferAttribute(opacities, 1));

    return geo;
  }, [state.totalCount]);

  // Shader material
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        transparent: true,
        blending: THREE.NormalBlending,
        depthWrite: false,
      }),
    [],
  );

  // Animation loop
  useFrame((_, delta) => {
    if (!pointsRef.current) return;

    const dt = Math.min(delta, 0.05); // clamp delta spikes
    const time = performance.now() * 0.001;

    const positions = geometry.attributes.position
      .array as Float32Array;
    const colors = geometry.attributes.aColor.array as Float32Array;
    const sizes = geometry.attributes.aSize.array as Float32Array;
    const opacities = geometry.attributes.aOpacity
      .array as Float32Array;

    const halfW = viewport.width / 2;
    const halfH = viewport.height / 2;
    const zones = activeZonesRef.current;

    let idx = 0;

    // ── Path particles ──
    for (const p of state.pathParticles) {
      const path = BINARY_PATHS[p.pathIndex];
      if (!path) {
        idx++;
        continue;
      }

      // Advance (lead particles drive; followers lag via t offset)
      if (p.trailIndex === 0) {
        p.t += path.speed * dt * 0.3;
        if (p.t > 1) p.t -= 1;
      } else {
        // Followers sync to their lead (previous particle in array)
        const leadIdx =
          idx - p.trailIndex;
        if (leadIdx >= 0) {
          const leadParticle = state.pathParticles[leadIdx];
          if (leadParticle) {
            p.t = leadParticle.t - p.trailIndex * 0.015;
            if (p.t < 0) p.t += 1;
          }
        }
      }

      // Interpolate position along path
      const pts = path.points;
      const segCount = pts.length - 1;
      const wrappedT = ((p.t % 1) + 1) % 1;
      const rawSeg = wrappedT * segCount;
      const seg = Math.min(Math.floor(rawSeg), segCount - 1);
      const localT = rawSeg - seg;

      const p0 = pts[seg];
      const p1 = pts[Math.min(seg + 1, pts.length - 1)];

      // Maze coords to normalized (0..1)
      const nx = (p0[0] + (p1[0] - p0[0]) * localT) / 1000;
      const ny = (p0[1] + (p1[1] - p0[1]) * localT) / 1000;

      // Normalized to world coords (centered)
      const wx = (nx - 0.5) * viewport.width;
      const wy = -(ny - 0.5) * viewport.height;
      const wz =
        p.zOffset + Math.sin(time * p.zFreq + wrappedT * 6.28) * 2.5;

      positions[idx * 3] = wx;
      positions[idx * 3 + 1] = wy;
      positions[idx * 3 + 2] = wz;

      // Zone-reactive color
      const isActive = zones.has(path.zone);
      const targetOp = isActive ? p.baseOpacity * 3.5 : p.baseOpacity;
      p.opacity += (targetOp - p.opacity) * 0.06;

      const color = isActive
        ? (ZONE_COLOR_MAP[path.zone] || INACTIVE_COLOR)
        : INACTIVE_COLOR;

      colors[idx * 3] = color.r;
      colors[idx * 3 + 1] = color.g;
      colors[idx * 3 + 2] = color.b;

      sizes[idx] = p.size;
      opacities[idx] = isDark
        ? Math.min(p.opacity * 2.5, 0.95)
        : p.opacity;

      idx++;
    }

    // ── Dust particles ──
    for (const d of state.dustParticles) {
      // Slow drift
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.z += d.vz * dt;

      // Wrap around bounds
      if (d.x > halfW + 5) d.x = -halfW - 5;
      if (d.x < -halfW - 5) d.x = halfW + 5;
      if (d.y > halfH + 5) d.y = -halfH - 5;
      if (d.y < -halfH - 5) d.y = halfH + 5;
      if (d.z > 12) d.z = -12;
      if (d.z < -12) d.z = 12;

      positions[idx * 3] = d.x;
      positions[idx * 3 + 1] = d.y;
      positions[idx * 3 + 2] = d.z + Math.sin(time * 0.3 + d.phase) * 0.5;

      // Dust is always a warm muted tone
      const dustBrightness = isDark ? 0.6 : 0.45;
      colors[idx * 3] = dustBrightness;
      colors[idx * 3 + 1] = dustBrightness * 0.9;
      colors[idx * 3 + 2] = dustBrightness * 0.7;

      sizes[idx] = d.size;
      opacities[idx] =
        d.opacity *
        (0.7 + 0.3 * Math.sin(time * 0.8 + d.phase));

      idx++;
    }

    // Flag attributes for GPU upload
    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.aColor.needsUpdate = true;
    geometry.attributes.aSize.needsUpdate = true;
    geometry.attributes.aOpacity.needsUpdate = true;
  });

  return <points ref={pointsRef} geometry={geometry} material={material} />;
}

// ── Main export ──
interface DataParticles3DProps {
  activeZones: Set<MazeZone>;
  reducedMotion: boolean;
  isDark?: boolean;
}

export default function DataParticles3D({
  activeZones,
  reducedMotion,
  isDark = false,
}: DataParticles3DProps) {
  if (reducedMotion) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 3,
      }}
    >
      <Canvas
        camera={{ position: [0, 0, 30], fov: 50 }}
        gl={{
          alpha: true,
          antialias: false,
          powerPreference: 'low-power',
        }}
        style={{ background: 'transparent' }}
        dpr={[1, 1.5]}
      >
        <ParticleField activeZones={activeZones} isDark={isDark} />
      </Canvas>
    </div>
  );
}
