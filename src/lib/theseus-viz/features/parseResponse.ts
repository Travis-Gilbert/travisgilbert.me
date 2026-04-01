/* Shared response section parsing (used by RuleEngine and ModelManager) */

import type {
  TheseusResponse, EvidenceNode, EvidenceEdge,
  EvidencePathSection, TensionSection, HypothesisSection,
  ClusterContextSection,
} from '@/lib/theseus-types';

export interface ParsedSections {
  evidencePaths: EvidencePathSection[];
  tensions: TensionSection[];
  hypotheses: HypothesisSection[];
  clusters: ClusterContextSection[];
  allNodes: EvidenceNode[];
  allEdges: EvidenceEdge[];
}

export function parseResponseSections(response: TheseusResponse): ParsedSections {
  const evidencePaths = response.sections.filter(
    (s): s is EvidencePathSection => s.type === 'evidence_path',
  );
  const tensions = response.sections.filter(
    (s): s is TensionSection => s.type === 'tension',
  );
  const hypotheses = response.sections.filter(
    (s): s is HypothesisSection => s.type === 'hypothesis',
  );
  const clusters = response.sections.filter(
    (s): s is ClusterContextSection => s.type === 'cluster_context',
  );

  const allNodes: EvidenceNode[] = [];
  const allEdges: EvidenceEdge[] = [];
  const seenIds = new Set<string>();
  for (const path of evidencePaths) {
    for (const nd of path.nodes) {
      if (!seenIds.has(nd.object_id)) {
        seenIds.add(nd.object_id);
        allNodes.push(nd);
      }
    }
    allEdges.push(...path.edges);
  }

  return { evidencePaths, tensions, hypotheses, clusters, allNodes, allEdges };
}
