'use client';

/**
 * Theseus SceneRenderer: R3F evidence visualization.
 *
 * Renders evidence path from the Response Protocol as an interactive
 * 3D scene. Nodes are colored/shaped by type. Edges encode strength.
 * Click nodes for detail.
 */

import { useRef, useState, useMemo, useCallback } from 'react';
import { Canvas, useFrame, type ThreeEvent } from '@react-three/fiber';
import { OrbitControls, Text, Line } from '@react-three/drei';
import type { EvidencePath, EvidenceNode, EvidenceEdge } from '@/lib/theseus-api';
import * as THREE from 'three';

/* ── Design tokens ── */

const TYPE_COLORS: Record<string, string> = {
  note: '#e8e5e0',
  source: '#2D5F6B',
  concept: '#7B5EA7',
  person: '#C4503C',
  hunch: '#C49A4A',
  event: '#4A8A96',
  task: '#D4B06A',
  substantive: '#2D5F6B',
  testimonial: '#4A8A96',
};

const ROLE_SCALE: Record<string, number> = {
  premise: 0.4,
  bridge: 0.3,
  conclusion: 0.55,
};

/* ── Layout: arrange nodes in an arc ── */

function layoutNodes(
  count: number,
  spacing: number = 3,
): Array<[number, number, number]> {
  if (count === 0) return [];
  if (count === 1) return [[0, 0, 0]];
  const positions: Array<[number, number, number]> = [];
  const totalWidth = (count - 1) * spacing;
  const startX = -totalWidth / 2;
  for (let i = 0; i < count; i++) {
    const x = startX + i * spacing;
    const y = Math.sin((i / (count - 1)) * Math.PI) * 1.2;
    positions.push([x, y, 0]);
  }
  return positions;
}

/* ── Node mesh ── */

function EvidenceNodeMesh({
  node,
  position,
  isSelected,
  isHovered,
  onSelect,
  onHover,
  onUnhover,
}: {
  node: EvidenceNode;
  position: [number, number, number];
  isSelected: boolean;
  isHovered: boolean;
  onSelect: () => void;
  onHover: () => void;
  onUnhover: () => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const color = TYPE_COLORS[node.type] || '#9a958d';
  const scale = ROLE_SCALE[node.role] || 0.4;
  const activeScale = isSelected ? scale * 1.3 : isHovered ? scale * 1.15 : scale;

  useFrame(() => {
    if (meshRef.current) {
      const s = meshRef.current.scale.x;
      const target = activeScale;
      meshRef.current.scale.setScalar(s + (target - s) * 0.1);
    }
  });

  return (
    <group position={position}>
      <mesh
        ref={meshRef}
        onClick={(e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation();
          onSelect();
        }}
        onPointerOver={(e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation();
          onHover();
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          onUnhover();
          document.body.style.cursor = 'default';
        }}
      >
        <sphereGeometry args={[1, 24, 24]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={isSelected ? 0.4 : isHovered ? 0.2 : 0.08}
          roughness={0.7}
        />
      </mesh>

      {/* Label */}
      <Text
        position={[0, -(scale + 0.5), 0]}
        fontSize={0.22}
        color="#e8e5e0"
        anchorX="center"
        anchorY="top"
        maxWidth={3}
        font="/fonts/IBMPlexSans-Regular.ttf"
      >
        {node.title.length > 40 ? node.title.slice(0, 37) + '...' : node.title}
      </Text>

      {/* Role badge */}
      <Text
        position={[0, scale + 0.35, 0]}
        fontSize={0.14}
        color="#5c5851"
        anchorX="center"
        anchorY="bottom"
        font="/fonts/CourierPrime-Regular.ttf"
      >
        {node.role.toUpperCase()}
      </Text>
    </group>
  );
}

/* ── Edge line ── */

function EvidenceEdgeLine({
  from,
  to,
  edge,
}: {
  from: [number, number, number];
  to: [number, number, number];
  edge: EvidenceEdge;
}) {
  const color =
    edge.strength >= 0.8
      ? '#4A8A96'
      : edge.strength >= 0.5
        ? '#2D5F6B'
        : '#3a3832';

  return (
    <Line
      points={[from, to]}
      color={color}
      lineWidth={1 + edge.strength * 2}
      dashed={edge.acceptance_status !== 'accepted'}
      dashSize={0.3}
      gapSize={0.2}
      opacity={0.6}
      transparent
    />
  );
}

/* ── Scene content ── */

function SceneContent({
  evidence,
  onSelectNode,
  selectedNodeId,
}: {
  evidence: EvidencePath;
  onSelectNode: (node: EvidenceNode) => void;
  selectedNodeId: number | null;
}) {
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const positions = useMemo(
    () => layoutNodes(evidence.nodes.length),
    [evidence.nodes.length],
  );
  const posMap = useMemo(() => {
    const m = new Map<number, [number, number, number]>();
    evidence.nodes.forEach((n, i) => {
      m.set(n.object_id, positions[i]);
    });
    return m;
  }, [evidence.nodes, positions]);

  return (
    <>
      <ambientLight intensity={0.3} />
      <pointLight position={[10, 10, 10]} intensity={0.5} />
      <pointLight position={[-10, -5, -10]} intensity={0.2} color="#4A8A96" />

      {/* Edges */}
      {evidence.edges.map((edge, i) => {
        const from = posMap.get(edge.from_id);
        const to = posMap.get(edge.to_id);
        if (!from || !to) return null;
        return <EvidenceEdgeLine key={i} from={from} to={to} edge={edge} />;
      })}

      {/* Nodes */}
      {evidence.nodes.map((node, i) => (
        <EvidenceNodeMesh
          key={node.object_id}
          node={node}
          position={positions[i]}
          isSelected={selectedNodeId === node.object_id}
          isHovered={hoveredId === node.object_id}
          onSelect={() => onSelectNode(node)}
          onHover={() => setHoveredId(node.object_id)}
          onUnhover={() => setHoveredId(null)}
        />
      ))}

      <OrbitControls
        enablePan
        enableZoom
        enableRotate
        minDistance={3}
        maxDistance={20}
        autoRotate={!selectedNodeId && !hoveredId}
        autoRotateSpeed={0.3}
      />
    </>
  );
}

/* ── Exported component ── */

export default function SceneRenderer({
  evidence,
  onSelectNode,
  selectedNodeId,
}: {
  evidence: EvidencePath;
  onSelectNode: (node: EvidenceNode) => void;
  selectedNodeId: number | null;
}) {
  if (!evidence || evidence.nodes.length === 0) {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: "'Courier Prime', monospace",
          fontSize: 12,
          color: '#5c5851',
        }}
      >
        No evidence path to visualize
      </div>
    );
  }

  return (
    <Canvas
      camera={{ position: [0, 2, 8], fov: 50 }}
      style={{ background: '#0f1012' }}
      gl={{ antialias: true }}
    >
      <SceneContent
        evidence={evidence}
        onSelectNode={onSelectNode}
        selectedNodeId={selectedNodeId}
      />
    </Canvas>
  );
}
