'use client';

import { useRef, useMemo, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import * as d3 from 'd3';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import CommonPlaceVisual from './CommonPlaceVisual';

/*
 * D3 force-directed tree (Observable canonical pattern).
 * D3 x,y map directly to Three.js x,y (screen plane).
 * Depth maps to z for subtle parallax on rotation.
 * Camera faces the tree head-on.
 */

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

/* ---- Tree data ---- */

interface RawNode {
  name: string;
  color: string;
  children?: RawNode[];
}

function buildTreeData(): RawNode {
  const rng = mulberry32(42);

  function leaves(color: string, n: number): RawNode[] {
    return Array.from({ length: n }, () => ({ name: '', color }));
  }

  function branch(name: string, color: string, leafCount: number): RawNode {
    return { name, color, children: leaves(color, leafCount) };
  }

  return {
    name: 'CommonPlace',
    color: '#2D5F6B',
    children: [
      {
        name: 'Source', color: '#1A7A8A',
        children: [
          branch('PDF', '#1A7A8A', 3 + Math.floor(rng() * 3)),
          branch('OCR', '#1A7A8A', 2 + Math.floor(rng() * 3)),
          branch('Meta', '#1A7A8A', 3 + Math.floor(rng() * 2)),
          branch('SHA', '#1A7A8A', 2 + Math.floor(rng() * 2)),
        ],
      },
      {
        name: 'Claim', color: '#3858B8',
        children: [
          branch('NLI', '#3858B8', 3 + Math.floor(rng() * 3)),
          branch('Dedup', '#3858B8', 2 + Math.floor(rng() * 2)),
          branch('Status', '#3858B8', 3 + Math.floor(rng() * 2)),
          branch('Pair', '#3858B8', 2 + Math.floor(rng() * 3)),
        ],
      },
      {
        name: 'Concept', color: '#7050A0',
        children: [
          branch('NER', '#7050A0', 4 + Math.floor(rng() * 2)),
          branch('Phrase', '#7050A0', 3 + Math.floor(rng() * 2)),
          branch('Graph', '#7050A0', 2 + Math.floor(rng() * 3)),
        ],
      },
      {
        name: 'Tension', color: '#B85C28',
        children: [
          branch('Contra', '#B85C28', 3 + Math.floor(rng() * 3)),
          branch('Diverge', '#B85C28', 2 + Math.floor(rng() * 2)),
          branch('Temporal', '#B85C28', 3 + Math.floor(rng() * 2)),
        ],
      },
      {
        name: 'Note', color: '#68666E',
        children: [
          branch('Time', '#68666E', 3 + Math.floor(rng() * 2)),
          branch('Immut', '#68666E', 2 + Math.floor(rng() * 3)),
          branch('Fork', '#68666E', 2 + Math.floor(rng() * 2)),
        ],
      },
      {
        name: 'Hunch', color: '#C07040',
        children: [
          branch('Low', '#C07040', 2 + Math.floor(rng() * 3)),
          branch('Promo', '#C07040', 3 + Math.floor(rng() * 2)),
          branch('Score', '#C07040', 2 + Math.floor(rng() * 2)),
        ],
      },
      {
        name: 'Model', color: '#C4503C',
        children: [
          branch('Assume', '#C4503C', 3 + Math.floor(rng() * 3)),
          branch('Stress', '#C4503C', 2 + Math.floor(rng() * 2)),
          branch('Propose', '#C4503C', 3 + Math.floor(rng() * 2)),
          branch('Confirm', '#C4503C', 2 + Math.floor(rng() * 2)),
        ],
      },
      {
        name: 'Data', color: '#4A7A5A',
        children: [
          branch('pgvec', '#4A7A5A', 3 + Math.floor(rng() * 2)),
          branch('Embed', '#4A7A5A', 2 + Math.floor(rng() * 3)),
          branch('PostGIS', '#4A7A5A', 2 + Math.floor(rng() * 2)),
        ],
      },
    ],
  };
}

/* ---- D3 layout ---- */

interface LayoutNode {
  x: number;
  y: number;
  z: number;
  name: string;
  color: string;
  depth: number;
  isLeaf: boolean;
}

interface LayoutLink {
  source: LayoutNode;
  target: LayoutNode;
}

function computeTreeLayout(): { nodes: LayoutNode[]; links: LayoutLink[] } {
  const treeData = buildTreeData();
  const root = d3.hierarchy(treeData);
  const d3Links = root.links();
  const d3Nodes = root.descendants();

  type SimNode = d3.HierarchyNode<RawNode> & {
    x: number; y: number; vx: number; vy: number;
  };

  const simNodes = d3Nodes as unknown as SimNode[];

  /* Observable canonical: distance(0) + strength(1) + charge(-200) */
  const simulation = d3.forceSimulation(simNodes)
    .force('link', d3.forceLink(d3Links)
      .id((_d, i) => String(i))
      .distance(0)
      .strength(1))
    .force('charge', d3.forceManyBody().strength(-200))
    .force('x', d3.forceX())
    .force('y', d3.forceY());

  simulation.tick(500);
  simulation.stop();

  /*
   * D3 output with -200 charge and ~130 nodes spreads roughly +-500px.
   * Scale 0.018 maps to +-9 Three.js units.
   * Camera at z=14 with FOV 55 sees about +-10 units at z=0.
   *
   * D3 x -> Three.js x (horizontal)
   * D3 y -> Three.js y (vertical, INVERTED so tree grows outward naturally)
   * depth -> Three.js z (subtle, for parallax on rotation)
   */
  const SCALE = 0.018;

  const layoutNodes: LayoutNode[] = simNodes.map((n) => ({
    x: (n.x ?? 0) * SCALE,
    y: (n.y ?? 0) * SCALE,
    z: n.depth * 0.12,
    name: n.data.name,
    color: n.data.color,
    depth: n.depth,
    isLeaf: !n.children || n.children.length === 0,
  }));

  const layoutLinks: LayoutLink[] = d3Links.map((l) => {
    const si = simNodes.indexOf(l.source as unknown as SimNode);
    const ti = simNodes.indexOf(l.target as unknown as SimNode);
    return { source: layoutNodes[si], target: layoutNodes[ti] };
  });

  return { nodes: layoutNodes, links: layoutLinks };
}

/* ---- Links ---- */

function TreeLinks({ links }: { links: LayoutLink[] }) {
  const positions = useMemo(() => {
    const arr: number[] = [];
    for (const link of links) {
      arr.push(link.source.x, link.source.y, link.source.z);
      arr.push(link.target.x, link.target.y, link.target.z);
    }
    return new Float32Array(arr);
  }, [links]);

  return (
    <lineSegments>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
          count={positions.length / 3}
        />
      </bufferGeometry>
      <lineBasicMaterial color="#999999" transparent opacity={0.4} />
    </lineSegments>
  );
}

/* ---- Nodes ---- */

function TreeNodes({ nodes, showLabels }: { nodes: LayoutNode[]; showLabels: boolean }) {
  return (
    <group>
      {nodes.map((node, i) => {
        const colorNum = parseInt(node.color.slice(1), 16);
        const isRoot = node.depth === 0;
        const r = isRoot ? 0.3 : node.depth === 1 ? 0.14 : node.isLeaf ? 0.055 : 0.08;

        return (
          <group key={i} position={[node.x, node.y, node.z]}>
            {node.isLeaf ? (
              /* Leaf: solid filled (Observable style) */
              <mesh>
                <sphereGeometry args={[r, 8, 8]} />
                <meshPhongMaterial
                  color={colorNum}
                  emissive={colorNum}
                  emissiveIntensity={0.1}
                />
              </mesh>
            ) : (
              /* Parent: light fill + colored stroke ring (Observable style) */
              <>
                <mesh>
                  <sphereGeometry args={[r, 14, 14]} />
                  <meshPhongMaterial
                    color={0xf4f3f0}
                    emissive={colorNum}
                    emissiveIntensity={isRoot ? 0.3 : 0.12}
                    transparent
                    opacity={isRoot ? 0.9 : 0.7}
                  />
                </mesh>
                <mesh rotation={[Math.PI / 2, 0, 0]}>
                  <torusGeometry args={[r * 1.05, r * 0.1, 6, 20]} />
                  <meshBasicMaterial color={colorNum} transparent opacity={0.5} />
                </mesh>
                {node.depth < 2 && (
                  <mesh scale={isRoot ? 2.5 : 1.6}>
                    <sphereGeometry args={[r, 8, 8]} />
                    <meshBasicMaterial color={colorNum} transparent opacity={isRoot ? 0.07 : 0.03} depthWrite={false} />
                  </mesh>
                )}
              </>
            )}

            {/* Labels */}
            {(isRoot || (showLabels && node.depth === 1)) && node.name && (
              <Html
                position={[0, r + 0.14, 0]}
                center
                distanceFactor={isRoot ? 5 : 8}
                style={{ pointerEvents: 'none', whiteSpace: 'nowrap' }}
              >
                <span style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: isRoot ? 12 : 9,
                  fontWeight: isRoot ? 700 : 500,
                  color: node.color,
                  opacity: isRoot ? 1 : 0.75,
                  textShadow: '0 0 8px rgba(244,243,240,0.95), 0 1px 4px rgba(244,243,240,0.8)',
                }}>
                  {node.name}
                </span>
              </Html>
            )}
          </group>
        );
      })}
    </group>
  );
}

