'use client';

import { useRef, useMemo, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import * as d3 from 'd3';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import CommonPlaceVisual from './CommonPlaceVisual';

/*
 * D3 computes the force-directed tree layout (2D positions).
 * Three.js renders the result in 3D space.
 *
 * Uses the canonical Observable force-directed tree pattern:
 *   forceLink(links).distance(0).strength(1)
 *   forceManyBody().strength(-50)
 *   forceX() + forceY()
 */

/* ---- Hierarchical tree data ---- */

interface RawNode {
  name: string;
  color: string;
  children?: RawNode[];
}

const TREE_DATA: RawNode = {
  name: 'CommonPlace',
  color: '#2D5F6B',
  children: [
    {
      name: 'Source',
      color: '#1A7A8A',
      children: [
        { name: 'PDF', color: '#1A7A8A' },
        { name: 'OCR', color: '#1A7A8A' },
        { name: 'Metadata', color: '#1A7A8A' },
        { name: 'SHA-256', color: '#1A7A8A' },
        { name: 'URL', color: '#1A7A8A' },
      ],
    },
    {
      name: 'Claim',
      color: '#3858B8',
      children: [
        { name: 'NLI', color: '#3858B8' },
        { name: 'Dedup', color: '#3858B8' },
        { name: 'Status', color: '#3858B8' },
        { name: 'Pairwise', color: '#3858B8' },
      ],
    },
    {
      name: 'Concept',
      color: '#7050A0',
      children: [
        { name: 'NER', color: '#7050A0' },
        { name: 'Phrase', color: '#7050A0' },
        { name: 'Graph', color: '#7050A0' },
        { name: 'Cross-ref', color: '#7050A0' },
      ],
    },
    {
      name: 'Tension',
      color: '#B85C28',
      children: [
        { name: 'Contradict', color: '#B85C28' },
        { name: 'Diverge', color: '#B85C28' },
        { name: 'Temporal', color: '#B85C28' },
      ],
    },
    {
      name: 'Note',
      color: '#68666E',
      children: [
        { name: 'Timeline', color: '#68666E' },
        { name: 'Immutable', color: '#68666E' },
        { name: 'Fork', color: '#68666E' },
      ],
    },
    {
      name: 'Hunch',
      color: '#C07040',
      children: [
        { name: 'Low-conf', color: '#C07040' },
        { name: 'Promote', color: '#C07040' },
        { name: 'Score', color: '#C07040' },
      ],
    },
    {
      name: 'Model',
      color: '#C4503C',
      children: [
        { name: 'Assume', color: '#C4503C' },
        { name: 'Stress', color: '#C4503C' },
        { name: 'Propose', color: '#C4503C' },
        { name: 'Confirm', color: '#C4503C' },
      ],
    },
    {
      name: 'Data',
      color: '#4A7A5A',
      children: [
        { name: 'pgvector', color: '#4A7A5A' },
        { name: 'Embed', color: '#4A7A5A' },
        { name: 'PostGIS', color: '#4A7A5A' },
      ],
    },
  ],
};

/* ---- D3 layout computation ---- */

interface LayoutNode {
  x: number;
  y: number;
  z: number; /* depth-based offset for 3D */
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
  const root = d3.hierarchy(TREE_DATA);
  const d3Links = root.links();
  const d3Nodes = root.descendants();

  /* Augment nodes with simulation-compatible properties */
  type SimNode = d3.HierarchyNode<RawNode> & {
    x: number;
    y: number;
    vx: number;
    vy: number;
  };

  const simNodes = d3Nodes as unknown as SimNode[];

  /* Canonical Observable force-directed tree pattern */
  const simulation = d3.forceSimulation(simNodes)
    .force(
      'link',
      d3.forceLink(d3Links)
        .id((_d, i) => String(i))
        .distance(0)
        .strength(1),
    )
    .force('charge', d3.forceManyBody().strength(-60))
    .force('x', d3.forceX())
    .force('y', d3.forceY());

  /* Run to completion */
  simulation.tick(300);
  simulation.stop();

  /* Map D3 2D positions to 3D layout nodes */
  /* D3 x -> Three.js x, D3 y -> Three.js z, depth -> Three.js y */
  const scale = 0.025; /* scale D3 positions to Three.js units */

  const layoutNodes: LayoutNode[] = simNodes.map((n) => ({
    x: (n.x ?? 0) * scale,
    y: n.depth * 0.15, /* slight elevation per depth level */
    z: (n.y ?? 0) * scale,
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

/* ---- Tree Node component ---- */

function TreeNodeMesh({
  node,
  showLabel,
}: {
  node: LayoutNode;
  showLabel: boolean;
}) {
  const colorNum = parseInt(node.color.slice(1), 16);
  const isRoot = node.depth === 0;
  const r = isRoot ? 0.28 : node.isLeaf ? 0.06 : 0.12;

  return (
    <group position={[node.x, node.y, node.z]}>
      {/* Observable style: parent = hollow (wireframe), leaf = filled */}
      {node.isLeaf ? (
        <mesh>
          <sphereGeometry args={[r, 10, 10]} />
          <meshPhongMaterial
            color={colorNum}
            emissive={colorNum}
            emissiveIntensity={0.15}
            transparent
            opacity={0.85}
          />
        </mesh>
      ) : (
        <>
          {/* Filled core at reduced opacity */}
          <mesh>
            <sphereGeometry args={[r, 14, 14]} />
            <meshPhongMaterial
              color={colorNum}
              emissive={colorNum}
              emissiveIntensity={isRoot ? 0.3 : 0.15}
              transparent
              opacity={isRoot ? 0.7 : 0.4}
            />
          </mesh>
          {/* Wireframe ring */}
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[r * 1.3, 0.005, 6, 24]} />
            <meshBasicMaterial color={colorNum} transparent opacity={0.25} />
          </mesh>
          {/* Glow shell */}
          <mesh scale={isRoot ? 2.2 : 1.8}>
            <sphereGeometry args={[r, 10, 10]} />
            <meshBasicMaterial color={colorNum} transparent opacity={isRoot ? 0.08 : 0.04} depthWrite={false} />
          </mesh>
        </>
      )}

      {/* Labels: root always, depth-1 on hover, leaves on hover */}
      {(isRoot || (showLabel && node.depth <= 1)) && (
        <Html
          position={[0, r + 0.15, 0]}
          center
          distanceFactor={isRoot ? 5 : 7}
          style={{ pointerEvents: 'none', whiteSpace: 'nowrap' }}
        >
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: isRoot ? 11 : 9,
              fontWeight: isRoot ? 700 : 500,
              color: node.color,
              opacity: isRoot ? 1 : 0.7,
              textShadow: '0 0 8px rgba(240,235,228,0.95), 0 1px 3px rgba(240,235,228,0.7)',
            }}
          >
            {node.name}
          </span>
        </Html>
      )}
    </group>
  );
}

/* ---- Tree Links ---- */

function TreeLinks({ links }: { links: LayoutLink[] }) {
  const lineSegments = useMemo(() => {
    const positions: number[] = [];
    for (const link of links) {
      positions.push(link.source.x, link.source.y, link.source.z);
      positions.push(link.target.x, link.target.y, link.target.z);
    }
    return new Float32Array(positions);
  }, [links]);

  return (
    <lineSegments>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[lineSegments, 3]}
          count={lineSegments.length / 3}
        />
      </bufferGeometry>
      <lineBasicMaterial color="#2D5F6B" transparent opacity={0.18} />
    </lineSegments>
  );
}

/* ---- Scene ---- */

function ForceTreeScene({ isHovered }: { isHovered: boolean }) {
  const hoveredRef = useRef(isHovered);
  hoveredRef.current = isHovered;
  const groupRef = useRef<THREE.Group>(null);
  const speedRef = useRef(0.001);

  const { nodes, links } = useMemo(() => computeTreeLayout(), []);

  const { camera } = useThree();
  useMemo(() => {
    camera.position.set(0, 3, 6);
    camera.lookAt(0, 0.3, 0);
  }, [camera]);

  useFrame(() => {
    if (!groupRef.current) return;
    const target = hoveredRef.current ? 0.004 : 0.001;
    speedRef.current += (target - speedRef.current) * 0.05;
    groupRef.current.rotation.y += speedRef.current;
  });

  return (
    <>
      <ambientLight intensity={0.55} color={0xf4f3f0} />
      <directionalLight position={[3, 6, 4]} intensity={0.4} color={0xfff5e8} />
      <directionalLight position={[-2, -1, -3]} intensity={0.08} color={0x2d5f6b} />

      <group ref={groupRef}>
        <TreeLinks links={links} />
        {nodes.map((node, i) => (
          <TreeNodeMesh
            key={`${node.name}-${i}`}
            node={node}
            showLabel={hoveredRef.current}
          />
        ))}
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
        camera={{ fov: 45, near: 0.1, far: 100, position: [0, 3, 6] }}
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
