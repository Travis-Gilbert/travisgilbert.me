/* SPEC-VIE-3 v3: Job 7, Topology interpretation */

import type { EvidenceNode, EvidenceEdge } from '@/lib/theseus-types';
import type { TopologyInterpretation, TopologyShape } from '../SceneDirective';
import { TOPOLOGY_SHAPES } from '../SceneDirective';
import { extractGraphFeatures, getTopologyType } from '../features/GraphFeatures';

export interface LearnedTopologyOutputs {
  /** Softmax over 9 topology shapes */
  logits: Float32Array;
}

export function interpretTopology(
  nodes: EvidenceNode[],
  edges: EvidenceEdge[],
  tensionCount: number,
  hypothesisCount: number,
  learned?: LearnedTopologyOutputs,
): TopologyInterpretation {
  if (learned) {
    return learnedTopology(learned);
  }
  return ruleBasedTopology(nodes, edges, tensionCount, hypothesisCount);
}

function ruleBasedTopology(
  nodes: EvidenceNode[],
  edges: EvidenceEdge[],
  tensionCount: number,
  hypothesisCount: number,
): TopologyInterpretation {
  const features = extractGraphFeatures(nodes, edges, tensionCount, hypothesisCount);
  const primaryShape = getTopologyType(features, nodes, edges);

  // For mixed topologies, try to find secondary shapes
  const secondaryShapes: TopologyShape[] = [];
  const n = nodes.length;
  const density = features[2];
  const hasHub = features[6] === 1.0;
  const componentCount = Math.round(1 / Math.max(0.01, features[8]));

  // Check for secondary characteristics
  if (primaryShape !== 'bipartite_tension' && tensionCount > 0) {
    secondaryShapes.push('bipartite_tension');
  }
  if (primaryShape !== 'star' && hasHub) {
    secondaryShapes.push('star');
  }
  if (primaryShape !== 'dense_cluster' && density > 0.3) {
    secondaryShapes.push('dense_cluster');
  }
  if (primaryShape !== 'multi_cluster' && componentCount > 1) {
    secondaryShapes.push('multi_cluster');
  }

  const confidence = secondaryShapes.length === 0 ? 0.9 : 0.6;

  return {
    primary_shape: primaryShape,
    secondary_shapes: secondaryShapes,
    shape_confidence: confidence,
    description: buildDescription(primaryShape, secondaryShapes, confidence),
  };
}

function learnedTopology(learned: LearnedTopologyOutputs): TopologyInterpretation {
  // Apply softmax to get probabilities
  const logits = learned.logits;
  const maxLogit = Math.max(...Array.from(logits));
  const exps = new Float32Array(logits.length);
  let sumExp = 0;
  for (let i = 0; i < logits.length; i++) {
    exps[i] = Math.exp(logits[i] - maxLogit);
    sumExp += exps[i];
  }
  const probs = new Float32Array(logits.length);
  for (let i = 0; i < logits.length; i++) {
    probs[i] = exps[i] / sumExp;
  }

  // Find top 2
  const indexed = Array.from(probs).map((p, i) => ({ p, i }));
  indexed.sort((a, b) => b.p - a.p);

  const primaryShape = TOPOLOGY_SHAPES[indexed[0].i];
  const secondaryShapes: TopologyShape[] = [];
  if (indexed.length > 1 && indexed[1].p > 0.15) {
    secondaryShapes.push(TOPOLOGY_SHAPES[indexed[1].i]);
  }

  const confidence = indexed[0].p;

  return {
    primary_shape: primaryShape,
    secondary_shapes: secondaryShapes,
    shape_confidence: confidence,
    description: buildDescription(primaryShape, secondaryShapes, confidence),
  };
}

function buildDescription(
  primary: TopologyShape,
  secondary: TopologyShape[],
  confidence: number,
): string {
  const primaryLabel = primary.replace(/_/g, ' ');
  if (secondary.length === 0) {
    return `${capitalize(primaryLabel)} (${(confidence * 100).toFixed(0)}% confidence)`;
  }
  const secondaryLabels = secondary.map(s => s.replace(/_/g, ' ')).join(', ');
  return `Primarily ${primaryLabel} (${(confidence * 100).toFixed(0)}%) with ${secondaryLabels} characteristics`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
