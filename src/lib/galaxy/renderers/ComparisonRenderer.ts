/**
 * ComparisonRenderer: Two clusters with a bridge zone.
 *
 * "What's the difference between a Roth IRA and a traditional IRA?"
 * renders as two bold filled circles (left, right) connected by a
 * filled rectangle bridge. Shared concepts live in the bridge.
 *
 * Hard edges, flat fills, no AA. Designed for stippling, not viewing.
 */

import type { EvidenceNode, EvidenceEdge } from '@/lib/theseus-types';
import type { OffscreenRenderResult, IdEntry } from './types';
import { createCanvasPair, indexToHex, OFFSCREEN_SIZE, leftToRightPhaseTemplate } from './types';

interface ComparisonSide {
  label: string;
  nodeIds: string[];
}

interface ComparisonLayout {
  left: ComparisonSide;
  right: ComparisonSide;
  shared: string[];
}

/**
 * Partition evidence nodes into left, right, and shared based on edges.
 * Uses a simple heuristic: nodes connected to the first focal node go left,
 * nodes connected to the second go right, nodes connected to both are shared.
 */
function partitionNodes(
  nodes: EvidenceNode[],
  edges: EvidenceEdge[],
): ComparisonLayout {
  if (nodes.length < 2) {
    return {
      left: { label: nodes[0]?.title ?? 'A', nodeIds: nodes.map((n) => n.object_id) },
      right: { label: 'B', nodeIds: [] },
      shared: [],
    };
  }

  // Use the first two nodes as the comparison anchors
  const leftAnchor = nodes[0].object_id;
  const rightAnchor = nodes[1].object_id;

  const leftConnected = new Set<string>();
  const rightConnected = new Set<string>();

  for (const edge of edges) {
    if (edge.from_id === leftAnchor || edge.to_id === leftAnchor) {
      leftConnected.add(edge.from_id === leftAnchor ? edge.to_id : edge.from_id);
    }
    if (edge.from_id === rightAnchor || edge.to_id === rightAnchor) {
      rightConnected.add(edge.from_id === rightAnchor ? edge.to_id : edge.from_id);
    }
  }

  const shared: string[] = [];
  const leftIds: string[] = [leftAnchor];
  const rightIds: string[] = [rightAnchor];

  for (const node of nodes) {
    if (node.object_id === leftAnchor || node.object_id === rightAnchor) continue;
    const inLeft = leftConnected.has(node.object_id);
    const inRight = rightConnected.has(node.object_id);

    if (inLeft && inRight) {
      shared.push(node.object_id);
    } else if (inRight) {
      rightIds.push(node.object_id);
    } else {
      leftIds.push(node.object_id);
    }
  }

  return {
    left: { label: nodes[0].title, nodeIds: leftIds },
    right: { label: nodes[1].title, nodeIds: rightIds },
    shared,
  };
}

export function renderComparison(
  nodes: EvidenceNode[],
  edges: EvidenceEdge[],
): OffscreenRenderResult {
  const { visual, visualCtx, idMap, idCtx } = createCanvasPair();
  const S = OFFSCREEN_SIZE;
  const layout = partitionNodes(nodes, edges);
  const idLegend = new Map<string, IdEntry>();

  // Geometry: two circles and a bridge
  const leftCx = S * 0.28;
  const rightCx = S * 0.72;
  const cy = S * 0.5;
  const radius = S * 0.18;
  const bridgeY = cy - S * 0.06;
  const bridgeH = S * 0.12;

  // Visual canvas: bold white shapes on black
  visualCtx.fillStyle = '#ffffff';
  visualCtx.beginPath();
  visualCtx.arc(leftCx, cy, radius, 0, Math.PI * 2);
  visualCtx.fill();

  visualCtx.beginPath();
  visualCtx.arc(rightCx, cy, radius, 0, Math.PI * 2);
  visualCtx.fill();

  // Bridge rectangle between the two circles
  visualCtx.fillStyle = '#cccccc'; // slightly dimmer so bridge gets fewer dots
  visualCtx.fillRect(leftCx + radius * 0.5, bridgeY, rightCx - leftCx - radius, bridgeH);

  // ID canvas: one color per region, mapped to the anchor node
  const leftHex = indexToHex(0);
  idCtx.fillStyle = leftHex;
  idCtx.beginPath();
  idCtx.arc(leftCx, cy, radius, 0, Math.PI * 2);
  idCtx.fill();
  if (layout.left.nodeIds[0]) {
    idLegend.set(leftHex, { nodeId: layout.left.nodeIds[0] });
  }

  const rightHex = indexToHex(1);
  idCtx.fillStyle = rightHex;
  idCtx.beginPath();
  idCtx.arc(rightCx, cy, radius, 0, Math.PI * 2);
  idCtx.fill();
  if (layout.right.nodeIds[0]) {
    idLegend.set(rightHex, { nodeId: layout.right.nodeIds[0] });
  }

  const bridgeHex = indexToHex(2);
  idCtx.fillStyle = bridgeHex;
  idCtx.fillRect(leftCx + radius * 0.5, bridgeY, rightCx - leftCx - radius, bridgeH);
  if (layout.shared[0]) {
    idLegend.set(bridgeHex, { nodeId: layout.shared[0] });
  }

  // Phase template: left -> right -> bridge
  const phaseTemplate = leftToRightPhaseTemplate(8, 3);

  return { visual, idMap, idLegend, phaseTemplate };
}