/* ---- Scene ---- */

function ForceTreeScene({ isHovered }: { isHovered: boolean }) {
  const hoveredRef = useRef(isHovered);
  hoveredRef.current = isHovered;
  const groupRef = useRef<THREE.Group>(null);
  const speedRef = useRef(0.0008);

  const { nodes, links } = useMemo(() => computeTreeLayout(), []);

  /* Front-facing camera: look straight at the tree */
  const { camera } = useThree();
  useMemo(() => {
    camera.position.set(0, 0, 14);
    camera.lookAt(0, 0, 0);
  }, [camera]);

  useFrame(() => {
    if (!groupRef.current) return;
    const target = hoveredRef.current ? 0.004 : 0.0008;
    speedRef.current += (target - speedRef.current) * 0.04;
    groupRef.current.rotation.y += speedRef.current;
  });

  return (
    <>
      <ambientLight intensity={0.6} color={0xf4f3f0} />
      <directionalLight position={[4, 8, 5]} intensity={0.4} color={0xfff5e8} />
      <directionalLight position={[-3, -2, -4]} intensity={0.08} color={0x2d5f6b} />

      <group ref={groupRef}>
        <TreeLinks links={links} />
        <TreeNodes nodes={nodes} showLabels={hoveredRef.current} />
      </group>
    </>
  );
}

/* ---- Export ---- */

interface Props {
  isHovered: boolean;
}

export default function CommonPlaceVisual3D({ isHovered }: Props) {
  const prefersReducedMotion = usePrefersReducedMotion();

  if (prefersReducedMotion) {
    return <CommonPlaceVisual isHovered={isHovered} />;
  }

  return (
    <Suspense fallback={<CommonPlaceVisual isHovered={isHovered} />}>
      <Canvas
        gl={{ alpha: true, antialias: true }}
        camera={{ fov: 55, near: 0.1, far: 100, position: [0, 0, 14] }}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          background: 'transparent',
        }}
      >
        <ForceTreeScene isHovered={isHovered} />
      </Canvas>
    </Suspense>
  );
}
