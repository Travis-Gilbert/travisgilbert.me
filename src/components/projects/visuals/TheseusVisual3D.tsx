'use client';

import { useRef, useMemo, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import TheseusVisual from './TheseusVisual';

/* ---- Data ---- */

const PASSES = [
  { label: 'NER', color: '#C4503C' },
  { label: 'BM25', color: '#2D5F6B' },
  { label: 'SBERT', color: '#C49A4A' },
  { label: 'NLI', color: '#6B4F7A' },
  { label: 'RotatE', color: '#4A7A5A' },
  { label: 'Louvain', color: '#C4503C' },
];

const OBJECTS = [
  { label: 'Source', color: '#1A7A8A' },
  { label: 'Concept', color: '#7050A0' },
  { label: 'Claim', color: '#3858B8' },
  { label: 'Tension', color: '#B85C28' },
  { label: 'Hunch', color: '#C07040' },
  { label: 'Note', color: '#68666E' },
  { label: 'Rule', color: '#A08020' },
];

/* ---- Seeded PRNG ---- */

function mulberry32(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---- Inner Ring: Engine Passes ---- */

function InnerRing({ hovered }: { hovered: React.MutableRefObject<boolean> }) {
  const groupRef = useRef<THREE.Group>(null);
  const speedRef = useRef(0.003);

  useFrame(() => {
    if (!groupRef.current) return;
    const target = hovered.current ? 0.014 : 0.003;
    speedRef.current += (target - speedRef.current) * 0.05;
    groupRef.current.rotation.y += speedRef.current;
  });

  return (
    <group ref={groupRef} rotation={[0.44, 0, 0]}>
      {/* Ring torus */}
      <mesh>
        <torusGeometry args={[2.0, 0.008, 8, 64]} />
        <meshBasicMaterial color="#C4503C" transparent opacity={0.18} />
      </mesh>

      {/* Pass spheres */}
      {PASSES.map((pass, i) => {
        const angle = (i / PASSES.length) * Math.PI * 2;
        const x = Math.cos(angle) * 2.0;
        const z = Math.sin(angle) * 2.0;
        const colorNum = parseInt(pass.color.slice(1), 16);
        return (
          <group key={pass.label} position={[x, 0, z]}>
            {/* Glow shell */}
            <mesh scale={0.35}>
              <sphereGeometry args={[1, 10, 10]} />
              <meshBasicMaterial color={colorNum} transparent opacity={0.06} />
            </mesh>
            {/* Node */}
            <mesh>
              <sphereGeometry args={[0.15, 12, 12]} />
              <meshPhongMaterial
                color={colorNum}
                emissive={colorNum}
                emissiveIntensity={0.25}
                transparent
                opacity={0.8}
              />
            </mesh>
            {/* Label */}
            <Html
              position={[0, 0.32, 0]}
              center
              distanceFactor={6}
              style={{ pointerEvents: 'none', whiteSpace: 'nowrap' }}
            >
              <span
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: '0.05em',
                  color: pass.color,
                  textShadow: '0 0 8px rgba(28,28,32,0.9)',
                }}
              >
                {pass.label}
              </span>
            </Html>
          </group>
        );
      })}
    </group>
  );
}

/* ---- Middle Ring: Object Types ---- */

function MiddleRing({ hovered }: { hovered: React.MutableRefObject<boolean> }) {
  const groupRef = useRef<THREE.Group>(null);
  const speedRef = useRef(-0.002);

  useFrame(() => {
    if (!groupRef.current) return;
    const target = hovered.current ? -0.009 : -0.002;
    speedRef.current += (target - speedRef.current) * 0.05;
    groupRef.current.rotation.y += speedRef.current;
  });

  return (
    <group ref={groupRef} rotation={[0.96, 0, 0.5]}>
      {/* Ring torus */}
      <mesh>
        <torusGeometry args={[3.2, 0.006, 8, 64]} />
        <meshBasicMaterial color="#8A8378" transparent opacity={0.1} />
      </mesh>

      {/* Object spheres */}
      {OBJECTS.map((obj, i) => {
        const angle = (i / OBJECTS.length) * Math.PI * 2;
        const x = Math.cos(angle) * 3.2;
        const z = Math.sin(angle) * 3.2;
        const colorNum = parseInt(obj.color.slice(1), 16);
        return (
          <group key={obj.label} position={[x, 0, z]}>
            <mesh>
              <sphereGeometry args={[0.1, 10, 10]} />
              <meshPhongMaterial
                color={colorNum}
                emissive={colorNum}
                emissiveIntensity={0.15}
                transparent
                opacity={0.55}
              />
            </mesh>
            <Html
              position={[0, 0.25, 0]}
              center
              distanceFactor={8}
              style={{ pointerEvents: 'none', whiteSpace: 'nowrap' }}
            >
              <span
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 8,
                  fontWeight: 500,
                  color: obj.color,
                  opacity: 0.6,
                  textShadow: '0 0 6px rgba(28,28,32,0.8)',
                }}
              >
                {obj.label}
              </span>
            </Html>
          </group>
        );
      })}
    </group>
  );
}

