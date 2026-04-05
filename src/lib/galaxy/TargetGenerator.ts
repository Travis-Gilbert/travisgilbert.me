/**
 * Target generator orchestrator for galaxy answer construction.
 *
 * Tries image tracing first (if reference_image_url available),
 * falls back to existing graph/cluster layouts from galaxyLayout.ts.
 */

import { traceImageToTargets, type ParticleTarget } from './ImageTracer';
import { traceVision, type VisionMode } from './VisionTracer';
import {
  computeGraphLayout,
  computeClusterLayout,
  type LayoutResult,
} from '@/components/theseus/galaxyLayout';
import type { EvidenceNode, EvidenceEdge, MapSection } from '@/lib/theseus-types';
import type { TruthMapTopologyDirective } from '@/lib/theseus-viz/SceneDirective';
import { mulberry32 } from '@/lib/prng';

export interface TargetResult {
  method: 'image-trace' | 'graph-layout' | 'cluster-layout' | 'truth-map-layout';
  /**
   * Target positions in canvas coordinates.
   * For image-trace: distributed across ALL dots (not just cluster-mapped ones).
   * For graph/cluster: only covers evidence nodes (same as existing behavior).
   * For truth-map: covers agreement clusters, tension bridges, and blind spot edges.
   */
  targets: Array<{ x: number; y: number; weight: number }>;
  /** Original layout result when using graph/cluster (for edges) */
  layout?: LayoutResult;
  /** Region metadata for truth map dot assignment */
  regionType?: ('agreement' | 'tension' | 'blind_spot' | 'ambient')[];
  /** Vision trace mode (person/object) when semantic tracing succeeded */
  visionMode?: VisionMode;
  /** COCO-SSD class labels parallel to targets (object mode only) */
  objectLabels?: string[];
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
    const padX = canvasWidth * 0.1;
    const padY = canvasHeight * 0.1;
    const usableW = canvasWidth - padX * 2;
    const usableH = canvasHeight - padY * 2;

    // Try semantic vision tracing first (face mesh, object detection)
    try {
      const visionResult = await traceVision(
        imageUrl,
        Math.min(totalDotCount, 5000),
      );

      if (visionResult.targets.length > totalDotCount * 0.05) {
        const targets = visionResult.targets.map((t) => ({
          x: padX + t.x * usableW,
          y: padY + t.y * usableH,
          weight: t.weight,
        }));

        return {
          method: 'image-trace',
          targets,
          visionMode: visionResult.mode,
          objectLabels: visionResult.objectLabels,
        };
      }
    } catch (err) {
      console.warn('[Galaxy] Vision tracing failed, trying Sobel:', err);
    }

    // Fall back to Sobel edge detection
    try {
      const particleTargets = await traceImageToTargets(
        imageUrl,
        Math.min(totalDotCount, 2000),
      );

      if (particleTargets.length > totalDotCount * 0.1) {
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

/**
 * Generate 2D target positions for truth map answer construction.
 *
 * Agreement groups become dense clusters, tension bridges connect
 * opposed groups, blind spots are sparse peripheral scatters.
 */
export function generateTruthMapTargets(
  topology: TruthMapTopologyDirective,
  canvasWidth: number,
  canvasHeight: number,
  totalDotCount: number,
): TargetResult {
  const targets: Array<{ x: number; y: number; weight: number }> = [];
  const regionTypes: Array<'agreement' | 'tension' | 'blind_spot' | 'ambient'> = [];

  const rng = mulberry32(91); // deterministic seed for map layouts

  const padX = canvasWidth * 0.12;
  const padY = canvasHeight * 0.12;
  const usableW = canvasWidth - padX * 2;
  const usableH = canvasHeight - padY * 2;
  const cx = canvasWidth / 2;
  const cy = canvasHeight / 2;

  // Layout agreement regions in a circle
  const regionCount = topology.agreement_regions.length;
  const maxRegionCount = Math.max(regionCount, 1);
  const spread = Math.min(usableW, usableH) * 0.3;
  const regionCenters = new Map<string, { x: number; y: number; r: number }>();

  for (let i = 0; i < regionCount; i++) {
    const region = topology.agreement_regions[i];
    const angle = (i / maxRegionCount) * Math.PI * 2 - Math.PI / 2;
    const regionX = cx + Math.cos(angle) * spread;
    const regionY = cy + Math.sin(angle) * spread;
    const regionR = 30 + region.node_ids.length * 8;

    regionCenters.set(region.id, { x: regionX, y: regionY, r: regionR });

    const claimCount = region.node_ids.length;
    const dotCount = Math.max(20, Math.floor(totalDotCount * 0.5 * (claimCount / Math.max(regionCount * 3, 1))));

    for (let j = 0; j < dotCount; j++) {
      const theta = rng() * Math.PI * 2;
      const r = regionR * Math.sqrt(rng());
      targets.push({
        x: regionX + Math.cos(theta) * r,
        y: regionY + Math.sin(theta) * r,
        weight: 0.4 + region.entrenchment * 0.6,
      });
      regionTypes.push('agreement');
    }
  }

  // Tension bridges between opposed regions
  for (const bridge of topology.tension_bridges) {
    const from = regionCenters.get(bridge.from_region_id);
    const to = regionCenters.get(bridge.to_region_id);
    if (!from || !to) continue;

    const bridgeDots = Math.max(10, Math.floor(totalDotCount * 0.03));
    for (let j = 0; j < bridgeDots; j++) {
      const t = rng();
      const jitter = 6;
      targets.push({
        x: from.x + (to.x - from.x) * t + (rng() - 0.5) * jitter,
        y: from.y + (to.y - from.y) * t + (rng() - 0.5) * jitter,
        weight: 0.3,
      });
      regionTypes.push('tension');
    }
  }

  // Blind spot voids: sparse dots at periphery
  for (const bsVoid of topology.blind_spot_voids) {
    const vx = padX + bsVoid.position_hint[0] * usableW * 0.1 + usableW * 0.5;
    const vy = padY + bsVoid.position_hint[1] * usableH * 0.1 + usableH * 0.5;
    const vr = (bsVoid.radius || 1.5) * 20;
    const voidDots = Math.max(5, Math.floor(totalDotCount * 0.01));

    for (let j = 0; j < voidDots; j++) {
      const theta = rng() * Math.PI * 2;
      const r = vr * (0.8 + rng() * 0.3);
      targets.push({
        x: vx + Math.cos(theta) * r,
        y: vy + Math.sin(theta) * r,
        weight: 0.05,
      });
      regionTypes.push('blind_spot');
    }
  }

  return {
    method: 'truth-map-layout',
    targets,
    regionType: regionTypes,
  };
}
