'use client';

/**
 * ContextShelf: Graph nodes anchoring a data visualization.
 *
 * Renders inside the R3F Canvas (3D). Positions context nodes along the
 * left edge at x = -12, evenly spaced vertically. Draws dashed connection
 * lines toward the data visualization area (right side).
 *
 * Max 6 nodes (top 6 by gradual_strength). Fully interactive.
 */

import { useMemo, useRef, useState, useCallback } from 'react';
import { Line } from '@react-three/drei';
import type { SceneSpec } from '@/lib/theseus-viz/SceneSpec';
import R3FNode from './R3FNode';

const MAX_SHELF_NODES = 6;
const SHELF_X = -12;
const CONNECTION_TARGET_X = 2;

interface ContextShelfProps {
  sceneSpec: SceneSpec;
  onSelectNode?: (nodeId: string) => void;
}

export default function ContextShelf({ sceneSpec, onSelectNode }: ContextShelfProps) {
  const visibleLabelCountRef = useRef(0);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const contextNodes = useMemo(() => {
    const shelfIds = new Set(
      sceneSpec.data_layer?.context_shelf_nodes || [],
    );

    let candidates = sceneSpec.nodes.filter(
      (n) => n.is_context_shelf || shelfIds.has(n.id),
    );

    candidates.sort((a, b) => b.gradual_strength - a.gradual_strength);
    candidates = candidates.slice(0, MAX_SHELF_NODES);

    const count = candidates.length;
    if (count === 0) return [];

    const totalHeight = (count - 1) * 3;
    const startY = totalHeight / 2;

    return candidates.map((node, i) => ({
      ...node,
      position: [SHELF_X, startY - i * 3, 0] as [number, number, number],
    }));
  }, [sceneSpec.nodes, sceneSpec.data_layer]);

  const handleSelect = useCallback(
    (id: string) => onSelectNode?.(id),
    [onSelectNode],
  );

  const handleHover = useCallback((id: string | null) => {
    setHoveredId(id);
  }, []);

  if (contextNodes.length === 0) return null;

  return (
    <>
      {contextNodes.map((node) => (
        <R3FNode
          key={`shelf-${node.id}`}
          node={node}
          isSelected={false}
          isHovered={hoveredId === node.id}
          onSelect={handleSelect}
          onHover={handleHover}
          visibleLabelCountRef={visibleLabelCountRef}
        />
      ))}

      {contextNodes.map((node) => (
        <Line
          key={`shelf-line-${node.id}`}
          points={[
            node.position,
            [CONNECTION_TARGET_X, node.position[1], 0],
          ]}
          color="#4A8A96"
          lineWidth={1}
          dashed
          dashSize={0.4}
          gapSize={0.3}
          opacity={0.3}
          transparent
        />
      ))}
    </>
  );
}
