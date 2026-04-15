/**
 * ProcessFlowRenderer: Horizontal sequence of steps with directional arrows.
 *
 * "How does X work, step by step?" renders as a left-to-right chain of
 * filled rectangles (steps) connected by arrow heads. Each step is a
 * distinct semantic region; step order comes from backend structured
 * payload when available, otherwise from node order in the evidence set.
 *
 * Hard edges, flat fills, no AA. Designed for stippling, not viewing.
 */

import type { EvidenceNode, EvidenceEdge } from '@/lib/theseus-types';
import type { OffscreenRenderResult, IdEntry } from './types';
import { createCanvasPair, indexToHex, OFFSCREEN_SIZE, leftToRightPhaseTemplate } from './types';

interface ProcessStep {
  nodeId: string;
  label: string;
  order: number;
}

/**
 * Extract ordered process steps from structured payload if present,
 * otherwise fall back to the incoming node order.
 */
function resolveSteps(
  nodes: EvidenceNode[],
  structured: Record<string, unknown> | undefined,
): ProcessStep[] {
  const rawSteps = structured && Array.isArray(structured.steps)
    ? (structured.steps as unknown[])
    : null;

  if (rawSteps && rawSteps.length > 0) {
    const mapped: ProcessStep[] = [];
    rawSteps.forEach((entry, index) => {
      if (typeof entry === 'object' && entry !== null) {
        const obj = entry as Record<string, unknown>;
        const nodeId = typeof obj.node_id === 'string'
          ? obj.node_id
          : typeof obj.id === 'string'
            ? obj.id
            : nodes[index]?.object_id ?? '';
        const label = typeof obj.label === 'string'
          ? obj.label
          : typeof obj.title === 'string'
            ? obj.title
            : nodes[index]?.title ?? `Step ${index + 1}`;
        const order = typeof obj.order === 'number' ? obj.order : index;
        mapped.push({ nodeId, label, order });
      } else if (typeof entry === 'string') {
        mapped.push({
          nodeId: nodes[index]?.object_id ?? entry,
          label: nodes[index]?.title ?? entry,
          order: index,
        });
      }
    });
    if (mapped.length > 0) {
      mapped.sort((a, b) => a.order - b.order);
      return mapped;
    }
  }

  return nodes.map((node, index) => ({
    nodeId: node.object_id,
    label: node.title,
    order: index,
  }));
}

export function renderProcessFlow(
  nodes: EvidenceNode[],
  // Edges are not needed for process flow ordering; the sequence is
  // determined by structured payload or node order.
  _edges: EvidenceEdge[],
  structured?: Record<string, unknown>,
): OffscreenRenderResult {
  const { visual, visualCtx, idMap, idCtx } = createCanvasPair();
  const S = OFFSCREEN_SIZE;
  const idLegend = new Map<string, IdEntry>();

  const steps = resolveSteps(nodes, structured);
  const count = Math.max(1, steps.length);

  const padX = S * 0.08;
  const usableW = S - padX * 2;
  const cy = S * 0.5;
  const boxW = Math.min(S * 0.16, (usableW - (count - 1) * S * 0.04) / count);
  const boxH = S * 0.2;
  const gap = count > 1 ? (usableW - boxW * count) / (count - 1) : 0;
  const arrowLen = Math.min(gap * 0.6, S * 0.05);
  const arrowThickness = Math.max(4, boxH * 0.08);

  // Draw arrows first (behind boxes)
  if (count > 1) {
    visualCtx.fillStyle = '#aaaaaa';
    for (let i = 0; i < count - 1; i++) {
      const startX = padX + boxW * (i + 1) + gap * i;
      const endX = startX + gap;
      const midY = cy;

      // Shaft
      visualCtx.fillRect(startX, midY - arrowThickness / 2, gap - arrowLen, arrowThickness);

      // Arrow head (triangle)
      visualCtx.beginPath();
      visualCtx.moveTo(endX, midY);
      visualCtx.lineTo(endX - arrowLen, midY - arrowLen * 0.8);
      visualCtx.lineTo(endX - arrowLen, midY + arrowLen * 0.8);
      visualCtx.closePath();
      visualCtx.fill();
    }
  }

  // Draw step boxes (filled white rectangles)
  for (let i = 0; i < count; i++) {
    const x = padX + i * (boxW + gap);
    const y = cy - boxH / 2;

    visualCtx.fillStyle = '#ffffff';
    visualCtx.fillRect(x, y, boxW, boxH);

    const hex = indexToHex(i);
    idCtx.fillStyle = hex;
    idCtx.fillRect(x, y, boxW, boxH);

    const step = steps[i];
    if (step?.nodeId) {
      idLegend.set(hex, { nodeId: step.nodeId });
    }
  }

  // Phase template: sweep left-to-right so dots arrive in step order.
  const phases = Math.min(6, count);
  const phaseTemplate = leftToRightPhaseTemplate(8, Math.max(1, phases));

  return { visual, idMap, idLegend, phaseTemplate };
}
