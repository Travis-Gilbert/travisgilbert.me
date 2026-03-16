'use client';

import { useCallback, useMemo, useState } from 'react';
import { getObjectTypeIdentity } from '@/lib/commonplace';
import { type RenderableObject } from './objects/ObjectRenderer';

interface ClusterGraphWindowProps {
  members: RenderableObject[];
  edges: Array<{ from: number; to: number }>;
  color: string;
  height?: number;
}

/**
 * SVG graph window for ClusterCard. Renders a deterministic circular layout
 * of cluster members with edges between them. No force simulation; positions
 * are computed from member index for SSG stability.
 */
export default function ClusterGraphWindow({
  members,
  edges,
  color,
  height: heightOverride,
}: ClusterGraphWindowProps) {
  const height = heightOverride ?? Math.max(80, members.length * 22);
  const [zoom, setZoom] = useState(1.1);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setZoom((prev) => {
      const next = prev + (e.deltaY < 0 ? 0.15 : -0.15);
      return Math.max(0.5, Math.min(next, 3));
    });
  }, []);

  const layout = useMemo(() => {
    const memberSet = new Set(members.map((m) => m.id));

    // Build edge count per member for node sizing
    const edgeCounts = new Map<number, number>();
    for (const edge of edges) {
      if (memberSet.has(edge.from)) edgeCounts.set(edge.from, (edgeCounts.get(edge.from) ?? 0) + 1);
      if (memberSet.has(edge.to)) edgeCounts.set(edge.to, (edgeCounts.get(edge.to) ?? 0) + 1);
    }

    // Tight circular layout: nodes close together, short edges
    const cx = 1.25;
    const cy = 0.5;
    const radiusFactor = members.length <= 2 ? 0.14 : members.length <= 4 ? 0.2 : 0.25;

    const nodes = members.map((member, i) => {
      const angle = (2 * Math.PI * i) / Math.max(members.length, 1) - Math.PI / 2;
      // Deterministic jitter from member ID
      const jitterX = ((member.id * 7 + 13) % 20 - 10) * 0.003;
      const jitterY = ((member.id * 11 + 7) % 20 - 10) * 0.003;
      const nx = cx + Math.cos(angle) * radiusFactor + jitterX;
      const ny = cy + Math.sin(angle) * radiusFactor + jitterY;

      const ec = edgeCounts.get(member.id) ?? 0;
      const radius = 9 + Math.min(ec / 4, 1) * 7;
      const identity = getObjectTypeIdentity(member.object_type_slug);

      return {
        id: member.id,
        x: nx,
        y: ny,
        radius,
        nodeColor: identity.color,
        label: (member.display_title ?? member.title).slice(0, 14),
        hasGlow: ec >= 3,
      };
    });

    const nodeMap = new Map(nodes.map((n) => [n.id, n]));

    let lines = edges
      .filter((e) => nodeMap.has(e.from) && nodeMap.has(e.to))
      .map((e) => ({
        x1: nodeMap.get(e.from)!.x,
        y1: nodeMap.get(e.from)!.y,
        x2: nodeMap.get(e.to)!.x,
        y2: nodeMap.get(e.to)!.y,
      }));

    // When no real edges exist, generate deterministic structural lines
    // so the graph always shows connectivity (matching reference design)
    if (lines.length === 0 && nodes.length >= 2) {
      const structuralLines: typeof lines = [];
      for (let i = 0; i < nodes.length; i++) {
        // Connect each node to the next (ring)
        const j = (i + 1) % nodes.length;
        structuralLines.push({
          x1: nodes[i].x, y1: nodes[i].y,
          x2: nodes[j].x, y2: nodes[j].y,
        });
        // Cross-connect for density (skip one)
        if (nodes.length >= 4) {
          const k = (i + 2) % nodes.length;
          structuralLines.push({
            x1: nodes[i].x, y1: nodes[i].y,
            x2: nodes[k].x, y2: nodes[k].y,
          });
        }
      }
      lines = structuralLines;
    }

    return { nodes, lines };
  }, [members, edges]);

  // Background dot pattern using cluster color
  const bgStyle: React.CSSProperties = {
    position: 'relative',
    width: '100%',
    height,
    backgroundImage: [
      `radial-gradient(circle, ${color}12 0.6px, transparent 0.6px)`,
      `radial-gradient(circle, rgba(26,26,29,0.04) 0.4px, transparent 0.4px)`,
    ].join(', '),
    backgroundSize: '12px 12px, 8px 8px',
    backgroundPosition: '0 0, 4px 4px',
    maskImage: 'radial-gradient(ellipse at center, transparent 0%, black 50%)',
    WebkitMaskImage: 'radial-gradient(ellipse at center, transparent 0%, black 50%)',
  };

  // Zoom adjusts the viewBox: smaller viewBox = zoomed in, centered on graph center
  const vbW = 2.5 / zoom;
  const vbH = 1 / zoom;
  const vbX = 1.25 - vbW / 2;
  const vbY = 0.5 - vbH / 2;

  return (
    <div style={bgStyle} onWheel={handleWheel}>
      <svg
        width="100%"
        height="100%"
        viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ position: 'absolute', inset: 0, cursor: zoom > 1 ? 'zoom-out' : 'zoom-in' }}
      >
        {/* Edges */}
        {layout.lines.map((line, i) => (
          <line
            key={i}
            x1={line.x1}
            y1={line.y1}
            x2={line.x2}
            y2={line.y2}
            stroke={color}
            strokeOpacity={0.25}
            strokeWidth={0.008}
          />
        ))}

        {/* Nodes */}
        {layout.nodes.map((node) => {
          // Convert pixel radius to viewBox units (wider viewBox = scale up)
          const r = node.radius / 100;
          return (
            <g key={node.id}>
              {/* Glow for high-connectivity nodes */}
              {node.hasGlow && (
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={r * 2.2}
                  fill={node.nodeColor}
                  opacity={0.08}
                />
              )}
              <circle
                cx={node.x}
                cy={node.y}
                r={r}
                fill={node.nodeColor}
              />
              {/* Label */}
              <text
                x={node.x}
                y={node.y + r + 0.035}
                textAnchor="middle"
                fill="var(--cp-text-muted)"
                fontSize={0.06}
                fontFamily="var(--cp-font-mono)"
                fontWeight={600}
                style={{ pointerEvents: 'none' }}
              >
                {node.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
