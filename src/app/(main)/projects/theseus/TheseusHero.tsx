'use client';

import { useRef, useState, useMemo, useCallback, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { HUBS } from './theseus-data';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';

// ── 3D Scene Constants ──

const FOG_COLOR_LIGHT = 0xF2EDE5;
const FOG_COLOR_DARK = 0x141210;
const HUB_RADIUS = 8;

interface HubMeshData {
  id: string;
  label: string;
  color: number;
  size: number;
  position: THREE.Vector3;
  info: string;
  leafCount: number;
}

interface LeafMeshData {
  hubId: string;
  label: string;
  color: number;
  position: THREE.Vector3;
}

function buildSceneData() {
  const hubs: HubMeshData[] = [];
  const leaves: LeafMeshData[] = [];
  const hubCount = HUBS.length - 1;

  // Deterministic seeded random for consistent SSG
  let seed = 42;
  const seededRandom = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  HUBS.forEach((hub, i) => {
    let pos: THREE.Vector3;
    if (hub.id === 'root') {
      pos = new THREE.Vector3(0, 0, 0);
    } else {
      const angle = ((i - 1) / hubCount) * Math.PI * 2 - Math.PI / 2;
      const yOff = (seededRandom() - 0.5) * 3;
      pos = new THREE.Vector3(
        Math.cos(angle) * HUB_RADIUS,
        yOff,
        Math.sin(angle) * HUB_RADIUS,
      );
    }

    const color = parseInt(hub.color.replace('#', ''), 16);
    hubs.push({
      id: hub.id,
      label: hub.label,
      color,
      size: hub.size,
      position: pos,
      info: hub.info,
      leafCount: hub.leaves.length,
    });

    // Leaf nodes clustered around hub
    const leafRadius = hub.size * 3 + 1;
    hub.leaves.forEach((leafLabel, li) => {
      const leafAngle = (li / hub.leaves.length) * Math.PI * 2;
      const leafElev = (seededRandom() - 0.5) * 2;
      const leafPos = new THREE.Vector3(
        pos.x + Math.cos(leafAngle) * leafRadius * (0.7 + seededRandom() * 0.6),
        pos.y + leafElev,
        pos.z + Math.sin(leafAngle) * leafRadius * (0.7 + seededRandom() * 0.6),
      );
      leaves.push({ hubId: hub.id, label: leafLabel, color, position: leafPos });
    });
  });

  return { hubs, leaves };
}

// ── Hub Sphere ──

function HubSphere({
  data,
  onHover,
  onUnhover,
  dimmed,
}: {
  data: HubMeshData;
  onHover: (id: string) => void;
  onUnhover: () => void;
  dimmed: boolean;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const baseScale = data.size;

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const t = clock.getElapsedTime();
    const pulse = baseScale * (1 + 0.04 * Math.sin(t * 1.5 + HUBS.findIndex(h => h.id === data.id) * 0.7));
    meshRef.current.scale.setScalar(pulse);
  });

  const isRoot = data.id === 'root';

  return (
    <group position={data.position}>
      {/* Main sphere */}
      <mesh
        ref={meshRef}
        onPointerOver={() => onHover(data.id)}
        onPointerOut={onUnhover}
      >
        <sphereGeometry args={[1, 20, 20]} />
        <meshPhongMaterial
          color={data.color}
          emissive={data.color}
          emissiveIntensity={isRoot ? 0.3 : 0.15}
          transparent
          opacity={dimmed ? 0.05 : (isRoot ? 0.5 : 0.2)}
          shininess={30}
        />
      </mesh>

      {/* Wireframe ring */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[data.size * 1.1, 0.01, 8, 32]} />
        <meshBasicMaterial
          color={data.color}
          transparent
          opacity={dimmed ? 0.03 : 0.3}
        />
      </mesh>

      {/* Glow shell */}
      <mesh scale={data.size * 2.5}>
        <sphereGeometry args={[1, 12, 12]} />
        <meshBasicMaterial
          color={data.color}
          transparent
          opacity={dimmed ? 0.01 : 0.04}
        />
      </mesh>
    </group>
  );
}

// ── Leaf Node ──

function LeafNode({ data, dimmed }: { data: LeafMeshData; dimmed: boolean }) {
  return (
    <mesh position={data.position} scale={0.08}>
      <sphereGeometry args={[1, 8, 8]} />
      <meshPhongMaterial
        color={data.color}
        emissive={data.color}
        emissiveIntensity={0.1}
        shininess={20}
        transparent={dimmed}
        opacity={dimmed ? 0.1 : 1}
      />
    </mesh>
  );
}

// ── Edge Lines ──

