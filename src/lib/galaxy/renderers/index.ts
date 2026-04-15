/**
 * Offscreen renderer orchestrator.
 *
 * Selects the appropriate renderer based on the vizPlanner's answer
 * type classification and produces the dual-canvas output that feeds
 * into StipplingEngine.
 */

import type { VizType } from '@/lib/theseus-viz/vizPlanner';
import type { EvidenceNode, EvidenceEdge } from '@/lib/theseus-types';
import type { OffscreenRenderResult } from './types';
import { renderComparison } from './ComparisonRenderer';
import { renderTimeline } from './TimelineRenderer';
import { renderHierarchy } from './HierarchyRenderer';
import { renderExplanation } from './ExplanationRenderer';
import { renderArgument } from './ArgumentRenderer';
import { renderGeographic, loadMapImage } from './GeographicRenderer';
import { renderProcessFlow } from './ProcessFlowRenderer';
import { renderConceptMap } from './ConceptMapRenderer';
import { renderTfjsStipple } from './TfjsStippleRenderer';
import type { GeographicRegionsSection } from '@/lib/theseus-types';

/**
 * Render the offscreen dual-canvas pair for the given answer type.
 *
 * The first argument accepts either the client-side VizType prediction
 * or the backend's authoritative structured_visual.renderer key. The
 * third argument carries renderer-specific structured data from the
 * backend visual pipeline (steps for process_flow, focal center for
 * concept_map, precomputed points for tfjs_stipple, etc.).
 *
 * Returns null for types that don't use the stippling pipeline:
 *   - portrait / object-scene: uses VisionTracer pipeline instead
 *   - heatmap with geographic data: uses D3/Vega renderer stack
 *   - bar-chart / line-chart: uses async DataVizRenderer (call renderDataVizAnswer instead)
 */
export function renderAnswer(
  vizType: VizType | string,
  nodes: EvidenceNode[],
  edges: EvidenceEdge[],
  structured?: Record<string, unknown>,
): OffscreenRenderResult | null {
  switch (vizType) {
    case 'comparison':
    case 'comparison_table':
      return renderComparison(nodes, edges);
    case 'timeline':
    case 'timeline_strip':
      return renderTimeline(nodes, edges);
    case 'hierarchy':
    case 'truth-map':
    case 'hierarchy_tree':
      return renderHierarchy(nodes, edges);
    case 'diagram':
    case 'process_flow':
      return renderProcessFlow(nodes, edges, structured);
    case 'explanation':
    case 'concept_map':
      return renderConceptMap(nodes, edges, structured);
    case 'tfjs_stipple':
      return renderTfjsStipple(nodes, edges, structured);
    case 'graph-native':
      return renderExplanation(nodes, edges);
    default:
      return renderExplanation(nodes, edges);
  }
}

/**
 * Render a geographic answer with optional reference image and region overlays.
 * Async because it may need to load a map image from URL.
 */
export async function renderGeographicAnswer(
  imageUrl: string | null | undefined,
  geoSection: GeographicRegionsSection,
): Promise<OffscreenRenderResult> {
  const img = imageUrl ? await loadMapImage(imageUrl) : null;
  return renderGeographic(img, geoSection);
}

/**
 * Render an argument structure view (for "Show me why" toggle).
 * Separate from renderAnswer because it can be called on any answer
 * type as a secondary view, not just on argument-classified queries.
 */
export function renderArgumentView(
  nodes: EvidenceNode[],
  edges: EvidenceEdge[],
): OffscreenRenderResult {
  return renderArgument(nodes, edges);
}

/**
 * Render a hierarchy/decision tree view.
 */
export function renderHierarchyView(
  nodes: EvidenceNode[],
  edges: EvidenceEdge[],
): OffscreenRenderResult {
  return renderHierarchy(nodes, edges);
}

/**
 * Render a Vega-Lite data visualization (async, needs vega-embed).
 * Call this for bar-chart, line-chart, heatmap, and comparison
 * types when a Vega-Lite spec is available from the backend.
 */
export async function renderDataVizAnswer(
  vegaSpec: Record<string, unknown>,
  labels?: string[],
): Promise<OffscreenRenderResult> {
  const { renderDataViz } = await import('./DataVizRenderer');
  return renderDataViz(vegaSpec, labels);
}

export type { OffscreenRenderResult, IdEntry } from './types';
