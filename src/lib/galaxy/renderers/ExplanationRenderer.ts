/**
 * ExplanationRenderer: Hub-and-spoke with central concept.
 *
 * "Explain blockchain to me" renders as a large central circle
 * (the core concept) surrounded by smaller satellite circles
 * (supporting concepts) connected by thick lines.
 *
 * Hard edges, flat fills, no AA. Designed for stippling, not viewing.
 */

import type { EvidenceNode, EvidenceEdge } from '@/lib/theseus-types';
import type { OffscreenRenderResult, IdEntry } from './types';
import { createCanvasPair, indexToHex, OFFSCREEN_SIZE, centerOutwardPhaseTemplate } from './types';

/**
 * Find the hub node (most connected) and satellite nodes.
 */
function findHub(
  nodes: EvidenceNode[],
  edges: EvidenceEdge[],
): { hub: EvidenceNode; satellites: EvidenceNode[] } {
  if (nodes.length === 0) {
    return { hub: { object_id: 'empty', title: '', object_type: 'concept', epistemic_role: 'substantive', gradual_strength: 0, claims: [] }, satellites: [] };
  }

  // Count connections per node
  const degree = new Map<string, number>();
  for (const edge of edges) {
    degree.set(edge.from_id, (degree.get(edge.from_id) ?? 0) + 1);
    degree.set(edge.to_id, (degree.get(edge.to_id) ?? 0) + 1);
  }

  // Hub = most connected; fallback to first node
  let hubNode = nodes[0];
  let maxDeg = 0;
  for (const node of nodes) {
    const d = degree.get(node.object_id) ?? 0;
    if (d > maxDeg) {
      maxDeg = d;
      hubNode = node;
    }
  }

  const satellites = nodes.filter((n) => n.object_id !== hubNode.object_id);
  return { hub: hubNode, satellites };
}

export function renderExplanation(
  nodes: EvidenceNode[],
  edges: EvidenceEdge[],
): OffscreenRenderResult {
  const { visual, visualCtx, idMap, idCtx } = createCanvasPair();
  const S = OFFSCREEN_SIZE;
  const idLegend = new Map<string, IdEntry>();

  const { hub, satellites } = findHub(nodes, edges);
  const cx = S / 2;
  const cy = S / 2;
  const hubRadius = S * 0.12;
  const orbitRadius = S * 0.3;
  const satRadius = Math.min(S * 0.05, (Math.PI * 2 * orbitRadius) / (satellites.length * 3));
  const lineWidth = Math.max(3, satRadius * 0.3);

  // Draw spokes first (behind nodes)
  for (let i = 0; i < satellites.length; i++) {
    const angle = (i / Math.max(1, satellites.length)) * Math.PI * 2 - Math.PI / 2;
    const sx = cx + Math.cos(angle) * orbitRadius;
    const sy = cy + Math.sin(angle) * orbitRadius;

    visualCtx.strokeStyle = '#aaaaaa';
    visualCtx.lineWidth = lineWidth;
    visualCtx.beginPath();
    visualCtx.moveTo(cx, cy);
    visualCtx.lineTo(sx, sy);
    visualCtx.stroke();
  }

  // Draw hub (large white circle)
  visualCtx.fillStyle = '#ffffff';
  visualCtx.beginPath();
  visualCtx.arc(cx, cy, hubRadius, 0, Math.PI * 2);
  visualCtx.fill();

  const hubHex = indexToHex(0);
  idCtx.fillStyle = hubHex;
  idCtx.beginPath();
  idCtx.arc(cx, cy, hubRadius, 0, Math.PI * 2);
  idCtx.fill();
  idLegend.set(hubHex, { nodeId: hub.object_id });

  // Draw satellites
  for (let i = 0; i < satellites.length; i++) {
    const angle = (i / Math.max(1, satellites.length)) * Math.PI * 2 - Math.PI / 2;
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
    idLegend.set(hex, { nodeId: satellites[i].object_id });
  }

  // Phase: center first, then satellites
  const phaseTemplate = centerOutwardPhaseTemplate(8, 2);

  return { visual, idMap, idLegend, phaseTemplate };
}
