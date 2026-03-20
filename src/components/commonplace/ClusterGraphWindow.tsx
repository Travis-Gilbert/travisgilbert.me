'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { getObjectTypeIdentity } from '@/lib/commonplace';
import { type RenderableObject } from './objects/ObjectRenderer';

// ─── Types ──────────────────────────────────────────────────────

interface ClusterGraphWindowProps {
  members: RenderableObject[];
  edges: Array<{ from: number; to: number }>;
  color: string;
  height?: number;
  width?: number;
  hoveredId?: number | null;
  onHoverNode?: (id: number, e: React.MouseEvent) => void;
  onClickNode?: (id: number) => void;
  onLeaveNode?: () => void;
}

interface SimNode {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface SimLink {
  source: SimNode;
  target: SimNode;
}

// ─── BFS Spanning Tree ──────────────────────────────────────────
// Converts flat edges into a tree rooted at the highest-degree node.
// Orphan nodes (zero edges) are connected directly to root.

function buildTree(
  members: RenderableObject[],
  edges: Array<{ from: number; to: number }>,
) {
  const adj = new Map<number, number[]>();
  const degreeMap = new Map<number, number>();
  // Track which nodes have children in the BFS tree (= "parent" in Observable terms)
  const childrenSet = new Set<number>();

  for (const m of members) {
    adj.set(m.id, []);
    degreeMap.set(m.id, 0);
  }
  for (const e of edges) {
    if (adj.has(e.from) && adj.has(e.to)) {
      adj.get(e.from)!.push(e.to);
      adj.get(e.to)!.push(e.from);
      degreeMap.set(e.from, (degreeMap.get(e.from) ?? 0) + 1);
      degreeMap.set(e.to, (degreeMap.get(e.to) ?? 0) + 1);
    }
  }

  // Root = highest-degree node
  let rootId = members[0]?.id ?? 0;
  let maxDeg = -1;
  for (const [id, deg] of degreeMap) {
    if (deg > maxDeg) {
      maxDeg = deg;
      rootId = id;
    }
  }

  // BFS spanning tree
  const visited = new Set([rootId]);
  const treeLinks: Array<{ source: number; target: number }> = [];
  const queue = [rootId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const neighbor of adj.get(current) ?? []) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        treeLinks.push({ source: current, target: neighbor });
        childrenSet.add(current); // current has at least one child
        queue.push(neighbor);
      }
    }
  }

  // Connect orphans to root
  for (const m of members) {
    if (!visited.has(m.id)) {
      treeLinks.push({ source: rootId, target: m.id });
      childrenSet.add(rootId);
      visited.add(m.id);
    }
  }

  return { treeLinks, rootId, degreeMap, childrenSet };
}

// ─── Force Simulation ───────────────────────────────────────────
//
// Follows the Observable @d3/force-directed-tree pattern:
//   forceLink(links).distance(0).strength(1)
//   forceManyBody().strength(-50)
//   forceX()
//   forceY()
//
// Adapted: rest distance is viewport-scaled so small clusters (2-4 nodes)
// produce visible spread. Canonical distance=0 only works at scale (50+ nodes).

