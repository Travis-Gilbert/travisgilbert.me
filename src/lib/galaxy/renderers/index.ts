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

/**
 * Render the offscreen dual-canvas pair for the given answer type.
 *
 * Returns null for types that don't use the stippling pipeline:
 *   - portrait / object-scene: uses VisionTracer pipeline instead
 *   - heatmap with geographic data: uses D3/Vega renderer stack
 *   - bar-chart / line-chart: uses async DataVizRenderer (call renderDataVizAnswer instead)
 */
export function renderAnswer(
  vizType: VizType,
  nodes: EvidenceNode[],
  edges: EvidenceEdge[],
): OffscreenRenderResult | null {
  switch (vizType) {
    case 'comparison':
      return renderComparison(nodes, edges);
    case 'timeline':
      return renderTimeline(nodes, edges);
    case 'graph-native':
      // Graph-native uses explanation (hub-and-spoke) as default topology
      return renderExplanation(nodes, edges);
    default:
      // Explanation as universal fallback for unclassified types
      return renderExplanation(nodes, edges);
  }
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
