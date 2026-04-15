'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getClusters, getObject } from '@/lib/theseus-api';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';

interface GraphNode {
  id: string;
  label: string;
  type: 'cluster' | 'object';
  objectType?: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  /** ms-offset from the ink-in start when this node begins materializing */
  appearAt: number;
}

interface GraphEdge {
  source: string;
  target: string;
  /** ms-offset from ink-in start when this edge begins drawing */
  appearAt: number;
}

// Per-node ink-in duration: radius grows from 0 to target, opacity 0 to 1.
const NODE_INK_MS = 260;
// Stagger between consecutive nodes in the ink-in sequence.
const NODE_STAGGER_MS = 38;
// Per-edge draw duration: stroke-dashoffset unwinds to 0.
const EDGE_DRAW_MS = 420;
// Extra delay after both endpoints of an edge have appeared before the edge draws.
const EDGE_AFTER_NODE_MS = 140;

function typeColor(objectType: string): string {
  switch (objectType) {
    case 'source': return '#2D5F6B';
    case 'concept': return '#7B5EA7';
    case 'person': return '#C4503C';
    case 'hunch': return '#C49A4A';
    default: return '#9a958d';
  }
}

/** Simple force simulation tick (no d3-force dependency) */
function tickForce(nodes: GraphNode[], edges: GraphEdge[], width: number, height: number) {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  // Center gravity
  for (const node of nodes) {
    node.vx += (width / 2 - node.x) * 0.001;
    node.vy += (height / 2 - node.y) * 0.001;
  }

  // Repulsion between all nodes
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i];
      const b = nodes[j];
      let dx = b.x - a.x;
      let dy = b.y - a.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const minDist = a.radius + b.radius + 30;
      if (dist < minDist) {
        const force = (minDist - dist) / dist * 0.05;
        dx *= force;
        dy *= force;
        a.vx -= dx;
        a.vy -= dy;
        b.vx += dx;
        b.vy += dy;
      }
    }
  }

  // Edge attraction
  for (const edge of edges) {
    const source = nodeMap.get(edge.source);
    const target = nodeMap.get(edge.target);
    if (!source || !target) continue;
    const dx = target.x - source.x;
    const dy = target.y - source.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const idealDist = 80;
    const force = (dist - idealDist) / dist * 0.01;
    source.vx += dx * force;
    source.vy += dy * force;
    target.vx -= dx * force;
    target.vy -= dy * force;
  }

  // Apply velocity with damping
  for (const node of nodes) {
    node.vx *= 0.85;
    node.vy *= 0.85;
    node.x += node.vx;
    node.y += node.vy;
    // Bounds
    node.x = Math.max(node.radius + 20, Math.min(width - node.radius - 20, node.x));
    node.y = Math.max(node.radius + 20, Math.min(height - node.radius - 20, node.y));
  }
}

/** Ease-out cubic */
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

interface IdleGraphProps {
  onSelectNode: (nodeId: string) => void;
  selectedNodeId?: string | null;
}

/**
 * IdleGraph: pre-query interactive cluster graph for the Explorer.
 *
 * Fetches clusters from the API, builds a force-directed layout
 * from cluster hubs and their top objects, renders as an interactive
 * SVG. Clicking a node opens the context panel.
 *
 * Selection features:
 *   - selectedNodeId prop highlights the selected node + neighbors
 *   - Camera pans smoothly (400ms ease-out) to center the selected node
 *   - Previously selected nodes retain a faint teal ring (visit trail)
 */