function createSimulation(
  members: RenderableObject[],
  treeLinks: Array<{ source: number; target: number }>,
  width: number,
  height: number,
) {
  // Scatter nodes in a ring from center (jitter prevents degenerate collinear start)
  const nodes: SimNode[] = members.map((m, i) => {
    const angle = (i / members.length) * Math.PI * 2;
    const r = Math.min(width, height) * 0.15;
    return {
      id: m.id,
      x: Math.cos(angle) * r + (Math.random() - 0.5) * 10,
      y: Math.sin(angle) * r + (Math.random() - 0.5) * 10,
      vx: 0,
      vy: 0,
    };
  });

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const links: SimLink[] = treeLinks
    .map((l) => ({ source: nodeMap.get(l.source)!, target: nodeMap.get(l.target)! }))
    .filter((l) => l.source && l.target);

  // Canonical alpha cooling
  let alpha = 1;
  const alphaDecay = 0.0228;
  const alphaMin = 0.001;
  const velocityDecay = 0.4;

  // Rest distance scaled to viewport; charge tuned to balance
  const restDist = Math.min(width, height) * 0.2;
  const charge = -80;

  function tick(): boolean {
    alpha += (alphaMin - alpha) * alphaDecay;
    if (alpha < alphaMin) return false;

    // forceLink: spring toward restDist
    for (const link of links) {
      const dx = link.target.x - link.source.x;
      const dy = link.target.y - link.source.y;
      let d = Math.sqrt(dx * dx + dy * dy);
      if (d < 1) d = 1;
      const err = (d - restDist) / d;
      const f = err * alpha * 0.5;
      link.source.vx += dx * f;
      link.source.vy += dy * f;
      link.target.vx -= dx * f;
      link.target.vy -= dy * f;
    }

    // forceManyBody: charge * alpha / d (canonical 1/d, not 1/d²)
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        let dx = nodes[j].x - nodes[i].x;
        let dy = nodes[j].y - nodes[i].y;
        let d = Math.sqrt(dx * dx + dy * dy);
        if (d < 1) d = 1;
        const w = charge * alpha / d;
        const ux = dx / d;
        const uy = dy / d;
        nodes[i].vx += ux * w;
        nodes[i].vy += uy * w;
        nodes[j].vx -= ux * w;
        nodes[j].vy -= uy * w;
      }
    }

    // forceX + forceY: gentle centering (strength 0.1)
    for (const node of nodes) {
      node.vx -= node.x * 0.1 * alpha;
      node.vy -= node.y * 0.1 * alpha;
    }

    // Velocity Verlet integration + decay
    for (const node of nodes) {
      node.vx *= velocityDecay;
      node.vy *= velocityDecay;
      node.x += node.vx;
      node.y += node.vy;
    }

    return true;
  }

  return { nodes, links, tick };
}

// ─── Component ──────────────────────────────────────────────────

/**
 * Force-directed tree graph for ClusterCard.
 *
 * Visual language follows Observable @d3/force-directed-tree:
 *   - Straight <line> edges (organic curves come from the force layout)
 *   - Uniform node radius (3.5px)
 *   - Parent nodes: hollow (stroke only). Leaf nodes: filled.
 *   - Hover labels on demand
 */
