'use client';

import { useRef, useMemo, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import * as d3 from 'd3';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import CommonPlaceVisual from './CommonPlaceVisual';

/*
 * D3 computes a force-directed tree layout (Observable canonical pattern).
 * Three.js renders the result in 3D.
 *
 * Key: link distance 0 + strength 1 pulls parent-child tight.
 * Charge -150 pushes branches apart. forceX/Y (not forceCenter)
 * allows asymmetric organic spread. Deep tree (4 levels, 120+ nodes)
 * provides the repulsion pressure needed for real branching.
 */

/* ---- Seeded PRNG for deterministic sub-leaf generation ---- */

function mulberry32(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---- Hierarchical tree data ---- */

interface RawNode {
  name: string;
  color: string;
  children?: RawNode[];
}

function buildTreeData(): RawNode {
  const rng = mulberry32(42);

  /* Helper: generate N sub-leaves for a feature node */
  function subLeaves(color: string, count: number): RawNode[] {
    return Array.from({ length: count }, () => ({
      name: '',
      color,
      children: undefined,
    }));
  }

  /* Some features get sub-sub-leaves for extra density */
  function feature(name: string, color: string, leafCount: number): RawNode {
    return {
      name,
      color,
      children: subLeaves(color, leafCount),
    };
  }

  return {
    name: 'CommonPlace',
    color: '#2D5F6B',
    children: [
      {
        name: 'Source',
        color: '#1A7A8A',
        children: [
          feature('PDF', '#1A7A8A', 3 + Math.floor(rng() * 3)),
          feature('OCR', '#1A7A8A', 2 + Math.floor(rng() * 3)),
          feature('Metadata', '#1A7A8A', 3 + Math.floor(rng() * 2)),
          feature('SHA', '#1A7A8A', 2 + Math.floor(rng() * 2)),
        ],
      },
      {
        name: 'Claim',
        color: '#3858B8',
        children: [
          feature('NLI', '#3858B8', 3 + Math.floor(rng() * 3)),
          feature('Dedup', '#3858B8', 2 + Math.floor(rng() * 2)),
          feature('Status', '#3858B8', 3 + Math.floor(rng() * 2)),
          feature('Pairwise', '#3858B8', 2 + Math.floor(rng() * 3)),
        ],
      },
      {
        name: 'Concept',
        color: '#7050A0',
        children: [
          feature('NER', '#7050A0', 4 + Math.floor(rng() * 2)),
          feature('Phrase', '#7050A0', 3 + Math.floor(rng() * 2)),
          feature('Graph', '#7050A0', 2 + Math.floor(rng() * 3)),
        ],
      },
      {
        name: 'Tension',
        color: '#B85C28',
        children: [
          feature('Contradict', '#B85C28', 3 + Math.floor(rng() * 3)),
          feature('Diverge', '#B85C28', 2 + Math.floor(rng() * 2)),
          feature('Temporal', '#B85C28', 3 + Math.floor(rng() * 2)),
        ],
      },
      {
        name: 'Note',
        color: '#68666E',
        children: [
          feature('Timeline', '#68666E', 3 + Math.floor(rng() * 2)),
          feature('Immutable', '#68666E', 2 + Math.floor(rng() * 3)),
          feature('Fork', '#68666E', 2 + Math.floor(rng() * 2)),
        ],
      },
      {
        name: 'Hunch',
        color: '#C07040',
        children: [
          feature('Low-conf', '#C07040', 2 + Math.floor(rng() * 3)),
          feature('Promote', '#C07040', 3 + Math.floor(rng() * 2)),
          feature('Score', '#C07040', 2 + Math.floor(rng() * 2)),
        ],
      },
      {
        name: 'Model',
        color: '#C4503C',
        children: [
          feature('Assume', '#C4503C', 3 + Math.floor(rng() * 3)),
          feature('Stress', '#C4503C', 2 + Math.floor(rng() * 2)),
          feature('Propose', '#C4503C', 3 + Math.floor(rng() * 2)),
          feature('Confirm', '#C4503C', 2 + Math.floor(rng() * 2)),
        ],
      },
      {
        name: 'Data',
        color: '#4A7A5A',
        children: [
          feature('pgvector', '#4A7A5A', 3 + Math.floor(rng() * 2)),
          feature('Embed', '#4A7A5A', 2 + Math.floor(rng() * 3)),
          feature('PostGIS', '#4A7A5A', 2 + Math.floor(rng() * 2)),
        ],
      },
    ],
  };
}

/* ---- D3 layout computation ---- */

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
    x: number;
    y: number;
    vx: number;
    vy: number;
  };

  const simNodes = d3Nodes as unknown as SimNode[];

  /*
   * Observable canonical force-directed tree:
   * - link distance 0 + strength 1: collapses parent-child pairs
   * - charge -150: pushes branches apart (strong enough for 120+ nodes)
   * - forceX + forceY (NOT forceCenter): allows asymmetric spread
   */
  const simulation = d3.forceSimulation(simNodes)
    .force(
      'link',
      d3.forceLink(d3Links)
        .id((_d, i) => String(i))
        .distance(0)
        .strength(1),
    )
    .force('charge', d3.forceManyBody().strength(-150))
    .force('x', d3.forceX())
    .force('y', d3.forceY());

  /* Run 400 ticks to fully settle */
  simulation.tick(400);
  simulation.stop();

  /*
   * Scale: D3 with -150 charge and 120+ nodes spreads to roughly
   * +/-400 px. Scale 0.012 maps that to +/-4.8 Three.js units.
   * Camera at [0, 6, 12] with FOV 50 sees about +/-7 units.
   */
  const SCALE = 0.012;

  const layoutNodes: LayoutNode[] = simNodes.map((n) => ({
    x: (n.x ?? 0) * SCALE,
    y: n.depth * 0.08,
    z: (n.y ?? 0) * SCALE,
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

/* ---- Tree Links (lineSegments for efficiency) ---- */

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
      <lineBasicMaterial color="#999999" transparent opacity={0.35} />
    </lineSegments>
  );
}

/* ---- Tree Nodes (instanced for performance) ---- */

function TreeNodes({
  nodes,
  showLabels,
}: {
  nodes: LayoutNode[];
  showLabels: boolean;
}) {
  return (
    <group>
      {nodes.map((node, i) => {
        const colorNum = parseInt(node.color.slice(1), 16);
        const isRoot = node.depth === 0;

        /* Observable style sizing */
        const r = isRoot ? 0.22 : node.depth === 1 ? 0.1 : node.isLeaf ? 0.04 : 0.06;

        return (
          <group key={i} position={[node.x, node.y, node.z]}>
            {/*
             * Observable style:
             * - Parent nodes: white fill, dark stroke (wireframe ring)
             * - Leaf nodes: dark fill, white stroke
             */}
            {node.isLeaf ? (
              /* Leaf: filled sphere */
              <mesh>
                <sphereGeometry args={[r, 8, 8]} />
                <meshPhongMaterial
                  color={colorNum}
                  emissive={colorNum}
                  emissiveIntensity={0.1}
                />
              </mesh>
            ) : (
              /* Parent: semi-transparent core + wireframe ring */
              <>
                <mesh>
                  <sphereGeometry args={[r, 12, 12]} />
                  <meshPhongMaterial
                    color={0xf4f3f0}
                    emissive={colorNum}
                    emissiveIntensity={isRoot ? 0.25 : 0.1}
                    transparent
                    opacity={isRoot ? 0.85 : 0.65}
                  />
                </mesh>
                {/* Dark stroke ring (Observable style) */}
                <mesh rotation={[Math.PI / 2, 0, 0]}>
                  <torusGeometry args={[r, r * 0.12, 6, 20]} />
                  <meshBasicMaterial color={colorNum} transparent opacity={0.5} />
                </mesh>
                {/* Glow for root and depth-1 */}
                {node.depth < 2 && (
                  <mesh scale={isRoot ? 2.5 : 1.8}>
                    <sphereGeometry args={[r, 8, 8]} />
                    <meshBasicMaterial
                      color={colorNum}
                      transparent
                      opacity={isRoot ? 0.06 : 0.03}
                      depthWrite={false}
                    />
                  </mesh>
                )}
              </>
            )}

            {/* Labels: root always visible, depth-1 on hover */}
            {(isRoot || (showLabels && node.depth === 1)) && node.name && (
              <Html
                position={[0, r + 0.12, 0]}
                center
                distanceFactor={isRoot ? 6 : 9}
                style={{ pointerEvents: 'none', whiteSpace: 'nowrap' }}
              >
                <span
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: isRoot ? 12 : 9,
                    fontWeight: isRoot ? 700 : 500,
                    color: node.color,
                    opacity: isRoot ? 1 : 0.75,
                    textShadow:
                      '0 0 8px rgba(244,243,240,0.95), 0 1px 4px rgba(244,243,240,0.8)',
                  }}
                >
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

  const { camera } = useThree();
  useMemo(() => {
    camera.position.set(0, 5, 10);
    camera.lookAt(0, 0.2, 0);
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

/* ---- Exported Component ---- */

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
        camera={{ fov: 50, near: 0.1, far: 100, position: [0, 5, 10] }}
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
