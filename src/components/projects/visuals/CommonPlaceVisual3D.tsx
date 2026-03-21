'use client';

import { useRef, useMemo, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import CommonPlaceVisual from './CommonPlaceVisual';

/* ---- Icon definitions ---- */

const ICONS = [
  { id: 'doc', label: 'Source', color: '#1A7A8A' },
  { id: 'bulb', label: 'Idea', color: '#C49A4A' },
  { id: 'search', label: 'Search', color: '#2D5F6B' },
  { id: 'link', label: 'Link', color: '#6B4F7A' },
  { id: 'brain', label: 'Model', color: '#C4503C' },
  { id: 'question', label: 'Question', color: '#B85C28' },
  { id: 'chart', label: 'Data', color: '#4A7A5A' },
  { id: 'pencil', label: 'Note', color: '#68666E' },
];

/* Default connections (always visible) */
const DEFAULT_EDGES: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 0],
  [0, 4], [1, 5], [2, 6],
];

/* Extra connections that appear on hover */
const HOVER_EDGES: [number, number][] = [
  [0, 3], [1, 4], [2, 5], [3, 6], [0, 6], [1, 7], [3, 7],
];

/* ---- Golden spiral positions ---- */

function goldenSpiralPositions(count: number, radius: number): THREE.Vector3[] {
  const positions: THREE.Vector3[] = [];
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i++) {
    const y = 1 - (i / (count - 1)) * 2;
    const radiusAtY = Math.sqrt(1 - y * y);
    const theta = goldenAngle * i;
    positions.push(
      new THREE.Vector3(
        Math.cos(theta) * radiusAtY * radius,
        y * radius * 0.6,
        Math.sin(theta) * radiusAtY * radius,
      ),
    );
  }
  return positions;
}

/* ---- Icon Shape component ---- */

function IconShape({ shape, color }: { shape: string; color: number }) {
  switch (shape) {
    case 'doc':
      return (
        <mesh>
          <boxGeometry args={[0.25, 0.35, 0.03]} />
          <meshPhongMaterial color={color} emissive={color} emissiveIntensity={0.15} flatShading transparent opacity={0.8} />
        </mesh>
      );
    case 'bulb':
      return (
        <mesh>
          <sphereGeometry args={[0.15, 8, 6]} />
          <meshPhongMaterial color={color} emissive={color} emissiveIntensity={0.15} flatShading transparent opacity={0.8} />
        </mesh>
      );
    case 'search':
      return (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.14, 0.035, 6, 12]} />
          <meshPhongMaterial color={color} emissive={color} emissiveIntensity={0.15} flatShading transparent opacity={0.8} />
        </mesh>
      );
    case 'link':
      return (
        <mesh rotation={[0, 0, Math.PI / 4]}>
          <torusGeometry args={[0.12, 0.035, 6, 8]} />
          <meshPhongMaterial color={color} emissive={color} emissiveIntensity={0.15} flatShading transparent opacity={0.8} />
        </mesh>
      );
    case 'brain':
      return (
        <mesh>
          <dodecahedronGeometry args={[0.16, 0]} />
          <meshPhongMaterial color={color} emissive={color} emissiveIntensity={0.15} flatShading transparent opacity={0.8} />
        </mesh>
      );
    case 'question':
      return (
        <mesh>
          <coneGeometry args={[0.12, 0.25, 5]} />
          <meshPhongMaterial color={color} emissive={color} emissiveIntensity={0.15} flatShading transparent opacity={0.8} />
        </mesh>
      );
    case 'chart':
      return (
        <group>
          <mesh position={[-0.08, -0.05, 0]}>
            <boxGeometry args={[0.06, 0.15, 0.06]} />
            <meshPhongMaterial color={color} emissive={color} emissiveIntensity={0.15} flatShading transparent opacity={0.8} />
          </mesh>
          <mesh position={[0, 0.02, 0]}>
            <boxGeometry args={[0.06, 0.25, 0.06]} />
            <meshPhongMaterial color={color} emissive={color} emissiveIntensity={0.15} flatShading transparent opacity={0.8} />
          </mesh>
          <mesh position={[0.08, -0.02, 0]}>
            <boxGeometry args={[0.06, 0.2, 0.06]} />
            <meshPhongMaterial color={color} emissive={color} emissiveIntensity={0.15} flatShading transparent opacity={0.8} />
          </mesh>
        </group>
      );
    case 'pencil':
      return (
        <mesh rotation={[0, 0, 0.3]}>
          <cylinderGeometry args={[0.025, 0.025, 0.35, 6]} />
          <meshPhongMaterial color={color} emissive={color} emissiveIntensity={0.15} flatShading transparent opacity={0.8} />
        </mesh>
      );
    default:
      return (
        <mesh>
          <sphereGeometry args={[0.12, 8, 6]} />
          <meshPhongMaterial color={color} flatShading transparent opacity={0.8} />
        </mesh>
      );
  }
}

/* ---- Edge Lines ---- */