function EdgeLines({
  hubs,
  leaves,
  dimmedHub,
}: {
  hubs: HubMeshData[];
  leaves: LeafMeshData[];
  dimmedHub: string | null;
}) {
  const rootPos = hubs.find(h => h.id === 'root')?.position;

  return (
    <group>
      {/* Hub-to-root spine edges */}
      {hubs
        .filter(h => h.id !== 'root')
        .map(h => {
          if (!rootPos) return null;
          const points = [rootPos, h.position];
          const dimmed = dimmedHub !== null && dimmedHub !== h.id && dimmedHub !== 'root';
          return (
            <line key={`spine-${h.id}`}>
              <bufferGeometry>
                <bufferAttribute
                  attach="attributes-position"
                  args={[new Float32Array(points.flatMap(p => [p.x, p.y, p.z])), 3]}
                />
              </bufferGeometry>
              <lineBasicMaterial
                color={0x2A2420}
                transparent
                opacity={dimmed ? 0.02 : 0.1}
              />
            </line>
          );
        })}

      {/* Leaf-to-hub edges */}
      {leaves.map((leaf, i) => {
        const hub = hubs.find(h => h.id === leaf.hubId);
        if (!hub) return null;
        const dimmed = dimmedHub !== null && dimmedHub !== leaf.hubId;
        const points = [hub.position, leaf.position];
        return (
          <line key={`leaf-edge-${i}`}>
            <bufferGeometry>
              <bufferAttribute
                attach="attributes-position"
                args={[new Float32Array(points.flatMap(p => [p.x, p.y, p.z])), 3]}
              />
            </bufferGeometry>
            <lineBasicMaterial
              color={leaf.color}
              transparent
              opacity={dimmed ? 0.01 : 0.08}
            />
          </line>
        );
      })}
    </group>
  );
}

// ── HTML Hub Labels ──

function HubLabels({ hubs, dimmedHub }: { hubs: HubMeshData[]; dimmedHub: string | null }) {
  return (
    <>
      {hubs.map(h => {
        // Skip root label to keep center dot clean against the title text
        if (h.id === 'root') return null;
        const dimmed = dimmedHub !== null && dimmedHub !== h.id && dimmedHub !== 'root';
        const isRoot = false;
        const colorHex = '#' + h.color.toString(16).padStart(6, '0');
        return (
          <Html
            key={h.id}
            position={[h.position.x, h.position.y + (isRoot ? 1.2 : 0.8), h.position.z]}
            center
            distanceFactor={12}
            style={{
              pointerEvents: 'none',
              opacity: dimmed ? 0.15 : 1,
              transition: 'opacity 0.2s',
              whiteSpace: 'nowrap',
            }}
          >
            <div style={{ textAlign: 'center' }}>
              <span
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '10px',
                  fontWeight: 600,
                  letterSpacing: '0.06em',
                  color: colorHex,
                  textShadow: '0 0 12px rgba(242,237,229,0.9), 0 0 24px rgba(242,237,229,0.7)',
                }}
              >
                {h.label}
              </span>
              {h.leafCount > 0 && (
                <span
                  style={{
                    display: 'block',
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: '8px',
                    color: '#9A8E82',
                    textShadow: '0 0 8px rgba(242,237,229,0.9)',
                  }}
                >
                  {h.leafCount} features
                </span>
              )}
            </div>
          </Html>
        );
      })}
    </>
  );
}

// ── Scene Spinner: gyroscope spin (scene rotates, camera is fixed) ──

function SceneSpinner({ reducedMotion, children }: { reducedMotion: boolean; children: React.ReactNode }) {
  const groupRef = useRef<THREE.Group>(null);
  const spinVel = useRef(0);
  const isDragging = useRef(false);
  const prevMouseX = useRef(0);
  const autoSpin = useRef(true);
  const autoSpinTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const canvas = document.querySelector('.theseus-hero canvas');
    if (!canvas) return;

    const onPointerDown = (e: Event) => {
      const me = e as PointerEvent;
      isDragging.current = true;
      autoSpin.current = false;
      if (autoSpinTimeout.current) clearTimeout(autoSpinTimeout.current);
      prevMouseX.current = me.clientX;
    };

    const onPointerMove = (e: Event) => {
      if (!isDragging.current) return;
      const me = e as PointerEvent;
      spinVel.current += (me.clientX - prevMouseX.current) * 0.003;
      prevMouseX.current = me.clientX;
    };

    const onPointerUp = () => {
      isDragging.current = false;
      autoSpinTimeout.current = setTimeout(() => {
        autoSpin.current = true;
      }, 5000);
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);

    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      if (autoSpinTimeout.current) clearTimeout(autoSpinTimeout.current);
    };
  }, []);

  useFrame(() => {
    if (!groupRef.current || reducedMotion) return;

    // Constant slow spin when not dragging
    if (autoSpin.current) spinVel.current += 0.00008;
    // Apply velocity to Y rotation (clock-hand spin)
    groupRef.current.rotation.y += spinVel.current;
    // Dampen
    spinVel.current *= 0.96;
  });

  return <group ref={groupRef}>{children}</group>;
}

// ── Fixed Camera ──

function FixedCamera() {
  const { camera } = useThree();
  // Set once: elevated view looking at origin, never moves
  useEffect(() => {
    camera.position.set(0, 9, 12);
    camera.lookAt(0, 0, 0);
  }, [camera]);
  return null;
}

// ── Main Scene ──

