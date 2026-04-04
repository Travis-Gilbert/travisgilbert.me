/**
 * Target generator orchestrator for galaxy answer construction.
 *
 * Tries image tracing first (if reference_image_url available),
 * falls back to existing graph/cluster layouts from galaxyLayout.ts.
 */

import { traceImageToTargets, type ParticleTarget } from './ImageTracer';
import {
  computeGraphLayout,
  computeClusterLayout,
  type LayoutResult,
} from '@/components/theseus/galaxyLayout';
import type { EvidenceNode, EvidenceEdge } from '@/lib/theseus-types';

export interface TargetResult {
  method: 'image-trace' | 'graph-layout' | 'cluster-layout';
  /**
   * Target positions in canvas coordinates.
   * For image-trace: distributed across ALL dots (not just cluster-mapped ones).
   * For graph/cluster: only covers evidence nodes (same as existing behavior).
   */
  targets: Array<{ x: number; y: number; weight: number }>;
  /** Original layout result when using graph/cluster (for edges) */
  layout?: LayoutResult;
}

/**
 * Generate target positions for galaxy answer construction.
 *
 * @param imageUrl Optional reference image URL from the API
 * @param nodes Evidence nodes from the response
 * @param edges Evidence edges from the response
 * @param canvasWidth Canvas width in CSS pixels
 * @param canvasHeight Canvas height in CSS pixels
 * @param totalDotCount Total number of dots in the grid (for image mode)
 */
export async function generateTargets(
  imageUrl: string | null | undefined,
  nodes: EvidenceNode[],
  edges: EvidenceEdge[],
  canvasWidth: number,
  canvasHeight: number,
  totalDotCount: number,
): Promise<TargetResult> {
  // Try image tracing if URL is available
  if (imageUrl) {
    try {
      const particleTargets = await traceImageToTargets(
        imageUrl,
        Math.min(totalDotCount, 2000), // cap at 2000 targets for performance
      );

      // Require at least 10% of dot count for a usable image trace
      if (particleTargets.length > totalDotCount * 0.1) {
        // Scale normalized positions to canvas coordinates with padding
        const padX = canvasWidth * 0.1;
        const padY = canvasHeight * 0.1;
        const usableW = canvasWidth - padX * 2;
        const usableH = canvasHeight - padY * 2;

        const targets = particleTargets.map((t) => ({
          x: padX + t.x * usableW,
          y: padY + t.y * usableH,
          weight: t.weight,
        }));

        return { method: 'image-trace', targets };
      }
    } catch (err) {
      console.warn('[Galaxy] Image tracing failed, falling back to layout:', err);
    }
  }

  // Fall back to existing layout algorithms
  if (edges.length > 0) {
    const layout = computeGraphLayout(nodes, edges, canvasWidth, canvasHeight);
    const targets = Array.from(layout.positions.values()).map((pos) => ({
      x: pos.x,
      y: pos.y,
      weight: 0.5,
    }));
    return { method: 'graph-layout', targets, layout };
  }

  const layout = computeClusterLayout(nodes, canvasWidth, canvasHeight);
  const targets = Array.from(layout.positions.values()).map((pos) => ({
    x: pos.x,
    y: pos.y,
    weight: 0.5,
  }));
  return { method: 'cluster-layout', targets, layout };
}