export default function IdleGraph({ onSelectNode, selectedNodeId }: IdleGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const nodesRef = useRef<GraphNode[]>([]);
  const edgesRef = useRef<GraphEdge[]>([]);
  const animRef = useRef<number>(0);
  const inkStartRef = useRef<number>(0);
  const inkAnimRef = useRef<number>(0);
  const [ready, setReady] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [, forceRender] = useState(0);
  // Ink frame: ms since ink-in began. Drives per-node radius/opacity tween.
  // Set to Infinity once every node and edge has finished; keeps render cheap
  // without repeatedly scheduling RAFs after the ink is done.
  const [inkFrame, setInkFrame] = useState(0);
  const prefersReducedMotion = usePrefersReducedMotion();

  // Camera viewBox offset for panning
  const viewBoxRef = useRef({ x: 0, y: 0 });
  const panAnimRef = useRef<number>(0);

  // Track visited nodes for trail rendering
  const [visitedIds, setVisitedIds] = useState<Set<string>>(new Set());

  // Build graph from cluster data
  useEffect(() => {
    let cancelled = false;

    async function loadGraph() {
      const result = await getClusters();
      if (cancelled || !result.ok) return;

      const clusters = result.clusters.slice(0, 12);
      const nodes: GraphNode[] = [];
      const edges: GraphEdge[] = [];
      const objectIds = new Set<string>();

      const svg = svgRef.current;
      const width = svg?.clientWidth ?? 800;
      const height = svg?.clientHeight ?? 600;

      // Ink-in order: clusters appear first (they anchor the composition),
      // then their children. appearAt is assigned after the list is built so
      // it reflects the final ordering.
      for (const cluster of clusters) {
        nodes.push({
          id: `cluster-${cluster.id}`,
          label: cluster.label.length > 20 ? cluster.label.slice(0, 18) + '\u2026' : cluster.label,
          type: 'cluster',
          x: width / 2 + (Math.random() - 0.5) * width * 0.6,
          y: height / 2 + (Math.random() - 0.5) * height * 0.6,
          vx: 0,
          vy: 0,
          radius: Math.min(8 + Math.sqrt(cluster.member_count) * 0.8, 20),
          appearAt: 0,
        });

        for (const objId of cluster.top_objects.slice(0, 3)) {
          if (!objectIds.has(objId)) {
            objectIds.add(objId);
            nodes.push({
              id: objId,
              label: '',
              type: 'object',
              x: width / 2 + (Math.random() - 0.5) * width * 0.6,
              y: height / 2 + (Math.random() - 0.5) * height * 0.6,
              vx: 0,
              vy: 0,
              radius: 5,
              appearAt: 0,
            });
          }
          edges.push({ source: `cluster-${cluster.id}`, target: objId, appearAt: 0 });
        }
      }

      // Clusters first, then objects. Stagger each by NODE_STAGGER_MS.
      const orderedForInk = [...nodes].sort((a, b) => {
        if (a.type === b.type) return 0;
        return a.type === 'cluster' ? -1 : 1;
      });
      orderedForInk.forEach((n, i) => {
        n.appearAt = i * NODE_STAGGER_MS;
      });

      // Edges appear after both endpoints have started materializing.
      const nodeAppearById = new Map(nodes.map((n) => [n.id, n.appearAt] as const));
      for (const edge of edges) {
        const a = nodeAppearById.get(edge.source) ?? 0;
        const b = nodeAppearById.get(edge.target) ?? 0;
        edge.appearAt = Math.max(a, b) + EDGE_AFTER_NODE_MS;
      }

      const objNodes = nodes.filter((n) => n.type === 'object');
      const fetches = objNodes.slice(0, 30).map(async (node) => {
        const obj = await getObject(node.id);
        if (obj.ok) {
          node.label = obj.title.length > 16 ? obj.title.slice(0, 14) + '\u2026' : obj.title;
          node.objectType = obj.object_type;
        }
      });
      await Promise.allSettled(fetches);

      if (cancelled) return;

      nodesRef.current = nodes;
      edgesRef.current = edges;
      setReady(true);
    }

    loadGraph();
    return () => { cancelled = true; };
  }, []);

  // Run force simulation
  useEffect(() => {
    if (!ready) return;

    let ticks = 0;
    function animate() {
      const svg = svgRef.current;
      if (!svg) return;

      tickForce(nodesRef.current, edgesRef.current, svg.clientWidth, svg.clientHeight);
      ticks++;

      if (ticks % 2 === 0) forceRender((n) => n + 1);
      if (ticks < 200) {
        animRef.current = requestAnimationFrame(animate);
      }
    }

    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  }, [ready]);

  // Ink-in animation: tick a frame timer until every node + edge has finished
  // appearing, then settle. On reduced motion, skip straight to the settled
  // frame so the graph is visible immediately.
  useEffect(() => {
    if (!ready) return;

    if (prefersReducedMotion) {
      // Jump to the end: every node and edge is fully materialized.
      setInkFrame(Number.POSITIVE_INFINITY);
      return;
    }

    inkStartRef.current = performance.now();

    const lastNodeAppear = nodesRef.current.reduce(
      (m, n) => Math.max(m, n.appearAt),
      0,
    );
    const lastEdgeAppear = edgesRef.current.reduce(
      (m, e) => Math.max(m, e.appearAt),
      0,
    );
    const totalDuration =
      Math.max(lastNodeAppear + NODE_INK_MS, lastEdgeAppear + EDGE_DRAW_MS) + 80;

    function tick() {
      const elapsed = performance.now() - inkStartRef.current;
      setInkFrame(elapsed);
      if (elapsed < totalDuration) {
        inkAnimRef.current = requestAnimationFrame(tick);
      } else {
        setInkFrame(Number.POSITIVE_INFINITY);
      }
    }

    inkAnimRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(inkAnimRef.current);
  }, [ready, prefersReducedMotion]);

  /**
   * nodeVisibility: 0 = not yet materializing, 1 = fully inked.
   * Returns an easeOutCubic curve over the NODE_INK_MS window starting at
   * the node's appearAt offset.
   */
  function nodeVisibility(n: GraphNode): number {
    if (inkFrame === Number.POSITIVE_INFINITY) return 1;
    const local = inkFrame - n.appearAt;
    if (local <= 0) return 0;
    if (local >= NODE_INK_MS) return 1;
    return easeOutCubic(local / NODE_INK_MS);
  }

  /**
   * edgeVisibility: 0 = invisible, 1 = fully drawn. Used as both opacity
   * and as the fraction of the stroke to reveal via dashoffset.
   */
  function edgeVisibility(e: GraphEdge): number {
    if (inkFrame === Number.POSITIVE_INFINITY) return 1;
    const local = inkFrame - e.appearAt;
    if (local <= 0) return 0;
    if (local >= EDGE_DRAW_MS) return 1;
    return easeOutCubic(local / EDGE_DRAW_MS);
  }

  // Camera pan animation when selectedNodeId changes
  useEffect(() => {
    if (!selectedNodeId || !ready) return;

    // Add to visited trail
    setVisitedIds((prev) => new Set([...prev, selectedNodeId]));

    const node = nodesRef.current.find((n) => n.id === selectedNodeId);
    if (!node) return;

    const svg = svgRef.current;
    if (!svg) return;

    const width = svg.clientWidth;
    const height = svg.clientHeight;

    // Target: center the node in the viewport
    const targetX = node.x - width / 2;
    const targetY = node.y - height / 2;
    const startX = viewBoxRef.current.x;
    const startY = viewBoxRef.current.y;
    const dx = targetX - startX;
    const dy = targetY - startY;

    if (Math.abs(dx) < 5 && Math.abs(dy) < 5) return; // already centered

    const duration = 400;
    const startTime = performance.now();

    cancelAnimationFrame(panAnimRef.current);

    function panStep(now: number) {
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / duration);
      const eased = easeOutCubic(t);

      viewBoxRef.current.x = startX + dx * eased;
      viewBoxRef.current.y = startY + dy * eased;
      forceRender((n) => n + 1);

      if (t < 1) {
        panAnimRef.current = requestAnimationFrame(panStep);
      }
    }

    panAnimRef.current = requestAnimationFrame(panStep);
    return () => cancelAnimationFrame(panAnimRef.current);
  }, [selectedNodeId, ready]);

  const handleClick = useCallback((nodeId: string) => {
    if (nodeId.startsWith('cluster-')) {
      const edges = edgesRef.current.filter((e) => e.source === nodeId);
      if (edges.length > 0) {
        onSelectNode(edges[0].target);
        return;
      }
    }
    onSelectNode(nodeId);
  }, [onSelectNode]);

  const nodes = nodesRef.current;
  const edges = edgesRef.current;
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  // Build neighbor set for selection dimming
  const selectedNeighborIds = new Set<string>();
  if (selectedNodeId) {
    selectedNeighborIds.add(selectedNodeId);
    for (const edge of edges) {
      if (edge.source === selectedNodeId) selectedNeighborIds.add(edge.target);
      if (edge.target === selectedNodeId) selectedNeighborIds.add(edge.source);
    }
  }

  const svg = svgRef.current;
  const vw = svg?.clientWidth ?? 800;
  const vh = svg?.clientHeight ?? 600;
  const vx = viewBoxRef.current.x;
  const vy = viewBoxRef.current.y;

  return (
    <svg
      ref={svgRef}
      className="explorer-idle-graph"
      data-interactive
      viewBox={`${vx} ${vy} ${vw} ${vh}`}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        zIndex: 5,
        pointerEvents: ready ? 'auto' : 'none',
        // Wrapper fade lifts the whole canvas in quickly; the per-node
        // ink-in does the actual "writing itself" work so we don't want a
        // long wrapper crossfade competing with it.
        opacity: ready ? 1 : 0,
        transition: 'opacity 160ms ease',
      }}
    >
      {/* Edges: ink-in via stroke-dashoffset then normal selection styling. */}
      {edges.map((edge, i) => {
        const source = nodeMap.get(edge.source);
        const target = nodeMap.get(edge.target);
        if (!source || !target) return null;
        const isHovered = hoveredId === edge.source || hoveredId === edge.target;
        const isSelected = selectedNodeId !== null
          && (edge.source === selectedNodeId || edge.target === selectedNodeId);
        const dimmedBySelection = selectedNodeId !== null && !isSelected;

        const inkT = edgeVisibility(edge);
        const lineLength = Math.hypot(target.x - source.x, target.y - source.y);
        // Stroke-dashoffset reveal: when inkT is 0, the dash is pushed fully
        // off the line (invisible); when 1, it sits in place (fully drawn).
        const dashOffset = lineLength * (1 - inkT);

        return (
          <line
            key={i}
            x1={source.x}
            y1={source.y}
            x2={target.x}
            y2={target.y}
            stroke={
              isSelected
                ? 'rgba(74, 138, 150, 0.4)'
                : isHovered
                  ? 'rgba(74, 138, 150, 0.3)'
                  : 'rgba(255, 255, 255, 0.06)'
            }
            strokeWidth={isSelected ? 1.5 : isHovered ? 1.5 : 0.5}
            opacity={(dimmedBySelection ? 0.15 : 1) * inkT}
            strokeDasharray={lineLength > 0 ? lineLength : undefined}
            strokeDashoffset={lineLength > 0 ? dashOffset : undefined}
            style={{ transition: 'stroke 200ms ease, stroke-width 200ms ease' }}
          />
        );
      })}

      {/* Nodes: ink-in scales each circle from 0 to target radius, then
          selection dimming + hover styling take over. Interaction is
          disabled until a node is at least 60% materialized so early clicks
          on invisible dots can't land. */}
      {nodes.map((node) => {
        const isHovered = hoveredId === node.id;
        const isCluster = node.type === 'cluster';
        const isSelected = selectedNodeId === node.id;
        const isNeighbor = selectedNodeId !== null && selectedNeighborIds.has(node.id);
        const isVisited = visitedIds.has(node.id) && !isSelected;
        const color = isCluster ? '#4A8A96' : typeColor(node.objectType ?? 'note');

        const inkT = nodeVisibility(node);
        const inkInteractive = inkT >= 0.6;

        // Selection dimming logic
        let nodeOpacity = 1;
        if (selectedNodeId !== null) {
          if (isSelected) {
            nodeOpacity = 1;
          } else if (isNeighbor) {
            nodeOpacity = 0.8;
          } else {
            nodeOpacity = 0.15;
          }
        } else if (hoveredId !== null) {
          const connectedToHover = edges.some(
            (e) =>
              (e.source === hoveredId && e.target === node.id)
              || (e.target === hoveredId && e.source === node.id)
              || e.source === node.id && hoveredId === e.target
              || e.target === node.id && hoveredId === e.source,
          );
          if (!isHovered && !connectedToHover) {
            nodeOpacity = 0.2;
          }
        }

        return (
          <g
            key={node.id}
            style={{
              cursor: inkInteractive ? 'pointer' : 'default',
              opacity: nodeOpacity * inkT,
              transition: 'opacity 200ms ease',
              pointerEvents: inkInteractive ? 'auto' : 'none',
            }}
            onClick={() => handleClick(node.id)}
            onMouseEnter={() => setHoveredId(node.id)}
            onMouseLeave={() => setHoveredId(null)}
          >
            {/* Visited trail ring */}
            {isVisited && (
              <circle
                cx={node.x}
                cy={node.y}
                r={(node.radius + 4) * inkT}
                fill="none"
                stroke="rgba(74, 138, 150, 0.2)"
                strokeWidth={1}
              />
            )}

            {/* Selection glow */}
            {isSelected && (
              <circle
                cx={node.x}
                cy={node.y}
                r={(node.radius + 6) * inkT}
                fill="none"
                stroke="rgba(74, 138, 150, 0.3)"
                strokeWidth={2}
              />
            )}

            <circle
              cx={node.x}
              cy={node.y}
              r={(isHovered || isSelected ? node.radius + 2 : node.radius) * inkT}
              fill={isCluster ? 'rgba(74, 138, 150, 0.15)' : `${color}22`}
              stroke={isSelected ? '#4A8A96' : color}
              strokeWidth={isSelected ? 2 : isHovered ? 1.5 : 0.8}
              style={{ transition: 'r 150ms ease, stroke-width 150ms ease' }}
            />
            {/* Label */}
            {(isCluster || isHovered || isSelected) && node.label && (
              <text
                x={node.x}
                y={node.y + node.radius + 12}
                textAnchor="middle"
                fill={isSelected ? '#e8e5e0' : isHovered ? '#e8e5e0' : '#9a958d'}
                fontSize={isCluster ? 10 : 9}
                fontFamily="'Courier Prime', monospace"
                style={{ pointerEvents: 'none', userSelect: 'none' }}
              >
                {node.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