function TheseusScene({ reducedMotion, isDark }: { reducedMotion: boolean; isDark: boolean }) {
  const fogColor = isDark ? FOG_COLOR_DARK : FOG_COLOR_LIGHT;
  const [hoveredHub, setHoveredHub] = useState<string | null>(null);
  const { hubs, leaves } = useMemo(() => buildSceneData(), []);

  const handleHover = useCallback((id: string) => setHoveredHub(id), []);
  const handleUnhover = useCallback(() => setHoveredHub(null), []);

  return (
    <>
      <FixedCamera />

      {/* Lights */}
      <ambientLight color={0xF4F3F0} intensity={0.7} />
      <directionalLight color={0xFFEEDD} intensity={0.6} position={[5, 8, 6]} />
      <directionalLight color={0xC4503C} intensity={0.15} position={[-5, -3, -6]} />

      {/* Fog */}
      <fogExp2 attach="fog" args={[fogColor, 0.025]} />

      {/* Tilt toward viewer, offset so center dot sits after "you know?" */}
      <group position={[3, -1.5, 0]} rotation={[-0.7, 0, 0.15]}>
        <SceneSpinner reducedMotion={reducedMotion}>
          {/* Edges */}
          <EdgeLines hubs={hubs} leaves={leaves} dimmedHub={hoveredHub} />

          {/* Hub spheres */}
          {hubs.map(h => (
            <HubSphere
              key={h.id}
              data={h}
              onHover={handleHover}
              onUnhover={handleUnhover}
              dimmed={hoveredHub !== null && hoveredHub !== h.id && h.id !== 'root'}
            />
          ))}

          {/* Leaf nodes */}
          {leaves.map((l, i) => (
            <LeafNode
              key={i}
              data={l}
              dimmed={hoveredHub !== null && hoveredHub !== l.hubId}
            />
          ))}

          {/* Hub labels */}
          <HubLabels hubs={hubs} dimmedHub={hoveredHub} />
        </SceneSpinner>
      </group>
    </>
  );
}

// ── Exported Component ──

export default function TheseusHero() {
  const reducedMotion = usePrefersReducedMotion();
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const check = () => setIsDark(document.documentElement.getAttribute('data-theme') === 'dark');
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  return (
    <section className="theseus-hero" style={{ minHeight: 560, maxHeight: 780, height: '80vh', marginTop: '-80px', paddingTop: '80px' }}>
      {/* Text overlay: centered, imposing statement */}
      <div
        className="theseus-section text-center"
        style={{
          position: 'absolute',
          bottom: '10%',
          left: 0,
          right: 0,
          zIndex: 2,
          pointerEvents: 'none',
          padding: '0 5%',
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-code)",
            fontSize: 14,
            fontWeight: 800,
            fontStyle: 'italic',
            textTransform: 'uppercase',
            letterSpacing: '-0.02em',
            color: 'var(--color-terracotta)',
            marginBottom: 8,
            transform: 'scaleY(0.82)',
            transformOrigin: 'center bottom',
            textShadow: '0 0 12px rgba(180, 90, 45, 0.35), 0 0 4px rgba(180, 90, 45, 0.2)',
            WebkitTextStroke: '0.3px currentColor',
          }}
        >
          <span style={{ color: '#8C6B52' }}>#</span> Theseus the Epistemic Engine
        </div>
        <h1
          className="font-title"
          style={{
            fontSize: 'clamp(28px, 4.5vw, 46px)',
            fontWeight: 700,
            lineHeight: 1.18,
            letterSpacing: '-0.02em',
            color: 'var(--color-ink)',
            marginBottom: 20,
          }}
        >
          What if your tools could{' '}
          <em style={{ fontStyle: 'italic', color: 'var(--color-terracotta)' }}>reason</em> about what you know?
        </h1>
        <p
          style={{
            fontSize: 16,
            color: 'var(--color-ink-muted)',
            maxWidth: 600,
            margin: '0 auto 0',
            lineHeight: 1.7,
            fontWeight: 400,
            textShadow: '0 1px 8px rgba(242, 237, 229, 0.6), 0 0 2px rgba(242, 237, 229, 0.4)',
          }}
        >
          Every field that works with evidence faces the same problem: too many sources,
          too many connections, no way to see what contradicts what. Theseus is an engine
          that finds the structure in your knowledge.
        </p>
      </div>

      {/* Bottom gradient: long, soft dissolve from 3D scene into the page texture */}
      <div
        aria-hidden="true"
        className="theseus-hero-fade"
      />

      {/* 3D Canvas: 93% opacity lets DotGrid texture bleed through */}
      <Canvas
        camera={{ fov: 50, near: 0.1, far: 200, position: [0, 6, 22] }}
        gl={{ antialias: true, alpha: true }}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'transparent',
          opacity: 0.93,
        }}
      >
        <color attach="background" args={[isDark ? FOG_COLOR_DARK : FOG_COLOR_LIGHT]} />
        <TheseusScene reducedMotion={reducedMotion} isDark={isDark} />
      </Canvas>
    </section>
  );
}
