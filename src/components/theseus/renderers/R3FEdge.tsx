'use client';

/**
 * R3FEdge: Edge line between two nodes in the R3F scene.
 *
 * Draw animation ramps from 0% to 100% over 400ms using a ref
 * to avoid per-frame React re-renders.
 */

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import type { SceneEdge, SceneNode } from '@/lib/theseus-viz/SceneSpec';

const DRAW_DURATION_MS = 400;

/* Pre-allocated mutable points array (two 3-tuples) */
const _points: [number, number, number][] = [[0, 0, 0], [0, 0, 0]];

interface R3FEdgeProps {
  edge: SceneEdge;
  fromNode: SceneNode;
  toNode: SceneNode;
}

export default function R3FEdge({ edge, fromNode, toNode }: R3FEdgeProps) {
  const lineRef = useRef<{ setPoints: (points: [number, number, number][]) => void } | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const doneRef = useRef(false);

  useFrame(({ clock }) => {
    if (doneRef.current) return;
    if (startTimeRef.current === null) {
      startTimeRef.current = clock.elapsedTime;
    }
    const elapsed = (clock.elapsedTime - startTimeRef.current) * 1000;
    const t = Math.min(elapsed / DRAW_DURATION_MS, 1);
    if (t >= 1) doneRef.current = true;

    const from = fromNode.position;
    const to = toNode.position;
    _points[0][0] = from[0];
    _points[0][1] = from[1];
    _points[0][2] = from[2];
    _points[1][0] = from[0] + (to[0] - from[0]) * t;
    _points[1][1] = from[1] + (to[1] - from[1]) * t;
    _points[1][2] = from[2] + (to[2] - from[2]) * t;

    // drei Line exposes geometry; update positions directly
    const line = lineRef.current as unknown as { geometry?: { setFromPoints?: (pts: { x: number; y: number; z: number }[]) => void; attributes?: { position?: { array: Float32Array; needsUpdate: boolean } } } };
    if (line?.geometry?.attributes?.position) {
      const arr = line.geometry.attributes.position.array;
      arr[0] = _points[0][0]; arr[1] = _points[0][1]; arr[2] = _points[0][2];
      arr[3] = _points[1][0]; arr[4] = _points[1][1]; arr[5] = _points[1][2];
      line.geometry.attributes.position.needsUpdate = true;
    }
  });

  const opacity = edge.strength * 0.8;

  return (
    <Line
      ref={lineRef as React.Ref<never>}
      points={[fromNode.position, fromNode.position]}
      color={edge.color}
      lineWidth={edge.width}
      dashed={edge.dashed}
      dashSize={0.3}
      gapSize={0.2}
      opacity={opacity}
      transparent
    />
  );
}
