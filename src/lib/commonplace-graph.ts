/**
 * Graph data preparation for CommonPlace network views.
 *
 * Converts mock objects + edges into D3-compatible { nodes, links }
 * format. Provides force simulation configuration, frame
 * serialization, and type-based clustering helpers.
 *
 * Mirrors the ConnectionMap.tsx pattern: synchronous layout via
 * d3.forceSimulation with 300 iterations for instant rendering.
 */

import * as d3 from 'd3';
import type { MockNode, MockEdge, GraphNode, GraphLink, ViewFrame } from '@/lib/commonplace';
import { getObjectTypeIdentity, OBJECT_TYPES } from '@/lib/commonplace';

/* ─────────────────────────────────────────────────
   Convert mock data to D3 graph format
   ───────────────────────────────────────────────── */

export function buildGraphData(
  nodes: MockNode[],
  edges: MockEdge[],
): { nodes: GraphNode[]; links: GraphLink[] } {
  const graphNodes: GraphNode[] = nodes.map((n) => ({
    id: n.id,
    objectType: n.objectType,
    title: n.title,
    edgeCount: n.edgeCount,
  }));

  const nodeIds = new Set(nodes.map((n) => n.id));
  const graphLinks: GraphLink[] = edges
    .filter((e) => nodeIds.has(e.sourceId) && nodeIds.has(e.targetId))
    .map((e) => ({
      source: e.sourceId,
      target: e.targetId,
      reason: e.reason,
    }));

  return { nodes: graphNodes, links: graphLinks };
}

/* ─────────────────────────────────────────────────
   Layout node type (post-simulation, with positions)
   ───────────────────────────────────────────────── */

export interface LayoutNode {
  x: number;
  y: number;
  radius: number;
  node: GraphNode;
}

/* ─────────────────────────────────────────────────
   Synchronous force simulation
   (same pattern as ConnectionMap: 300 iterations)
   ───────────────────────────────────────────────── */

interface SimNode extends d3.SimulationNodeDatum {
  id: string;
  radius: number;
  graphNode: GraphNode;
}

export function computeGraphLayout(
  graphNodes: GraphNode[],
  graphLinks: GraphLink[],
  width: number,
  height: number,
  options?: {
    /** Charge strength (default: -120) */
    charge?: number;
    /** Link distance (default: 80) */
    linkDistance?: number;
    /** Whether to apply type-based clustering (default: false) */
    cluster?: boolean;
  },
): LayoutNode[] {
  if (graphNodes.length === 0) return [];

  const charge = options?.charge ?? -120;
  const linkDistance = options?.linkDistance ?? 80;
  const maxEdge = Math.max(1, ...graphNodes.map((n) => n.edgeCount));

  const simNodes: SimNode[] = graphNodes.map((n) => ({
    id: n.id,
    radius: 6 + (n.edgeCount / maxEdge) * 12,
    graphNode: n,
  }));

  const simLinks: d3.SimulationLinkDatum<SimNode>[] = graphLinks.map((l) => ({
    source: typeof l.source === 'string' ? l.source : l.source.id,
    target: typeof l.target === 'string' ? l.target : l.target.id,
  }));

  const simulation = d3
    .forceSimulation<SimNode>(simNodes)
    .force(
      'link',
      d3
        .forceLink<SimNode, d3.SimulationLinkDatum<SimNode>>(simLinks)
        .id((d) => d.id)
        .distance(linkDistance),
    )
    .force('charge', d3.forceManyBody().strength(charge))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force(
      'collision',
      d3.forceCollide<SimNode>().radius((d) => d.radius + 4),
    )
    .stop();

  /* Optional type-based clustering via forceX/forceY */
  if (options?.cluster) {
    const typeIndex = new Map(OBJECT_TYPES.map((t, i) => [t.slug, i]));
    const typeCount = OBJECT_TYPES.length;

    simulation.force(
      'clusterX',
      d3
        .forceX<SimNode>((d) => {
          const idx = typeIndex.get(d.graphNode.objectType) ?? 0;
          const angle = (idx / typeCount) * Math.PI * 2;
          return width / 2 + Math.cos(angle) * width * 0.2;
        })
        .strength(0.08),
    );

    simulation.force(
      'clusterY',
      d3
        .forceY<SimNode>((d) => {
          const idx = typeIndex.get(d.graphNode.objectType) ?? 0;
          const angle = (idx / typeCount) * Math.PI * 2;
          return height / 2 + Math.sin(angle) * height * 0.2;
        })
        .strength(0.08),
    );
  }

  /* Run synchronously */
  for (let i = 0; i < 300; i++) simulation.tick();

  return simNodes.map((n) => ({
    x: Math.max(n.radius + 10, Math.min(width - n.radius - 10, n.x ?? width / 2)),
    y: Math.max(n.radius + 10, Math.min(height - n.radius - 10, n.y ?? height / 2)),
    radius: n.radius,
    node: n.graphNode,
  }));
}

/* ─────────────────────────────────────────────────
   Node color helper (delegates to OBJECT_TYPES)
   ───────────────────────────────────────────────── */

export function getNodeColor(objectType: string): string {
  return getObjectTypeIdentity(objectType).color;
}

/* ─────────────────────────────────────────────────
   Edge color (warm gray matching parchment aesthetic)
   ───────────────────────────────────────────────── */

export const EDGE_RGB = '140, 130, 120';

/* ─────────────────────────────────────────────────
   Frame management (localStorage persistence)
   ───────────────────────────────────────────────── */

const FRAME_STORAGE_KEY = 'commonplace-frames';

export function loadFrames(): ViewFrame[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(FRAME_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveFrames(frames: ViewFrame[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(FRAME_STORAGE_KEY, JSON.stringify(frames));
}

export function createFrame(
  name: string,
  zoom: number,
  centerX: number,
  centerY: number,
  highlightedNodeIds: string[] = [],
): ViewFrame {
  return {
    id: `frame-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    zoom,
    centerX,
    centerY,
    highlightedNodeIds,
    createdAt: new Date().toISOString(),
  };
}

/* ─────────────────────────────────────────────────
   Title truncation for graph labels
   ───────────────────────────────────────────────── */

export function truncateLabel(str: string, maxLen = 18): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 1) + '\u2026';
}
