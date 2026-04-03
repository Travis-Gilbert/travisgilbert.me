/**
 * D3 layout computation for galaxy answer construction.
 * Runs D3 force simulation synchronously to compute target positions
 * for evidence nodes, then maps them to canvas coordinates.
 */

import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
} from 'd3';
import type { EvidenceNode, EvidenceEdge } from '@/lib/theseus-types';

interface LayoutNode {
  id: string;
  x: number;
  y: number;
  objectType: string;
}

interface LayoutEdge {
  source: string;
  target: string;
  strength: number;
}

export interface LayoutResult {
  positions: Map<string, { x: number; y: number }>;
  edges: Array<{ fromId: string; toId: string; strength: number }>;
}

/**
 * Compute force-directed graph layout for evidence nodes.
 * Runs the simulation to completion synchronously (no per-frame ticking).
 */
export function computeGraphLayout(
  nodes: EvidenceNode[],
  edges: EvidenceEdge[],
  canvasWidth: number,
  canvasHeight: number,
): LayoutResult {
  if (nodes.length === 0) {
    return { positions: new Map(), edges: [] };
  }

  const simNodes: LayoutNode[] = nodes.map((n) => ({
    id: n.object_id,
    x: canvasWidth / 2 + (Math.random() - 0.5) * 100,
    y: canvasHeight / 2 + (Math.random() - 0.5) * 100,
    objectType: n.object_type,
  }));

  const nodeIds = new Set(simNodes.map((n) => n.id));
  const simEdges: LayoutEdge[] = edges
    .filter((e) => nodeIds.has(e.from_id) && nodeIds.has(e.to_id))
    .map((e) => ({
      source: e.from_id,
      target: e.to_id,
      strength: e.strength,
    }));

  const sim = forceSimulation(simNodes as any)
    .force(
      'link',
      forceLink(simEdges as any)
        .id((d: any) => d.id)
        .distance(60)
        .strength((d: any) => d.strength * 0.5),
    )
    .force('charge', forceManyBody().strength(-200))
    .force('center', forceCenter(canvasWidth / 2, canvasHeight / 2))
    .force('collide', forceCollide(12))
    .stop();

  // Run simulation to completion
  for (let i = 0; i < 300; i++) sim.tick();

  // Clamp positions to canvas bounds with padding
  const pad = 60;
  const positions = new Map<string, { x: number; y: number }>();
  for (const node of simNodes) {
    positions.set(node.id, {
      x: Math.max(pad, Math.min(canvasWidth - pad, node.x)),
      y: Math.max(pad, Math.min(canvasHeight - pad, node.y)),
    });
  }

  return {
    positions,
    edges: simEdges.map((e) => ({
      fromId: typeof e.source === 'string' ? e.source : (e.source as any).id,
      toId: typeof e.target === 'string' ? e.target : (e.target as any).id,
      strength: e.strength,
    })),
  };
}

/**
 * Compute cluster layout: groups evidence into semantic clusters,
 * positions each cluster center radially, then distributes dots
 * within each cluster.
 */
export function computeClusterLayout(
  nodes: EvidenceNode[],
  canvasWidth: number,
  canvasHeight: number,
): LayoutResult {
  if (nodes.length === 0) {
    return { positions: new Map(), edges: [] };
  }

  // Group by object type
  const groups = new Map<string, EvidenceNode[]>();
  for (const node of nodes) {
    const type = node.object_type;
    if (!groups.has(type)) groups.set(type, []);
    groups.get(type)!.push(node);
  }

  const cx = canvasWidth / 2;
  const cy = canvasHeight / 2;
  const radius = Math.min(canvasWidth, canvasHeight) * 0.3;
  const groupKeys = Array.from(groups.keys());
  const positions = new Map<string, { x: number; y: number }>();

  groupKeys.forEach((type, groupIdx) => {
    const angle = (groupIdx / groupKeys.length) * Math.PI * 2 - Math.PI / 2;
    const groupCx = cx + Math.cos(angle) * radius;
    const groupCy = cy + Math.sin(angle) * radius;
    const members = groups.get(type)!;

    members.forEach((node, memberIdx) => {
      const memberAngle = (memberIdx / members.length) * Math.PI * 2;
      const memberRadius = Math.min(40, members.length * 8);
      positions.set(node.object_id, {
        x: groupCx + Math.cos(memberAngle) * memberRadius,
        y: groupCy + Math.sin(memberAngle) * memberRadius,
      });
    });
  });

  return { positions, edges: [] };
}

/**
 * Compute timeline layout: events along horizontal axis,
 * branching vertically per category.
 */
export function computeTimelineLayout(
  nodes: EvidenceNode[],
  canvasWidth: number,
  canvasHeight: number,
): LayoutResult {
  if (nodes.length === 0) {
    return { positions: new Map(), edges: [] };
  }

  const pad = 80;
  const usableWidth = canvasWidth - pad * 2;
  const cy = canvasHeight / 2;

  // Sort by created_at if available in metadata, otherwise by index
  const sorted = [...nodes].sort((a, b) => {
    const aDate = a.metadata?.created_at as string | undefined;
    const bDate = b.metadata?.created_at as string | undefined;
    if (aDate && bDate) return aDate.localeCompare(bDate);
    return 0;
  });

  // Group by type for vertical offset
  const types = Array.from(new Set(sorted.map((n) => n.object_type)));
  const typeIndex = new Map(types.map((t, i) => [t, i]));

  const positions = new Map<string, { x: number; y: number }>();
  sorted.forEach((node, i) => {
    const x = pad + (i / Math.max(1, sorted.length - 1)) * usableWidth;
    const typeOffset = (typeIndex.get(node.object_type) ?? 0) - (types.length - 1) / 2;
    const y = cy + typeOffset * 40;
    positions.set(node.object_id, { x, y });
  });

  return { positions, edges: [] };
}
