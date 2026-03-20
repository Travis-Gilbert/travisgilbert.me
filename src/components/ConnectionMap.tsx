'use client';

/**
 * ConnectionMap: D3 force-directed graph showing content relationships.
 *
 * Two-layer rendering:
 *   Canvas (behind): rough.js hand-drawn edges with signal-based encoding
 *   SVG (front): colored nodes, labels, hover interactions
 *
 * Visual encoding (from research API):
 *   Edge thickness: 0.5 to 3.0 (weight-scaled via connectionTransform)
 *   Edge roughness: varies by connection strength (strong=smooth, weak=sketchy)
 *   Edge color: dominant signal color at 40% opacity (70% on hover)
 *   Node radius: scales by connection count or total score
 *
 * Signal filter: toggle to show only edges matching a specific signal.
 *   Non-matching edges fade to 4% opacity. Disconnected nodes shrink.
 *
 * Cluster overlay: optional convex hulls from /api/v1/clusters/ drawn
 *   as rough.js cross-hatch polygons behind edges.
 *
 * Force simulation runs synchronously via shared simulation.ts presets.
 */

import { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import * as d3 from 'd3';
import rough from 'roughjs';
import { useRouter } from 'next/navigation';
import { NODE_COLORS, SIGNAL_COLORS } from '@/lib/graph/colors';
import { scaleByCount, scaleByScore } from '@/lib/graph/radius';
import {
  runSynchronousSimulation,
  PRESET_SPREAD,
  type SimulationNode,
} from '@/lib/graph/simulation';
import type { GraphNode, GraphEdge } from '@/lib/graph/connectionTransform';
import GraphTooltip, { buildSignalIndicators } from '@/components/GraphTooltip';
import SignalFilter, { type SignalKey } from '@/components/SignalFilter';

// ─────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────

interface ConnectionMapProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  /** Size nodes by connection count or total score (default: 'count') */
  sizeMode?: 'count' | 'score';
}

/** Extended simulation node carrying the original GraphNode data */
interface MapNode extends SimulationNode {
  nodeData: GraphNode;
}

/** Cluster from the research API /api/v1/clusters/ */
interface Cluster {
  id: number;
  label: string;
  top_tags: string[];
  members: Array<{
    content_type: string;
    content_slug: string;
    content_title: string;
  }>;
  size: number;
}

// ─────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  essay: 'ESSAYS',
  'field-note': 'FIELD NOTES',
  project: 'PROJECTS',
  shelf: 'SHELF',
};

/** Soft palette for cluster hulls (low opacity fills, no harsh borders) */
const CLUSTER_HULL_COLORS = [
  '#B45A2D',
  '#2D5F6B',
  '#C49A4A',
  '#5A7A4A',
  '#6B5A7A',
  '#A44A3A',
  '#5A6A7A',
  '#8A7A5A',
];

// Browser: relative URL (rewrite proxy handles it)
const RESEARCH_URL = '';

// ─────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────

function truncateTitle(str: string, maxLen = 20): string {
  if (str.length <= maxLen) return str.toUpperCase();
  return str.slice(0, maxLen - 1).toUpperCase() + '\u2026';
}

/** Convert hex color to rgba string */
function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Does an edge have a non-null value for the given signal? */
function edgeHasSignal(edge: GraphEdge, signal: SignalKey): boolean {
  return edge.signals[signal] !== null && edge.signals[signal] !== undefined;
}

/**
 * Normalize content_type from API (underscored) to match our GraphNode.id
 * format: "essay:slug" or "field-note:slug".
 */
function clusterMemberKey(member: { content_type: string; content_slug: string }): string {
  const type = member.content_type.replace('_', '-');
  return `${type}:${member.content_slug}`;
}

// ─────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────

