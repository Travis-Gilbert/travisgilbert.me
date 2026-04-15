/**
 * ConceptMapRenderer: Radial layout with central focal concept.
 *
 * "What is X and what relates to it?" renders as a large central circle
 * (the focal concept) surrounded by a ring of satellite circles
 * connected by spoke lines. Similar to ExplanationRenderer but labels
 * the focal concept from the backend's structured payload when present.
 *
 * Hard edges, flat fills, no AA. Designed for stippling, not viewing.
 */

import type { EvidenceNode, EvidenceEdge } from '@/lib/theseus-types';
import type { OffscreenRenderResult, IdEntry } from './types';
import { createCanvasPair, indexToHex, OFFSCREEN_SIZE, centerOutwardPhaseTemplate } from './types';

interface ConceptLayout {
  centerNodeId: string;
  satelliteNodeIds: string[];
}

/**
 * Pick the focal concept from the structured payload, falling back to
 * the most connected node when no center is specified.
 */
function resolveLayout(
  nodes: EvidenceNode[],
  edges: EvidenceEdge[],
  structured: Record<string, unknown> | undefined,
): ConceptLayout {
  let centerId: string | null = null;

  if (structured) {
    const center = structured.center;
    if (typeof center === 'string') {
      centerId = center;
    } else if (typeof center === 'object' && center !== null) {
      const obj = center as Record<string, unknown>;
      if (typeof obj.node_id === 'string') centerId = obj.node_id;
      else if (typeof obj.id === 'string') centerId = obj.id;
    }
  }

  if (!centerId) {
    // Fallback: most connected node
    const degree = new Map<string, number>();
    for (const edge of edges) {
      degree.set(edge.from_id, (degree.get(edge.from_id) ?? 0) + 1);
      degree.set(edge.to_id, (degree.get(edge.to_id) ?? 0) + 1);
    }
    let maxDeg = -1;
    for (const node of nodes) {
      const d = degree.get(node.object_id) ?? 0;
      if (d > maxDeg) {
        maxDeg = d;
        centerId = node.object_id;
      }
    }
  }

  const resolvedCenter = centerId ?? nodes[0]?.object_id ?? '';
  const satellites = nodes
    .map((n) => n.object_id)
    .filter((id) => id !== resolvedCenter);

  return { centerNodeId: resolvedCenter, satelliteNodeIds: satellites };
}

export function renderConceptMap(
  nodes: EvidenceNode[],
  edges: EvidenceEdge[],
  structured?: Record<string, unknown>,
): OffscreenRenderResult {
  const { visual, visualCtx, idMap, idCtx } = createCanvasPair();
  const S = OFFSCREEN_SIZE;
  const idLegend = new Map<string, IdEntry>();

  const layout = resolveLayout(nodes, edges, structured);
  const satCount = Math.max(1, layout.satelliteNodeIds.length);

  const cx = S / 2;
  const cy = S / 2;
  const centerRadius = S * 0.13;
  const orbitRadius = S * 0.32;
  const satRadius = Math.min(S * 0.06, (Math.PI * 2 * orbitRadius) / (satCount * 2.8));
  const spokeWidth = Math.max(3, satRadius * 0.35);

  // Draw spokes first (behind circles)
  for (let i = 0; i < satCount; i++) {
    const angle = (i / satCount) * Math.PI * 2 - Math.PI / 2;
    const sx = cx + Math.cos(angle) * orbitRadius;
    const sy = cy + Math.sin(angle) * orbitRadius;

    visualCtx.strokeStyle = '#aaaaaa';
    visualCtx.lineWidth = spokeWidth;
    visualCtx.beginPath();
    visualCtx.moveTo(cx, cy);
    visualCtx.lineTo(sx, sy);
    visualCtx.stroke();
  }

  // Draw central focal concept
  visualCtx.fillStyle = '#ffffff';
  visualCtx.beginPath();
  visualCtx.arc(cx, cy, centerRadius, 0, Math.PI * 2);
  visualCtx.fill();

  const centerHex = indexToHex(0);
  idCtx.fillStyle = centerHex;
  idCtx.beginPath();
  idCtx.arc(cx, cy, centerRadius, 0, Math.PI * 2);
  idCtx.fill();
  if (layout.centerNodeId) {
    idLegend.set(centerHex, { nodeId: layout.centerNodeId });
  }

  // Draw satellite concepts
  for (let i = 0; i < layout.satelliteNodeIds.length; i++) {
    const angle = (i / satCount) * Math.PI * 2 - Math.PI / 2;
    const sx = cx + Math.cos(angle) * orbitRadius;
    const sy = cy + Math.sin(angle) * orbitRadius;

    visualCtx.fillStyle = '#ffffff';
    visualCtx.beginPath();
    visualCtx.arc(sx, sy, satRadius, 0, Math.PI * 2);
    visualCtx.fill();

    const hex = indexToHex(i + 1);
    idCtx.fillStyle = hex;
    idCtx.beginPath();
    idCtx.arc(sx, sy, satRadius, 0, Math.PI * 2);
    idCtx.fill();
    idLegend.set(hex, { nodeId: layout.satelliteNodeIds[i] });
  }

  // Center-outward reveal: focal concept first, satellites radiate outward
  const phaseTemplate = centerOutwardPhaseTemplate(8, 3);

  return { visual, idMap, idLegend, phaseTemplate };
}
