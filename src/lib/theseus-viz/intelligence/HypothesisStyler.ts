/* SPEC-VIE-3 v3: Job 2, Hypothesis styling */

import type { EvidenceNode, EvidenceEdge } from '@/lib/theseus-types';
import type { HypothesisStyle, HypothesisEdgeStyle } from '../SceneDirective';

export interface LearnedHypothesisOutputs {
  /** [global_tentative_factor, default_dash_scale] */
  params: Float32Array;
}

export function styleHypotheses(
  nodes: EvidenceNode[],
  edges: EvidenceEdge[],
  learned?: LearnedHypothesisOutputs,
): HypothesisStyle {
  const hypothesisNodes = new Set(
    nodes.filter(nd => nd.epistemic_role === 'hypothetical').map(nd => nd.object_id),
  );
  const hasHypothetical = hypothesisNodes.size > 0;

  const globalTentativeFactor = learned
    ? learned.params[0]
    : nodes.length > 0 ? hypothesisNodes.size / nodes.length : 0;

  const edgeStyles: HypothesisEdgeStyle[] = edges.map(e => {
    const isProposed = hypothesisNodes.has(e.from_id) || hypothesisNodes.has(e.to_id)
      || e.signal_type === 'analogy' || e.strength < 0.2;

    if (!isProposed) {
      return {
        edge_key: `${e.from_id}->${e.to_id}`,
        visibility: 1.0,
        dash_scale: 1.0,
      };
    }

    return {
      edge_key: `${e.from_id}->${e.to_id}`,
      visibility: e.strength,
      dash_scale: learned ? learned.params[1] : 2.0 - e.strength,
      color_override: 'var(--vie-amber)',
    };
  });

  return {
    has_hypothetical_content: hasHypothetical,
    global_tentative_factor: globalTentativeFactor,
    edge_styles: edgeStyles,
  };
}
