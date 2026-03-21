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

/* ---- Solid Core: layered glow + dense particle cloud ---- */

function SolidCore({ hovered }: { hovered: React.MutableRefObject<boolean> }) {
  const coreRef = useRef<THREE.Mesh>(null);
  const glowRefs = useRef<THREE.Mesh[]>([]);

  useFrame(({ clock }) => {
    if (!coreRef.current) return;
    const t = clock.getElapsedTime();
    const pulse = 1 + Math.sin(t * 1.5) * 0.06;
    coreRef.current.scale.setScalar(pulse);

    /* Breathe the glow layers */
    glowRefs.current.forEach((mesh, i) => {
      if (!mesh) return;
      const mat = mesh.material as THREE.MeshBasicMaterial;
      const baseOpacity = [0.12, 0.06, 0.03][i] ?? 0.03;
      const targetBoost = hovered.current ? 1.6 : 1.0;
      mat.opacity += (baseOpacity * targetBoost - mat.opacity) * 0.04;
      mesh.scale.setScalar(1 + Math.sin(t * 0.8 + i * 1.2) * 0.04);
    });
  });

  return (
    <group>
      {/* Solid core sphere */}
      <mesh ref={coreRef}>
        <sphereGeometry args={[0.35, 20, 20]} />
        <meshPhongMaterial
          color={0xc4503c}
          emissive={0xc4503c}
          emissiveIntensity={0.6}
          shininess={40}
          transparent
          opacity={0.85}
        />
      </mesh>

      {/* 3 concentric glow shells */}
      {[0.9, 1.6, 2.8].map((scale, i) => (
        <mesh
          key={i}
          scale={scale}
          ref={(el) => { if (el) glowRefs.current[i] = el; }}
        >
          <sphereGeometry args={[0.35, 14, 14]} />
          <meshBasicMaterial
            color={0xc4503c}
            transparent
            opacity={[0.12, 0.06, 0.03][i]}
            depthWrite={false}
          />
        </mesh>
      ))}

      {/* Wireframe accent ring around core */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.5, 0.006, 8, 32]} />
        <meshBasicMaterial color={0xc4503c} transparent opacity={0.25} />
      </mesh>
      <mesh rotation={[0.3, Math.PI / 3, 0]}>
        <torusGeometry args={[0.55, 0.005, 8, 32]} />
        <meshBasicMaterial color={0xc4503c} transparent opacity={0.12} />
      </mesh>
    </group>
  );
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
        <torusGeometry args={[1.8, 0.01, 8, 64]} />
        <meshBasicMaterial color="#C4503C" transparent opacity={0.2} />
      </mesh>

      {/* Pass spheres (larger, more visible) */}
      {PASSES.map((pass, i) => {
        const angle = (i / PASSES.length) * Math.PI * 2;
        const x = Math.cos(angle) * 1.8;
        const z = Math.sin(angle) * 1.8;
        const colorNum = parseInt(pass.color.slice(1), 16);
        return (
          <group key={pass.label} position={[x, 0, z]}>
            {/* Glow shell */}
            <mesh scale={0.55}>
              <sphereGeometry args={[1, 10, 10]} />
              <meshBasicMaterial color={colorNum} transparent opacity={0.08} depthWrite={false} />
            </mesh>
            {/* Node */}
            <mesh>
              <sphereGeometry args={[0.2, 14, 14]} />
              <meshPhongMaterial
                color={colorNum}
                emissive={colorNum}
                emissiveIntensity={0.3}
                transparent
                opacity={0.85}
                shininess={30}
              />
            </mesh>
            {/* Label */}
            <Html
              position={[0, 0.38, 0]}
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
                  textShadow: '0 1px 4px rgba(0,0,0,0.5), 0 0 12px rgba(0,0,0,0.3)',
                }}
              >
                {pass.label}
              </span>
            </Html>
          </group>
        );
      })}

      {/* Cross-connection lines between non-adjacent passes for web density */}
      {[
        [0, 2], [0, 3], [1, 3], [1, 4], [2, 4], [2, 5], [3, 5],
      ].map(([a, b]) => {
        const aAngle = (a / PASSES.length) * Math.PI * 2;
        const bAngle = (b / PASSES.length) * Math.PI * 2;
        const points = new Float32Array([
          Math.cos(aAngle) * 1.8, 0, Math.sin(aAngle) * 1.8,
          Math.cos(bAngle) * 1.8, 0, Math.sin(bAngle) * 1.8,
        ]);
        return (
          <line key={`cross-${a}-${b}`}>
            <bufferGeometry>
              <bufferAttribute attach="attributes-position" args={[points, 3]} count={2} />
            </bufferGeometry>
            <lineBasicMaterial color="#C4503C" transparent opacity={0.06} />
          </line>
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
        <torusGeometry args={[3.0, 0.007, 8, 64]} />
        <meshBasicMaterial color="#8A8378" transparent opacity={0.1} />
      </mesh>

      {/* Object spheres */}
      {OBJECTS.map((obj, i) => {
        const angle = (i / OBJECTS.length) * Math.PI * 2;
        const x = Math.cos(angle) * 3.0;
        const z = Math.sin(angle) * 3.0;
        const colorNum = parseInt(obj.color.slice(1), 16);
        return (
          <group key={obj.label} position={[x, 0, z]}>
            <mesh>
              <sphereGeometry args={[0.12, 10, 10]} />
              <meshPhongMaterial
                color={colorNum}
                emissive={colorNum}
                emissiveIntensity={0.2}
                transparent
                opacity={0.6}
              />
            </mesh>
            <Html
              position={[0, 0.28, 0]}
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
                  opacity: 0.65,
                  textShadow: '0 1px 3px rgba(0,0,0,0.4)',
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

/* ---- Evidence Particles: denser, with inner cloud ---- */

function EvidenceParticles() {
  const pointsRef = useRef<THREE.Points>(null);

  const { positions, count } = useMemo(() => {
    const rng = mulberry32(77);
    const n = 140;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      /* Mix: 40% in dense inner cloud (r 0.8-2.0), 60% in outer shell (r 3.5-5.0) */
      const isInner = i < n * 0.4;
      const r = isInner
        ? 0.8 + rng() * 1.2
        : 3.5 + rng() * 1.5;
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
    pointsRef.current.rotation.y = clock.getElapsedTime() * 0.002;
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
      <pointsMaterial color="#D4D0C8" size={0.05} transparent opacity={0.35} sizeAttenuation />
    </points>
  );
}

/* ---- Spoke lines from core to each pass ---- */

function CoreSpokes() {
  return (
    <group rotation={[0.44, 0, 0]}>
      {PASSES.map((_, i) => {
        const angle = (i / PASSES.length) * Math.PI * 2;
        const points = new Float32Array([
          0, 0, 0,
          Math.cos(angle) * 1.8, 0, Math.sin(angle) * 1.8,
        ]);
        return (
          <line key={`spoke-${i}`}>
            <bufferGeometry>
              <bufferAttribute attach="attributes-position" args={[points, 3]} count={2} />
            </bufferGeometry>
            <lineBasicMaterial color="#C4503C" transparent opacity={0.08} />
          </line>
        );
      })}
    </group>
  );
}

/* ---- Camera ---- */

function FixedCamera() {
  const { camera } = useThree();
  useMemo(() => {
    camera.position.set(0, 2.5, 7);
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
      <ambientLight intensity={0.45} color={0xf4f3f0} />
      <directionalLight position={[4, 6, 3]} intensity={0.5} color={0xffeedd} />
      <directionalLight position={[-3, -2, -4]} intensity={0.15} color={0xc4503c} />

      <SolidCore hovered={hoveredRef} />
      <CoreSpokes />
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
        camera={{ fov: 40, near: 0.1, far: 100, position: [0, 2.5, 7] }}
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
