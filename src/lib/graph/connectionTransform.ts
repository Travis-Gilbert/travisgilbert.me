/**
 * Transform research API connection responses into D3 node/edge format.
 *
 * Scoped to ConnectionMap and ConnectionGraphPopup only.
 * Other graphs (SourceGraph, KnowledgeMap, etc.) keep their own transforms.
 *
 * Handles two API shapes:
 *   1. Full graph:  GET /api/v1/connections/graph/
 *   2. Per-content:  GET /api/v1/connections/<slug>/
 */

import { getDominantSignalColor } from './colors';

// ── API response types ──────────────────────────────────────────────

export interface APINode {
  id: string;
  type: string;
  slug: string;
  label: string;
}

export interface APIEdge {
  source: string;
  target: string;
  weight: number;
  explanation: string;
  signals: Record<string, { score: number; detail: string } | null>;
}

export interface APIGraphResponse {
  nodes: APINode[];
  edges: APIEdge[];
}

export interface APIConnectionResponse {
  slug: string;
  contentType: string;
  connections: Array<{
    content_type: string;
    content_slug: string;
    content_title: string;
    score: number;
    signals: Record<string, { score: number; detail: string } | null>;
    explanation: string;
  }>;
}

// ── D3 output types ─────────────────────────────────────────────────

export type ContentType = 'essay' | 'field-note' | 'project' | 'shelf';

export interface GraphNode {
  id: string;
  slug: string;
  title: string;
  type: ContentType;
  connectionCount: number;
  href: string;
  /** Connection strength (popup only: score from the center node) */
  score?: number;
  /** Human-readable connection reason */
  explanation?: string;
  /** Which signals fired for this connection */
  activeSignals: string[];
  /** Sum of all connection weights (for score-based sizing) */
  totalScore: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  type: string;
  strokeWidth: number;
  weight: number;
  explanation: string;
  signalCount: number;
  signals: Record<string, { score: number; detail: string } | null>;
  color: string;
  roughness: number;
  bowing: number;
}

// ── Helpers ─────────────────────────────────────────────────────────

/** Map API content_type (underscored) to site content type (hyphenated) */
function normalizeContentType(apiType: string): ContentType {
  const map: Record<string, ContentType> = {
    essay: 'essay',
    field_note: 'field-note',
    project: 'project',
    shelf: 'shelf',
  };
  return map[apiType] ?? 'essay';
}

/** Build href from content type and slug */
function buildHref(type: ContentType, slug: string): string {
  switch (type) {
    case 'essay':
      return `/essays/${slug}`;
    case 'field-note':
      return `/field-notes/${slug}`;
    case 'project':
      return '/projects';
    case 'shelf':
      return '/shelf';
    default:
      return '/';
  }
}

/** Map connection weight (0 to 1) to stroke width (0.5 to 3.0) */
function weightToStrokeWidth(weight: number): number {
  return 0.5 + weight * 2.5;
}

/** Map connection weight to rough.js roughness */
function weightToRoughness(weight: number): number {
  if (weight > 0.7) return 0.8;
  if (weight >= 0.4) return 1.5;
  return 2.5;
}

/** Map connection weight to rough.js bowing */
function weightToBowing(weight: number): number {
  if (weight > 0.7) return 0.5;
  if (weight >= 0.4) return 1.5;
  return 3.0;
}

/** Count non-null signals */
function countSignals(
  signals: Record<string, { score: number; detail: string } | null>,
): number {
  return Object.values(signals).filter(Boolean).length;
}

/** Get names of non-null signals */
function getActiveSignals(
  signals: Record<string, { score: number; detail: string } | null>,
): string[] {
  return Object.entries(signals)
    .filter(([, v]) => v !== null)
    .map(([k]) => k);
}

// ── Transform: full graph ───────────────────────────────────────────

/**
 * Transform the /api/v1/connections/graph/ response for ConnectionMap.
 */
export function transformGraphResponse(data: APIGraphResponse): {
  nodes: GraphNode[];
  edges: GraphEdge[];
} {
  // Build edge list and count connections per node
  const connectionCounts = new Map<string, number>();
  const totalScores = new Map<string, number>();

  for (const edge of data.edges) {
    connectionCounts.set(edge.source, (connectionCounts.get(edge.source) ?? 0) + 1);
    connectionCounts.set(edge.target, (connectionCounts.get(edge.target) ?? 0) + 1);
    totalScores.set(edge.source, (totalScores.get(edge.source) ?? 0) + edge.weight);
    totalScores.set(edge.target, (totalScores.get(edge.target) ?? 0) + edge.weight);
  }

  const nodes: GraphNode[] = data.nodes.map((n) => {
    const type = normalizeContentType(n.type);
    return {
      id: n.id,
      slug: n.slug,
      title: n.label,
      type,
      connectionCount: connectionCounts.get(n.id) ?? 0,
      href: buildHref(type, n.slug),
      activeSignals: [],
      totalScore: totalScores.get(n.id) ?? 0,
    };
  });

  const edges: GraphEdge[] = data.edges.map((e) => ({
    source: e.source,
    target: e.target,
    type: 'connection',
    strokeWidth: weightToStrokeWidth(e.weight),
    weight: e.weight,
    explanation: e.explanation,
    signalCount: countSignals(e.signals),
    signals: e.signals,
    color: getDominantSignalColor(e.signals),
    roughness: weightToRoughness(e.weight),
    bowing: weightToBowing(e.weight),
  }));

  return { nodes, edges };
}

// ── Transform: per-content (popup) ──────────────────────────────────

/**
 * Transform the /api/v1/connections/<slug>/ response for ConnectionGraphPopup.
 * Returns the center node plus orbiting connection nodes.
 */
export function transformConnectionResponse(
  data: APIConnectionResponse,
  centerTitle: string,
): {
  nodes: GraphNode[];
  edges: GraphEdge[];
} {
  const centerType = normalizeContentType(data.contentType);
  const centerId = `${data.contentType}:${data.slug}`;

  const centerNode: GraphNode = {
    id: centerId,
    slug: data.slug,
    title: centerTitle,
    type: centerType,
    connectionCount: data.connections.length,
    href: buildHref(centerType, data.slug),
    activeSignals: [],
    totalScore: data.connections.reduce((sum, c) => sum + c.score, 0),
  };

  const connectionNodes: GraphNode[] = data.connections.map((c) => {
    const type = normalizeContentType(c.content_type);
    return {
      id: `${c.content_type}:${c.content_slug}`,
      slug: c.content_slug,
      title: c.content_title,
      type,
      connectionCount: 1,
      href: buildHref(type, c.content_slug),
      score: c.score,
      explanation: c.explanation,
      activeSignals: getActiveSignals(c.signals),
      totalScore: c.score,
    };
  });

  const edges: GraphEdge[] = data.connections.map((c) => ({
    source: centerId,
    target: `${c.content_type}:${c.content_slug}`,
    type: 'connection',
    strokeWidth: weightToStrokeWidth(c.score),
    weight: c.score,
    explanation: c.explanation,
    signalCount: countSignals(c.signals),
    signals: c.signals,
    color: getDominantSignalColor(c.signals),
    roughness: weightToRoughness(c.score),
    bowing: weightToBowing(c.score),
  }));

  return {
    nodes: [centerNode, ...connectionNodes],
    edges,
  };
}
