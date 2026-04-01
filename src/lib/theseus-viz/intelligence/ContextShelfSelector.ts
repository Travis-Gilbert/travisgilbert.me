/* SPEC-VIE-3 v3: Job 3, Context shelf selection */

import type { EvidenceNode } from '@/lib/theseus-types';
import type { ContextShelfDirective, ContextAnchor } from '../SceneDirective';
import type { DataShape } from '../SceneSpec';

export interface LearnedShelfOutputs {
  /** Per-node shelf_score (relevance to data) */
  perNode: number[];
}

const MAX_ANCHORS = 6;

export function selectContextShelf(
  nodes: EvidenceNode[],
  dataShape: DataShape | null,
  is3D: boolean,
  learned?: LearnedShelfOutputs,
): ContextShelfDirective {
  if (!dataShape || nodes.length === 0) {
    return { enabled: false, anchor_nodes: [], shelf_position: is3D ? 'left' : 'top' };
  }

  let anchors: ContextAnchor[];

  if (learned) {
    anchors = learnedAnchors(nodes, learned);
  } else {
    anchors = ruleBasedAnchors(nodes, dataShape);
  }

  return {
    enabled: true,
    anchor_nodes: anchors.slice(0, MAX_ANCHORS),
    shelf_position: is3D ? 'left' : 'top',
  };
}

function ruleBasedAnchors(
  nodes: EvidenceNode[],
  dataShape: DataShape,
): ContextAnchor[] {
  // Select top 6 nodes by gradual_strength that are NOT hypothesis nodes
  const columnNames = new Set(dataShape.columns.map(c => c.name.toLowerCase()));

  return nodes
    .filter(nd => nd.epistemic_role !== 'hypothetical')
    .sort((a, b) => b.gradual_strength - a.gradual_strength)
    .slice(0, MAX_ANCHORS)
    .map(nd => {
      // Estimate relevance: check if node claims mention data column terms
      const claimText = nd.claims.join(' ').toLowerCase();
      let matchCount = 0;
      for (const col of columnNames) {
        if (claimText.includes(col)) matchCount++;
      }
      const relevance = columnNames.size > 0
        ? Math.min(1, matchCount / columnNames.size + nd.gradual_strength * 0.5)
        : nd.gradual_strength;

      return {
        node_id: nd.object_id,
        relevance_to_data: relevance,
        anchor_label: nd.title.slice(0, 40),
      };
    })
    .sort((a, b) => b.relevance_to_data - a.relevance_to_data);
}

function learnedAnchors(
  nodes: EvidenceNode[],
  learned: LearnedShelfOutputs,
): ContextAnchor[] {
  return nodes
    .map((nd, i) => ({
      node_id: nd.object_id,
      relevance_to_data: learned.perNode[i] || 0,
      anchor_label: nd.title.slice(0, 40),
    }))
    .sort((a, b) => b.relevance_to_data - a.relevance_to_data)
    .slice(0, MAX_ANCHORS);
}
