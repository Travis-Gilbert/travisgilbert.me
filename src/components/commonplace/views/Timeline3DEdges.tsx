'use client';

/**
 * Timeline3DEdges: Connection arc rendering for the 3D timeline.
 *
 * CatmullRomCurve3 tubes for emphasized connections, Line for
 * background connections. Arcs bow upward (+Y) proportional to
 * the Z distance between source and target.
 */

import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import * as THREE from 'three';
import type { TimelineEdge3D } from '@/lib/timeline-3d-layout';

/* ─────────────────────────────────────────────────
   Constants
   ───────────────────────────────────────────────── */

const EDGE_COLOR = '#8C827A';
const EDGE_HIGHLIGHT_COLOR = '#C4503C';
const BG_OPACITY = 0.08;
const HIGHLIGHT_OPACITY = 0.4;
/** Max distance (squared) from camera to render edges */
const CULL_DIST_SQ = 60 * 60;
/** Number of points per curve */
const CURVE_SEGMENTS = 24;

/* ─────────────────────────────────────────────────
   Arc point computation
   ───────────────────────────────────────────────── */

function computeArcPoints(
  src: [number, number, number],
  tgt: [number, number, number],
): THREE.Vector3[] {
  const midX = (src[0] + tgt[0]) / 2;
  const midY = Math.max(src[1], tgt[1]);
  const midZ = (src[2] + tgt[2]) / 2;

  // Arc height proportional to Z distance
  const zDist = Math.abs(tgt[2] - src[2]);
  const arcHeight = Math.min(Math.max(zDist * 0.3, 0.5), 4.0);

  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(src[0], src[1], src[2]),
    new THREE.Vector3(midX, midY + arcHeight, midZ),
    new THREE.Vector3(tgt[0], tgt[1], tgt[2]),
  ]);

  return curve.getPoints(CURVE_SEGMENTS);
}

/* ─────────────────────────────────────────────────
   Props
   ───────────────────────────────────────────────── */

interface Timeline3DEdgesProps {
  edges: TimelineEdge3D[];
  hoveredId: string | null;
  selectedId: string | null;
  /** Set of node IDs connected to the hovered/selected node */
  connectedIds: Set<string>;
}

/* ─────────────────────────────────────────────────
   Single edge line component
   ───────────────────────────────────────────────── */

function EdgeLine({
  edge,
  isHighlighted,
}: {
  edge: TimelineEdge3D;
  isHighlighted: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const { camera } = useThree();

  const points = useMemo(
    () => computeArcPoints(edge.sourcePos, edge.targetPos),
    [edge.sourcePos, edge.targetPos],
  );

  // Distance-based culling
  useFrame(() => {
    if (!groupRef.current) return;
    const midZ = (edge.sourcePos[2] + edge.targetPos[2]) / 2;
    const dz = camera.position.z - midZ;
    const distSq = dz * dz;
    groupRef.current.visible = distSq < CULL_DIST_SQ;
  });

  const color = isHighlighted ? EDGE_HIGHLIGHT_COLOR : EDGE_COLOR;
  const opacity = isHighlighted ? HIGHLIGHT_OPACITY : BG_OPACITY;
  const lineWidth = isHighlighted ? 2 : 0.5;

  return (
    <group ref={groupRef}>
      <Line
        points={points}
        color={color}
        lineWidth={lineWidth}
        transparent
        opacity={opacity}
      />
    </group>
  );
}

/* ─────────────────────────────────────────────────
   Main component
   ───────────────────────────────────────────────── */

export default function Timeline3DEdges({
  edges,
  hoveredId,
  selectedId,
  connectedIds,
}: Timeline3DEdgesProps) {
  const activeId = selectedId ?? hoveredId;

  return (
    <group>
      {edges.map((edge) => {
        const isHighlighted = activeId
          ? connectedIds.has(edge.sourceId) && connectedIds.has(edge.targetId)
          : false;

        return (
          <EdgeLine
            key={edge.id}
            edge={edge}
            isHighlighted={isHighlighted}
          />
        );
      })}
    </group>
  );
}