export default function ConnectionMap({
  nodes,
  edges,
  sizeMode = 'count',
}: ConnectionMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [width, setWidth] = useState(800);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [signalFilter, setSignalFilter] = useState<SignalKey | null>(null);
  const [showClusters, setShowClusters] = useState(false);
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const router = useRouter();

  const height = Math.max(500, Math.round(width * 0.6));

  // Compute which signals are present in the dataset
  const availableSignals = useMemo(() => {
    const signals = new Set<string>();
    for (const e of edges) {
      for (const [key, val] of Object.entries(e.signals)) {
        if (val) signals.add(key);
      }
    }
    return signals;
  }, [edges]);

  // Compute node radii and run force simulation
  const layout = useMemo(() => {
    if (nodes.length === 0) return [];

    const maxCount = Math.max(1, ...nodes.map((n) => n.connectionCount));
    const maxScore = Math.max(1, ...nodes.map((n) => n.totalScore));

    const simNodes: MapNode[] = nodes.map((n) => ({
      id: n.id,
      radius:
        sizeMode === 'score'
          ? scaleByScore(n.totalScore, maxScore)
          : scaleByCount(n.connectionCount, maxCount),
      connectionCount: n.connectionCount,
      nodeData: n,
    }));

    // Build sim edges referencing node IDs
    const simEdges = edges.map((e) => ({
      source: e.source,
      target: e.target,
      weight: e.weight,
    }));

    runSynchronousSimulation(simNodes, simEdges, width, height, PRESET_SPREAD);

    return simNodes;
  }, [nodes, edges, width, height, sizeMode]);

  // Track container width
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const ro = new ResizeObserver((entries) => {
      const w = Math.round(entries[0].contentRect.width);
      if (w > 0) setWidth(w);
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  // Fetch clusters on demand
  const fetchClusters = useCallback(async () => {
    if (clusters.length > 0) return; // already fetched
    try {
      const res = await fetch(`${RESEARCH_URL}/api/v1/clusters/`);
      if (!res.ok) return;
      const data = await res.json();
      setClusters(data.clusters ?? []);
    } catch {
      // Silently ignore cluster fetch failures
    }
  }, [clusters.length]);

  // Determine which edges pass the signal filter
  const filteredEdgeSet = useMemo(() => {
    if (!signalFilter) return null; // null = all edges pass
    const passing = new Set<string>();
    for (const e of edges) {
      if (edgeHasSignal(e, signalFilter)) {
        passing.add(`${e.source}->${e.target}`);
      }
    }
    return passing;
  }, [edges, signalFilter]);

  // Nodes that are connected to at least one visible edge under the filter
  const connectedUnderFilter = useMemo(() => {
    if (!signalFilter) return null; // null = all nodes connected
    const connected = new Set<string>();
    for (const e of edges) {
      if (edgeHasSignal(e, signalFilter)) {
        connected.add(e.source);
        connected.add(e.target);
      }
    }
    return connected;
  }, [edges, signalFilter]);

  // Compute cluster hulls mapped to simulation positions
  const clusterHulls = useMemo(() => {
    if (!showClusters || clusters.length === 0 || layout.length === 0) return [];

    const posMap = new Map(
      layout.map((n) => [n.id, { x: n.x ?? 0, y: n.y ?? 0 }]),
    );

    return clusters.map((cluster, i) => {
      const points: [number, number][] = [];

      for (const member of cluster.members) {
        const key = clusterMemberKey(member);
        const pos = posMap.get(key);
        if (pos) {
          points.push([pos.x, pos.y]);
        }
      }

      // d3.polygonHull requires >= 3 non-collinear points
      const hull = points.length >= 3 ? d3.polygonHull(points) : null;

      return {
        id: cluster.id,
        label: cluster.label,
        color: CLUSTER_HULL_COLORS[i % CLUSTER_HULL_COLORS.length],
        hull,
        points,
      };
    });
  }, [showClusters, clusters, layout]);

  // Draw rough.js edges (and cluster hulls) on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || layout.length === 0) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    const rc = rough.canvas(canvas);
    const posMap = new Map(
      layout.map((n) => [n.id, { x: n.x ?? 0, y: n.y ?? 0 }]),
    );

    // Draw cluster hulls first (behind everything)
    for (const ch of clusterHulls) {
      if (!ch.hull) continue;

      // Pad the hull outward by ~20px for visual breathing room
      const centroid = d3.polygonCentroid(ch.hull);
      const padded = ch.hull.map(([px, py]) => {
        const dx = px - centroid[0];
        const dy = py - centroid[1];
        const dist = Math.sqrt(dx * dx + dy * dy);
        const scale = dist > 0 ? (dist + 24) / dist : 1;
        return [centroid[0] + dx * scale, centroid[1] + dy * scale] as [number, number];
      });

      rc.polygon(padded, {
        roughness: 1.8,
        stroke: hexToRgba(ch.color, 0.15),
        strokeWidth: 1,
        fill: hexToRgba(ch.color, 0.04),
        fillStyle: 'cross-hatch',
        fillWeight: 0.3,
        hachureAngle: 45 + ch.id * 30,
        hachureGap: 8,
        bowing: 2,
      });
    }

    // Connected IDs for hover highlighting
    const connectedIds = new Set<string>();
    if (hoveredId) {
      connectedIds.add(hoveredId);
      edges.forEach((e) => {
        if (e.source === hoveredId) connectedIds.add(e.target);
        if (e.target === hoveredId) connectedIds.add(e.source);
      });
    }

    // Draw edges
    edges.forEach((e) => {
      const from = posMap.get(e.source);
      const to = posMap.get(e.target);
      if (!from || !to) return;

      const edgeKey = `${e.source}->${e.target}`;
      const passesFilter = !filteredEdgeSet || filteredEdgeSet.has(edgeKey);

      let alpha: number;
      if (!passesFilter) {
        // Edge does not match the active signal filter
        alpha = 0.04;
      } else if (hoveredId) {
        const isConnected =
          connectedIds.has(e.source) && connectedIds.has(e.target);
        alpha = isConnected ? 0.7 : 0.04;
      } else {
        alpha = 0.4;
      }

      rc.line(from.x, from.y, to.x, to.y, {
        roughness: e.roughness,
        stroke: hexToRgba(e.color, alpha),
        strokeWidth: e.strokeWidth,
        bowing: e.bowing,
      });
    });
  }, [layout, edges, hoveredId, width, height, filteredEdgeSet, clusterHulls]);

  // Connected IDs for node dimming (computed in render for SVG)
  const connectedIds = new Set<string>();
  if (hoveredId) {
    connectedIds.add(hoveredId);
    edges.forEach((e) => {
      if (e.source === hoveredId) connectedIds.add(e.target);
      if (e.target === hoveredId) connectedIds.add(e.source);
    });
  }

  const presentTypes = [...new Set(nodes.map((n) => n.type))];

  // Build tooltip data for hovered node
  const hoveredNode = hoveredId
    ? layout.find((n) => n.id === hoveredId)?.nodeData
    : null;

  const tooltipSignals = hoveredNode
    ? buildSignalIndicators(
        // Aggregate signals from all edges connected to this node
        edges
          .filter(
            (e) => e.source === hoveredId || e.target === hoveredId,
          )
          .reduce(
            (acc, e) => {
              for (const [key, val] of Object.entries(e.signals)) {
                if (val && !acc[key]) acc[key] = val;
              }
              return acc;
            },
            {} as Record<string, { score: number; detail: string } | null>,
          ),
      )
    : [];

  return (
    <div
      ref={containerRef}
      style={{ position: 'relative', minHeight: 500, width: '100%' }}
    >
      {/* Controls bar: signal filter + cluster toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
        <SignalFilter
          activeSignal={signalFilter}
          onSignalChange={setSignalFilter}
          availableSignals={availableSignals}
        />

        <button
          onClick={() => {
            const next = !showClusters;
            setShowClusters(next);
            if (next) fetchClusters();
          }}
          style={{
            padding: '3px 10px',
            borderRadius: 4,
            border: `1px solid ${showClusters ? 'var(--color-ink-secondary)' : 'transparent'}`,
            background: showClusters ? 'var(--color-surface-elevated, #F5F0E8)' : 'transparent',
            color: showClusters ? 'var(--color-ink)' : 'var(--color-ink-light)',
            fontFamily: 'var(--font-metadata)',
            fontSize: 10,
            letterSpacing: '0.06em',
            textTransform: 'uppercase' as const,
            cursor: 'pointer',
            transition: 'all 150ms ease',
            minHeight: 28,
          }}
        >
          Clusters
        </button>
      </div>

      {/* rough.js edge canvas (behind nodes) */}
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          pointerEvents: 'none',
        }}
      />

      {/* Node SVG (interactive layer) */}
      <svg
        width={width}
        height={height}
        style={{ position: 'relative', zIndex: 1, pointerEvents: 'none' }}
        role="img"
        aria-label="Content connection map showing relationships between essays, field notes, projects, and shelf items"
      >
        {layout.map((simNode) => {
          const { nodeData: node } = simNode;
          const x = simNode.x ?? 0;
          const y = simNode.y ?? 0;
          const baseRadius = simNode.radius;

          // Node disconnected under signal filter: shrink to half
          const disconnected = connectedUnderFilter !== null && !connectedUnderFilter.has(node.id);
          const radius = disconnected ? baseRadius * 0.5 : baseRadius;

          // Dimming: hover or filter disconnection
          const hoverDimmed = hoveredId !== null && !connectedIds.has(node.id);
          const dimmed = hoverDimmed || disconnected;

          return (
            <g
              key={node.id}
              style={{
                cursor: 'pointer',
                pointerEvents: 'all',
                transition: 'opacity 200ms ease, transform 300ms ease',
              }}
              opacity={dimmed ? 0.12 : 1}
              onMouseEnter={(e) => {
                setHoveredId(node.id);
                const rect = containerRef.current?.getBoundingClientRect();
                if (rect) {
                  setTooltipPos({
                    x: e.clientX - rect.left,
                    y: y - radius - 12,
                  });
                }
              }}
              onMouseLeave={() => setHoveredId(null)}
              onClick={() => router.push(node.href)}
              role="link"
              tabIndex={0}
              aria-label={`${node.title} (${TYPE_LABELS[node.type]})`}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  router.push(node.href);
                }
              }}
            >
              <circle
                cx={x}
                cy={y}
                r={radius}
                fill={NODE_COLORS[node.type]}
                fillOpacity={0.7}
                stroke={NODE_COLORS[node.type]}
                strokeWidth={1.5}
                style={{ transition: 'r 300ms ease' }}
              />
              <text
                x={x}
                y={y + radius + 14}
                textAnchor="middle"
                fill="var(--color-ink-secondary)"
                style={{
                  fontFamily: 'var(--font-metadata)',
                  fontSize: disconnected ? 7 : 9,
                  letterSpacing: '0.06em',
                  transition: 'font-size 300ms ease',
                }}
              >
                {truncateTitle(node.title)}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Tooltip */}
      <GraphTooltip
        title={hoveredNode?.title ?? ''}
        subtitle={hoveredNode ? TYPE_LABELS[hoveredNode.type] : undefined}
        lines={
          hoveredNode
            ? [
                `${hoveredNode.connectionCount} connection${hoveredNode.connectionCount !== 1 ? 's' : ''}`,
                ...(hoveredNode.explanation ? [hoveredNode.explanation] : []),
              ]
            : undefined
        }
        signals={tooltipSignals}
        position={tooltipPos}
        visible={hoveredNode !== null}
      />

      {/* Cluster labels (positioned at hull centroid) */}
      {showClusters && clusterHulls.map((ch) => {
        if (!ch.hull) return null;
        const centroid = d3.polygonCentroid(ch.hull);
        return (
          <div
            key={`cluster-label-${ch.id}`}
            style={{
              position: 'absolute',
              left: centroid[0],
              top: centroid[1] - 10,
              transform: 'translateX(-50%)',
              fontFamily: 'var(--font-metadata)',
              fontSize: 8,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: hexToRgba(ch.color, 0.5),
              pointerEvents: 'none',
              zIndex: 0,
              whiteSpace: 'nowrap',
            }}
          >
            {ch.label}
          </div>
        );
      })}

      {/* Legend (bottom-right) */}
      <div
        style={{
          position: 'absolute',
          bottom: 16,
          right: 16,
          zIndex: 2,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}
      >
        {presentTypes.map((type) => (
          <div
            key={type}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontFamily: 'var(--font-metadata)',
              fontSize: 9,
              letterSpacing: '0.06em',
              color: 'var(--color-ink-secondary)',
            }}
          >
            <span
              style={{
                display: 'inline-block',
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: NODE_COLORS[type],
                opacity: 0.7,
              }}
            />
            {TYPE_LABELS[type]}
          </div>
        ))}
      </div>
    </div>
  );
}