/* ---- Outer Field: Evidence Particles ---- */

function EvidenceParticles() {
  const pointsRef = useRef<THREE.Points>(null);

  const { positions, count } = useMemo(() => {
    const rng = mulberry32(77);
    const n = 50;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      // Spherical shell between radius 4.0 and 5.5
      const r = 4.0 + rng() * 1.5;
      const theta = rng() * Math.PI * 2;
      const phi = Math.acos(2 * rng() - 1);
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.6;
      pos[i * 3 + 2] = r * Math.cos(phi);
    }
    return { positions: pos, count: n };
  }, []);

  useFrame(({ clock }) => {
    if (!pointsRef.current) return;
    pointsRef.current.rotation.y = clock.getElapsedTime() * 0.001;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
          count={count}
        />
      </bufferGeometry>
      <pointsMaterial color="#D4D0C8" size={0.06} transparent opacity={0.3} sizeAttenuation />
    </points>
  );
}

/* ---- Center Hub ---- */

function CenterHub({ hovered }: { hovered: React.MutableRefObject<boolean> }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const t = clock.getElapsedTime();
    const pulse = 1 + Math.sin(t * 2) * 0.08;
    meshRef.current.scale.setScalar(pulse);
    if (glowRef.current) {
      const targetOpacity = hovered.current ? 0.1 : 0.05;
      const mat = glowRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity += (targetOpacity - mat.opacity) * 0.05;
    }
  });

  return (
    <group>
      <mesh ref={meshRef}>
        <sphereGeometry args={[0.08, 12, 12]} />
        <meshPhongMaterial
          color={0xc4503c}
          emissive={0xc4503c}
          emissiveIntensity={0.5}
        />
      </mesh>
      <mesh ref={glowRef} scale={4}>
        <sphereGeometry args={[0.1, 10, 10]} />
        <meshBasicMaterial color={0xc4503c} transparent opacity={0.05} />
      </mesh>
    </group>
  );
}

/* ---- Camera ---- */

function FixedCamera() {
  const { camera } = useThree();
  useMemo(() => {
    camera.position.set(0, 3, 8);
    camera.lookAt(0, 0, 0);
  }, [camera]);
  return null;
}

/* ---- Scene ---- */

function OrreryScene({ isHovered }: { isHovered: boolean }) {
  const hoveredRef = useRef(isHovered);
  hoveredRef.current = isHovered;

  return (
    <>
      <FixedCamera />
      <ambientLight intensity={0.5} color={0xf4f3f0} />
      <directionalLight position={[4, 6, 3]} intensity={0.4} color={0xffeedd} />
      <directionalLight position={[-3, -2, -4]} intensity={0.1} color={0xc4503c} />

      <CenterHub hovered={hoveredRef} />
      <InnerRing hovered={hoveredRef} />
      <MiddleRing hovered={hoveredRef} />
      <EvidenceParticles />
    </>
  );
}

/* ---- Exported Component ---- */

export default function TheseusVisual3D({ isHovered }: { isHovered: boolean }) {
  const prefersReducedMotion = usePrefersReducedMotion();

  if (prefersReducedMotion) {
    return <TheseusVisual isHovered={isHovered} />;
  }

  return (
    <Suspense fallback={<TheseusVisual isHovered={isHovered} />}>
      <Canvas
        gl={{ alpha: true, antialias: true }}
        camera={{ fov: 40, near: 0.1, far: 100, position: [0, 3, 8] }}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          background: 'transparent',
        }}
      >
        <OrreryScene isHovered={isHovered} />
      </Canvas>
    </Suspense>
  );
}