function EdgeLines({
  positions,
  edges,
  opacity,
}: {
  positions: THREE.Vector3[];
  edges: [number, number][];
  opacity: number;
}) {
  if (opacity < 0.005) return null;
  return (
    <group>
      {edges.map(([a, b], i) => {
        const pa = positions[a];
        const pb = positions[b];
        if (!pa || !pb) return null;
        const points = new Float32Array([pa.x, pa.y, pa.z, pb.x, pb.y, pb.z]);
        return (
          <line key={`${a}-${b}-${i}`}>
            <bufferGeometry>
              <bufferAttribute attach="attributes-position" args={[points, 3]} count={2} />
            </bufferGeometry>
            <lineBasicMaterial color="#2D5F6B" transparent opacity={opacity} />
          </line>
        );
      })}
    </group>
  );
}

/* ---- Constellation Scene ---- */

function ConstellationScene({ isHovered }: { isHovered: boolean }) {
  const hoveredRef = useRef(isHovered);
  hoveredRef.current = isHovered;

  const groupRef = useRef<THREE.Group>(null);
  const rotSpeed = useRef(0.002);
  const tightenFactor = useRef(1.0);
  const hoverEdgeOpacity = useRef(0.0);

  const basePositions = useMemo(() => goldenSpiralPositions(ICONS.length, 2.5), []);

  /* Mutable current positions for edge drawing */
  const currentPositions = useRef<THREE.Vector3[]>(basePositions.map((p) => p.clone()));

  /* Refs for each icon group to animate position */
  const iconGroupRefs = useRef<(THREE.Group | null)[]>(Array(ICONS.length).fill(null));

  useFrame(({ clock }) => {
    if (!groupRef.current) return;

    /* Rotation */
    const targetSpeed = hoveredRef.current ? 0.006 : 0.002;
    rotSpeed.current += (targetSpeed - rotSpeed.current) * 0.05;
    groupRef.current.rotation.y += rotSpeed.current;

    /* Tighten toward center on hover */
    const targetTighten = hoveredRef.current ? 0.72 : 1.0;
    tightenFactor.current += (targetTighten - tightenFactor.current) * 0.04;

    /* Hover edge fade */
    const targetEdgeOpacity = hoveredRef.current ? 0.15 : 0.0;
    hoverEdgeOpacity.current += (targetEdgeOpacity - hoverEdgeOpacity.current) * 0.06;

    /* Update icon positions with bob + tighten */
    const t = clock.getElapsedTime();
    for (let i = 0; i < ICONS.length; i++) {
      const ref = iconGroupRefs.current[i];
      if (!ref) continue;
      const base = basePositions[i];
      const bob = Math.sin(t * 0.8 + i * 1.1) * 0.08;
      ref.position.set(
        base.x * tightenFactor.current,
        base.y * tightenFactor.current + bob,
        base.z * tightenFactor.current,
      );
      currentPositions.current[i].copy(ref.position);
    }
  });

  const { camera } = useThree();
  useMemo(() => {
    camera.position.set(0, 0, 7);
    camera.lookAt(0, 0, 0);
  }, [camera]);

  return (
    <>
      <ambientLight intensity={0.6} color={0xf4f3f0} />
      <directionalLight position={[3, 5, 4]} intensity={0.35} color={0xfff5e8} />

      <group ref={groupRef}>
        {/* Default edges */}
        <EdgeLines positions={currentPositions.current} edges={DEFAULT_EDGES} opacity={0.1} />
        {/* Hover edges */}
        <EdgeLines positions={currentPositions.current} edges={HOVER_EDGES} opacity={hoverEdgeOpacity.current} />

        {/* Icon nodes */}
        {ICONS.map((icon, i) => {
          const pos = basePositions[i];
          const colorNum = parseInt(icon.color.slice(1), 16);
          return (
            <group
              key={icon.id}
              position={[pos.x, pos.y, pos.z]}
              ref={(el) => { iconGroupRefs.current[i] = el; }}
            >
              <IconShape shape={icon.id} color={colorNum} />
              <Html
                position={[0, 0.3, 0]}
                center
                distanceFactor={7}
                style={{ pointerEvents: 'none', whiteSpace: 'nowrap' }}
              >
                <span
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 9,
                    fontWeight: 500,
                    color: icon.color,
                    opacity: 0.65,
                    textShadow: '0 0 6px rgba(240,235,228,0.9)',
                  }}
                >
                  {icon.label}
                </span>
              </Html>
            </group>
          );
        })}
      </group>
    </>
  );
}

/* ---- Exported Component ---- */

export default function CommonPlaceVisual3D({ isHovered }: { isHovered: boolean }) {
  const prefersReducedMotion = usePrefersReducedMotion();

  if (prefersReducedMotion) {
    return <CommonPlaceVisual isHovered={isHovered} />;
  }

  return (
    <Suspense fallback={<CommonPlaceVisual isHovered={isHovered} />}>
      <Canvas
        gl={{ alpha: true, antialias: true }}
        camera={{ fov: 45, near: 0.1, far: 100, position: [0, 0, 7] }}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          background: 'transparent',
        }}
      >
        <ConstellationScene isHovered={isHovered} />
      </Canvas>
    </Suspense>
  );
}
