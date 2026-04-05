/**
 * ArgumentRenderer: Directed evidence -> premise -> conclusion graph.
 *
 * Powers the "Show me why" toggle, Challenge, and Jenga interactions.
 * Conclusion at top (large), premises mid-level, evidence at bottom.
 * Directed arrows point upward: evidence supports premises supports conclusion.
 *
 * The ID legend includes epistemic roles alongside node IDs so TF.js
 * Decision 4 (load-bearing identification) has role information without
 * a second lookup. This is the most semantically heavy renderer.
 *
 * Hard edges, flat fills, no AA. Designed for stippling, not viewing.
 */

import type { EvidenceNode, EvidenceEdge } from '@/lib/theseus-types';
import type { OffscreenRenderResult, IdEntry } from './types';
import { createCanvasPair, indexToHex, OFFSCREEN_SIZE, bottomToTopPhaseTemplate } from './types';

type ArgumentRole = 'conclusion' | 'premise' | 'evidence';

interface ArgumentNode {
  id: string;
  role: ArgumentRole;
  x: number;
  y: number;
  radius: number;
}

/**
 * Classify evidence nodes into argument roles.
 *
 * Uses edge topology: nodes with only outgoing "supports" edges are evidence.
 * Nodes with both incoming and outgoing are premises. The node with only
 * incoming edges (or the focal node) is the conclusion.
 */
function classifyRoles(
  nodes: EvidenceNode[],
  edges: EvidenceEdge[],
): Map<string, ArgumentRole> {
  const roles = new Map<string, ArgumentRole>();
  const inDegree = new Map<string, number>();
  const outDegree = new Map<string, number>();

  for (const node of nodes) {
    inDegree.set(node.object_id, 0);
    outDegree.set(node.object_id, 0);
  }

  for (const edge of edges) {
    inDegree.set(edge.to_id, (inDegree.get(edge.to_id) ?? 0) + 1);
    outDegree.set(edge.from_id, (outDegree.get(edge.from_id) ?? 0) + 1);
  }

  // Conclusion: highest in-degree with lowest out-degree; or role === 'conclusion'
  let conclusionId: string | null = null;
  let bestScore = -Infinity;

  for (const node of nodes) {
    // Check if the node is explicitly tagged as conclusion via epistemic_role
    if (node.epistemic_role === 'conclusion') {
      conclusionId = node.object_id;
      break;
    }
    const score = (inDegree.get(node.object_id) ?? 0) - (outDegree.get(node.object_id) ?? 0);
    if (score > bestScore) {
      bestScore = score;
      conclusionId = node.object_id;
    }
  }

  for (const node of nodes) {
    if (node.object_id === conclusionId) {
      roles.set(node.object_id, 'conclusion');
    } else if ((outDegree.get(node.object_id) ?? 0) > 0 && (inDegree.get(node.object_id) ?? 0) > 0) {
      roles.set(node.object_id, 'premise');
    } else {
      roles.set(node.object_id, 'evidence');
    }
  }

  return roles;
}

export function renderArgument(
  nodes: EvidenceNode[],
  edges: EvidenceEdge[],
): OffscreenRenderResult {
  const { visual, visualCtx, idMap, idCtx } = createCanvasPair();
  const S = OFFSCREEN_SIZE;
  const idLegend = new Map<string, IdEntry>();

  const roles = classifyRoles(nodes, edges);

  // Group by role
  const conclusions: EvidenceNode[] = [];
  const premises: EvidenceNode[] = [];
  const evidence: EvidenceNode[] = [];

  for (const node of nodes) {
    const role = roles.get(node.object_id) ?? 'evidence';
    if (role === 'conclusion') conclusions.push(node);
    else if (role === 'premise') premises.push(node);
    else evidence.push(node);
  }

  // Layout: three tiers (top, middle, bottom)
  const padX = S * 0.1;
  const padY = S * 0.1;
  const usableW = S - padX * 2;
  const tiers = [
    { y: padY + S * 0.12, items: conclusions, radiusMult: 1.6 },   // top
    { y: S * 0.48, items: premises, radiusMult: 1.0 },              // middle
    { y: S - padY - S * 0.12, items: evidence, radiusMult: 0.7 },   // bottom
  ];

  const baseRadius = Math.min(S * 0.04, usableW / (Math.max(1, premises.length, evidence.length) * 3));
  const arrowWidth = Math.max(2, baseRadius * 0.25);

  // Build positioned argument nodes
  const positioned: ArgumentNode[] = [];

  for (const tier of tiers) {
    const count = Math.max(1, tier.items.length);
    for (let i = 0; i < tier.items.length; i++) {
      const x = count === 1 ? S / 2 : padX + (usableW / (count - 1)) * i;
      const r = baseRadius * tier.radiusMult;
      positioned.push({
        id: tier.items[i].object_id,
        role: roles.get(tier.items[i].object_id) ?? 'evidence',
        x,
        y: tier.y,
        radius: r,
      });
    }
  }

  const posMap = new Map(positioned.map((p) => [p.id, p]));

  // Draw directed arrows (evidence -> premise -> conclusion, pointing upward)
  for (const edge of edges) {
    const from = posMap.get(edge.from_id);
    const to = posMap.get(edge.to_id);
    if (!from || !to) continue;

    // Arrow shaft
    visualCtx.strokeStyle = edge.relation === 'contradicts' ? '#888888' : '#aaaaaa';
    visualCtx.lineWidth = arrowWidth;
    if (edge.relation === 'contradicts') {
      visualCtx.setLineDash([6, 4]);
    }
    visualCtx.beginPath();
    visualCtx.moveTo(from.x, from.y);
    visualCtx.lineTo(to.x, to.y);
    visualCtx.stroke();
    visualCtx.setLineDash([]);

    // Arrowhead at target
    const angle = Math.atan2(to.y - from.y, to.x - from.x);
    const headLen = arrowWidth * 4;
    visualCtx.fillStyle = '#aaaaaa';
    visualCtx.beginPath();
    visualCtx.moveTo(to.x, to.y);
    visualCtx.lineTo(
      to.x - headLen * Math.cos(angle - 0.4),
      to.y - headLen * Math.sin(angle - 0.4),
    );
    visualCtx.lineTo(
      to.x - headLen * Math.cos(angle + 0.4),
      to.y - headLen * Math.sin(angle + 0.4),
    );
    visualCtx.closePath();
    visualCtx.fill();
  }

  // Draw nodes
  for (let i = 0; i < positioned.length; i++) {
    const an = positioned[i];

    // Visual: white filled circle, conclusion brighter
    visualCtx.fillStyle = an.role === 'conclusion' ? '#ffffff' : '#dddddd';
    visualCtx.beginPath();
    visualCtx.arc(an.x, an.y, an.radius, 0, Math.PI * 2);
    visualCtx.fill();

    // ID map with role information
    const hex = indexToHex(i);
    idCtx.fillStyle = hex;
    idCtx.beginPath();
    idCtx.arc(an.x, an.y, an.radius, 0, Math.PI * 2);
    idCtx.fill();
    idLegend.set(hex, { nodeId: an.id, role: an.role });
  }

  // Phase: bottom-to-top (evidence first, conclusion last)
  const phaseTemplate = bottomToTopPhaseTemplate(16, 3);

  return { visual, idMap, idLegend, phaseTemplate };
}
