/**
 * TfjsStippleRenderer: Passthrough for precomputed stipple coordinates.
 *
 * When the backend's visual pipeline runs a TF.js model that already
 * produces stipple positions (normalized 0..1), draw those dots directly
 * onto the shape canvas so the StipplingEngine samples them. If the
 * structured payload has no points, fall back to the generic explanation
 * hub-and-spoke layout.
 *
 * Hard edges, flat fills, no AA. Designed for stippling, not viewing.
 */

import type { EvidenceNode, EvidenceEdge } from '@/lib/theseus-types';
import type { OffscreenRenderResult, IdEntry } from './types';
import {
  createCanvasPair,
  indexToHex,
  OFFSCREEN_SIZE,
  centerOutwardPhaseTemplate,
} from './types';
import { renderExplanation } from './ExplanationRenderer';

interface StipplePoint {
  x: number;
  y: number;
  weight?: number;
  nodeId?: string;
}

function extractPoints(structured: Record<string, unknown> | undefined): StipplePoint[] {
  if (!structured) return [];
  const raw = structured.stipple_points ?? structured.points;
  if (!Array.isArray(raw)) return [];

  const points: StipplePoint[] = [];
  for (const entry of raw) {
    if (Array.isArray(entry) && entry.length >= 2) {
      const [x, y, w] = entry as number[];
      if (typeof x === 'number' && typeof y === 'number') {
        points.push({ x, y, weight: typeof w === 'number' ? w : undefined });
      }
    } else if (typeof entry === 'object' && entry !== null) {
      const obj = entry as Record<string, unknown>;
      const x = typeof obj.x === 'number' ? obj.x : null;
      const y = typeof obj.y === 'number' ? obj.y : null;
      if (x === null || y === null) continue;
      const weight = typeof obj.weight === 'number' ? obj.weight : undefined;
      const nodeId = typeof obj.node_id === 'string'
        ? obj.node_id
        : typeof obj.id === 'string'
          ? obj.id
          : undefined;
      points.push({ x, y, weight, nodeId });
    }
  }
  return points;
}

export function renderTfjsStipple(
  nodes: EvidenceNode[],
  edges: EvidenceEdge[],
  structured?: Record<string, unknown>,
): OffscreenRenderResult {
  const points = extractPoints(structured);

  if (points.length === 0) {
    // No precomputed stipple: fall back to the generic explanation layout.
    return renderExplanation(nodes, edges);
  }

  const { visual, visualCtx, idMap, idCtx } = createCanvasPair();
  const S = OFFSCREEN_SIZE;
  const idLegend = new Map<string, IdEntry>();

  // Normalized coordinates may arrive in [0, 1] or already in pixel space.
  // Detect which by checking the max magnitude.
  const maxX = points.reduce((m, p) => Math.max(m, Math.abs(p.x)), 0);
  const maxY = points.reduce((m, p) => Math.max(m, Math.abs(p.y)), 0);
  const scaleX = maxX > 1.5 ? 1 : S;
  const scaleY = maxY > 1.5 ? 1 : S;

  const dotRadius = Math.max(2, Math.min(6, Math.sqrt((S * S) / (points.length * 4))));

  // Collect unique nodeIds for id-map coloring
  const nodeIdIndex = new Map<string, number>();
  for (const point of points) {
    if (point.nodeId && !nodeIdIndex.has(point.nodeId)) {
      const hex = indexToHex(nodeIdIndex.size);
      nodeIdIndex.set(point.nodeId, nodeIdIndex.size);
      idLegend.set(hex, { nodeId: point.nodeId });
    }
  }

  // Draw each precomputed stipple as a solid dot
  for (const point of points) {
    const x = point.x * scaleX;
    const y = point.y * scaleY;
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;

    const brightness = point.weight !== undefined
      ? Math.max(64, Math.min(255, Math.round(point.weight * 255)))
      : 255;
    const hexChannel = brightness.toString(16).padStart(2, '0');
    visualCtx.fillStyle = `#${hexChannel}${hexChannel}${hexChannel}`;
    visualCtx.beginPath();
    visualCtx.arc(x, y, dotRadius, 0, Math.PI * 2);
    visualCtx.fill();

    if (point.nodeId) {
      const idx = nodeIdIndex.get(point.nodeId) ?? 0;
      idCtx.fillStyle = indexToHex(idx);
      idCtx.beginPath();
      idCtx.arc(x, y, dotRadius, 0, Math.PI * 2);
      idCtx.fill();
    }
  }

  const phaseTemplate = centerOutwardPhaseTemplate(8, 3);
  return { visual, idMap, idLegend, phaseTemplate };
}
