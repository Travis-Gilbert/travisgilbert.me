/**
 * TimelineRenderer: Horizontal axis with state nodes.
 *
 * "How does intermittent fasting work?" renders as a horizontal chain
 * of filled circles (states) connected by thick lines, left to right.
 * Each state is a distinct semantic region.
 *
 * Hard edges, flat fills, no AA. Designed for stippling, not viewing.
 */

import type { EvidenceNode, EvidenceEdge } from '@/lib/theseus-types';
import type { OffscreenRenderResult, IdEntry } from './types';
import { createCanvasPair, indexToHex, OFFSCREEN_SIZE, leftToRightPhaseTemplate } from './types';

/**
 * Order nodes along a timeline using edge topology.
 * Falls back to array order if no clear chain exists.
 */
function orderNodes(nodes: EvidenceNode[], edges: EvidenceEdge[]): EvidenceNode[] {
  if (nodes.length <= 1) return nodes;

  // Build adjacency: source -> target (directed)
  const outgoing = new Map<string, string[]>();
  const incoming = new Set<string>();

  for (const edge of edges) {
    const targets = outgoing.get(edge.from_id) ?? [];
    targets.push(edge.to_id);
    outgoing.set(edge.from_id, targets);
    incoming.add(edge.to_id);
  }

  // Find root: a node with no incoming edges
  const nodeMap = new Map(nodes.map((n) => [n.object_id, n]));
  let root = nodes.find((n) => !incoming.has(n.object_id));
  if (!root) root = nodes[0];

  // Walk the chain
  const ordered: EvidenceNode[] = [];
  const visited = new Set<string>();
  let current = root.object_id;

  while (current && !visited.has(current)) {
    visited.add(current);
    const node = nodeMap.get(current);
    if (node) ordered.push(node);
    const next = outgoing.get(current);
    current = next?.[0] ?? '';
  }

  // Add any remaining nodes not in the chain
  for (const node of nodes) {
    if (!visited.has(node.object_id)) {
      ordered.push(node);
    }
  }

  return ordered;
}

export function renderTimeline(
  nodes: EvidenceNode[],
  edges: EvidenceEdge[],
): OffscreenRenderResult {
  const { visual, visualCtx, idMap, idCtx } = createCanvasPair();
  const S = OFFSCREEN_SIZE;
  const idLegend = new Map<string, IdEntry>();

  const ordered = orderNodes(nodes, edges);
  const count = Math.max(1, ordered.length);

  const padX = S * 0.12;
  const usableW = S - padX * 2;
  const cy = S * 0.5;
  const nodeRadius = Math.min(S * 0.06, usableW / (count * 2.5));
  const lineThickness = Math.max(4, nodeRadius * 0.4);

  // Draw connecting line (white, thick)
  if (count > 1) {
    const x0 = padX + (usableW / (count - 1)) * 0;
    const x1 = padX + (usableW / (count - 1)) * (count - 1);
    visualCtx.strokeStyle = '#aaaaaa';
    visualCtx.lineWidth = lineThickness;
    visualCtx.beginPath();
    visualCtx.moveTo(x0, cy);
    visualCtx.lineTo(x1, cy);
    visualCtx.stroke();
  }

  // Draw nodes as filled circles
  for (let i = 0; i < count; i++) {
    const x = count === 1 ? S / 2 : padX + (usableW / (count - 1)) * i;
    const node = ordered[i];

    // Visual: white circle
    visualCtx.fillStyle = '#ffffff';
    visualCtx.beginPath();
    visualCtx.arc(x, cy, nodeRadius, 0, Math.PI * 2);
    visualCtx.fill();

    // ID map: unique color per node
    const hex = indexToHex(i);
    idCtx.fillStyle = hex;
    idCtx.beginPath();
    idCtx.arc(x, cy, nodeRadius, 0, Math.PI * 2);
    idCtx.fill();

    if (node) {
      idLegend.set(hex, { nodeId: node.object_id });
    }
  }

  // Phase template: left-to-right sweep, one phase per ~2 nodes
  const phases = Math.min(5, count);
  const phaseTemplate = leftToRightPhaseTemplate(8, phases);

  return { visual, idMap, idLegend, phaseTemplate };
}
