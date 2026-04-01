'use client';

/**
 * R3FRenderer: Renders SceneSpec nodes and edges inside the existing R3F Canvas.
 *
 * Maps SceneSpec.nodes to <R3FNode> and SceneSpec.edges to <R3FEdge>.
 * Applies construction_sequence as staggered appearance animations.
 * Renders INSIDE a Canvas (not its own Canvas).
 */

import { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { SceneSpec, SceneNode, ConstructionStep } from '@/lib/theseus-viz/SceneSpec';
import R3FNode from './R3FNode';
import R3FEdge from './R3FEdge';

interface R3FRendererProps {
  sceneSpec: SceneSpec;
  onSelectNode?: (nodeId: string) => void;
}

function useConstructionAnimation(steps: ConstructionStep[]): Set<string> {
  const showAll = steps.length === 0;
  const [visibleIds, setVisibleIds] = useState<Set<string>>(
    () => showAll ? new Set(['__all__']) : new Set(),
  );

  useEffect(() => {
    if (showAll) return;

    const timers = steps.map((step) =>
      setTimeout(() => {
        setVisibleIds((prev) => {
          const next = new Set(prev);
          for (const id of step.target_ids) next.add(id);
          return next;
        });
      }, step.delay_ms),
    );

    return () => timers.forEach(clearTimeout);
  }, [steps, showAll]);

  return visibleIds;
}

/** Resets the shared label counter at the start of each frame (priority -1) */
function LabelCountResetter({ countRef }: { countRef: React.MutableRefObject<number> }) {
  useFrame(() => { countRef.current = 0; }, -1);
  return null;
}

export default function R3FRenderer({ sceneSpec, onSelectNode }: R3FRendererProps) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const visibleLabelCountRef = useRef(0);

  const visibleIds = useConstructionAnimation(sceneSpec.construction_sequence);
  const showAll = visibleIds.has('__all__');

  const nodeMap = useMemo(() => {
    const m = new Map<string, SceneNode>();
    for (const node of sceneSpec.nodes) {
      m.set(node.id, node);
    }
    return m;
  }, [sceneSpec.nodes]);

  const handleSelect = useCallback(
    (id: string) => {
      setSelectedNodeId(id);
      onSelectNode?.(id);
    },
    [onSelectNode],
  );

  const handleHover = useCallback((id: string | null) => {
    setHoveredNodeId(id);
  }, []);

  const visibleNodes = showAll
    ? sceneSpec.nodes
    : sceneSpec.nodes.filter((n) => visibleIds.has(n.id));

  const visibleEdges = showAll
    ? sceneSpec.edges
    : sceneSpec.edges.filter((e) => visibleIds.has(e.from) && visibleIds.has(e.to));

  return (
    <>
      <ambientLight intensity={0.3} />
      <pointLight position={[10, 10, 10]} intensity={0.5} />
      <pointLight position={[-10, -5, -10]} intensity={0.2} color="#4A8A96" />

      <LabelCountResetter countRef={visibleLabelCountRef} />

      {visibleEdges.map((edge, i) => {
        const fromNode = nodeMap.get(edge.from);
        const toNode = nodeMap.get(edge.to);
        if (!fromNode || !toNode) return null;
        return (
          <R3FEdge
            key={`edge-${edge.from}-${edge.to}-${i}`}
            edge={edge}
            fromNode={fromNode}
            toNode={toNode}
          />
        );
      })}

      {visibleNodes.map((node) => (
        <R3FNode
          key={node.id}
          node={node}
          isSelected={selectedNodeId === node.id}
          isHovered={hoveredNodeId === node.id}
          onSelect={handleSelect}
          onHover={handleHover}
          visibleLabelCountRef={visibleLabelCountRef}
        />
      ))}

      <OrbitControls
        enablePan
        enableZoom
        enableRotate
        minDistance={3}
        maxDistance={25}
        autoRotate={!selectedNodeId && !hoveredNodeId}
        autoRotateSpeed={0.3}
      />
    </>
  );
}