export default function ClusterGraphWindow({
  members,
  edges,
  color,
  height: heightOverride,
  width: widthOverride,
  hoveredId,
  onHoverNode,
  onClickNode,
  onLeaveNode,
}: ClusterGraphWindowProps) {
  const width = widthOverride ?? 340;
  const height = heightOverride ?? 220;
  const [positions, setPositions] = useState<Array<{ id: number; x: number; y: number }>>([]);
  const frameRef = useRef<number | null>(null);
  const tickRef = useRef(0);

  const memberMap = useMemo(
    () => new Map(members.map((m) => [m.id, m])),
    [members],
  );

  const { treeLinks, childrenSet } = useMemo(
    () => buildTree(members, edges),
    [members, edges],
  );

  // Neighborhood set for hover highlighting
  const connectedToHovered = useMemo(() => {
    if (hoveredId == null) return null;
    const set = new Set([hoveredId]);
    for (const l of treeLinks) {
      if (l.source === hoveredId) set.add(l.target);
      if (l.target === hoveredId) set.add(l.source);
    }
    return set;
  }, [hoveredId, treeLinks]);

  // Animate force simulation
  useEffect(() => {
    if (members.length === 0) return;
    tickRef.current = 0;
    const sim = createSimulation(members, treeLinks, width, height);
    let running = true;

    function animate() {
      if (!running) return;
      const alive = sim.tick();
      tickRef.current++;
      setPositions(sim.nodes.map((n) => ({ id: n.id, x: n.x, y: n.y })));
      if (alive && tickRef.current < 300) {
        frameRef.current = requestAnimationFrame(animate);
      }
    }

    frameRef.current = requestAnimationFrame(animate);
    return () => {
      running = false;
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [members, treeLinks, width, height]);

  const posMap = useMemo(
    () => new Map(positions.map((p) => [p.id, p])),
    [positions],
  );

  if (positions.length === 0) {
    return <div style={{ width, height }} />;
  }

  // Centered viewBox: origin at (0,0) matching forceX/forceY target
  return (
    <svg
      width={width}
      height={height}
      viewBox={`${-width / 2} ${-height / 2} ${width} ${height}`}
      style={{ maxWidth: '100%', height: 'auto', display: 'block' }}
      onMouseLeave={onLeaveNode}
    >
      {/* Links: straight lines (canonical pattern, organic shape from forces) */}
      <g stroke={color} strokeOpacity={0.6}>
        {treeLinks.map((link, i) => {
          const sp = posMap.get(link.source);
          const tp = posMap.get(link.target);
          if (!sp || !tp) return null;

          const isHighlighted =
            hoveredId != null &&
            connectedToHovered?.has(link.source) &&
            connectedToHovered?.has(link.target);
          const isDimmed = hoveredId != null && !isHighlighted;

          return (
            <line
              key={i}
              x1={sp.x}
              y1={sp.y}
              x2={tp.x}
              y2={tp.y}
              strokeOpacity={isDimmed ? 0.08 : isHighlighted ? 0.8 : 0.6}
              strokeWidth={isHighlighted ? 1.5 : 0.8}
              style={{ transition: 'stroke-opacity 120ms' }}
            />
          );
        })}
      </g>

      {/* Nodes: canonical fill pattern adapted for dark theme */}
      <g>
        {positions.map((pos) => {
          const member = memberMap.get(pos.id);
          if (!member) return null;

          const identity = getObjectTypeIdentity(member.object_type_slug);
          const nodeColor = identity.color;
          const hasChildren = childrenSet.has(pos.id);

          // Canonical: parent = hollow (d.children ? null : fill)
          // Dark-theme adaptation: parent = stroke-only, leaf = filled
          const r = 3.5;
          const isHovered = hoveredId === pos.id;
          const isConnected = connectedToHovered?.has(pos.id) ?? false;
          const isDimmed = hoveredId != null && !isConnected;

          const label = member.display_title ?? member.title;
          const truncated = label.length > 22 ? label.slice(0, 20) + '\u2026' : label;

          return (
            <g
              key={pos.id}
              style={{ cursor: 'pointer' }}
              onMouseEnter={(e) => onHoverNode?.(pos.id, e)}
              onClick={(e) => {
                e.stopPropagation();
                onClickNode?.(pos.id);
              }}
            >
              {/* Hover glow */}
              {isHovered && (
                <circle cx={pos.x} cy={pos.y} r={12} fill={nodeColor} opacity={0.12} />
              )}

              {/* Node: parent=hollow, leaf=filled (canonical pattern) */}
              <circle
                cx={pos.x}
                cy={pos.y}
                r={isHovered ? r * 1.4 : r}
                fill={hasChildren ? 'none' : nodeColor}
                stroke={hasChildren ? nodeColor : 'none'}
                strokeWidth={hasChildren ? 1.5 : 0}
                opacity={isDimmed ? 0.15 : 1}
                style={{ transition: 'opacity 120ms' }}
              />

              {/* Hover label */}
              {isHovered && (
                <text
                  x={pos.x}
                  y={pos.y - 10}
                  textAnchor="middle"
                  fill="var(--cp-text, #e8e4df)"
                  fontSize={8}
                  fontFamily="var(--cp-font-mono, monospace)"
                  fontWeight={600}
                  style={{ pointerEvents: 'none' }}
                >
                  {truncated}
                </text>
              )}
            </g>
          );
        })}
      </g>
    </svg>
  );
}
