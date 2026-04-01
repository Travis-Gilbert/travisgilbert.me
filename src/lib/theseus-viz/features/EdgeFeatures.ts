/* SPEC-VIE-3: Per-edge feature extraction (14 dimensions) */

import type { EvidenceEdge } from '@/lib/theseus-types';
import { SIGNAL_TYPES, RELATION_TYPES } from '../SceneSpec';

/**
 * Dimensions 0-6:  signal_type one-hot (bm25, sbert, entity, nli, kge, gnn, analogy)
 * Dimension 7:     strength (0.0-1.0)
 * Dimensions 8-12: relation one-hot (supports, contradicts, neutral, elaborates, temporal)
 * Dimension 13:    is_proposed (1.0 if dashed/hypothetical)
 */
export const EDGE_FEATURE_DIM = 14;

export function extractEdgeFeatures(edge: EvidenceEdge): Float32Array {
  const features = new Float32Array(EDGE_FEATURE_DIM);

  // 0-6: signal_type one-hot
  const sigIdx = SIGNAL_TYPES.indexOf(edge.signal_type as typeof SIGNAL_TYPES[number]);
  if (sigIdx >= 0) features[sigIdx] = 1.0;

  // 7: strength
  features[7] = Math.max(0, Math.min(1, edge.strength));

  // 8-12: relation one-hot
  const relIdx = RELATION_TYPES.indexOf(edge.relation as typeof RELATION_TYPES[number]);
  if (relIdx >= 0) features[8 + relIdx] = 1.0;

  // 13: is_proposed (hypothetical edges have low strength or analogy signal)
  features[13] = edge.signal_type === 'analogy' || edge.strength < 0.2 ? 1.0 : 0.0;

  return features;
}
