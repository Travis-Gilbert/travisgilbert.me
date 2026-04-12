'use client';

import { useEffect, useRef } from 'react';
import type { StageEvent } from '@/lib/theseus-api';
import type { TheseusResponse, EvidencePathSection } from '@/lib/theseus-types';
import type { UseGraphDataReturn } from './useGraphData';

interface EvidenceSubgraphProps {
  askState: string | null;
  response: TheseusResponse | null;
  graphData: UseGraphDataReturn;
}

/**
 * EvidenceSubgraph: listens to askState lifecycle and auto-extracts
 * evidence subgraphs into the Graphology graph.
 *
 * On retrieval_complete: loads evidence neighborhood with 600ms stagger.
 * On objects_loaded: marks focal objects (larger, brighter).
 * On expression_complete: marks cited nodes.
 */
export default function EvidenceSubgraph({
  response,
  graphData,
}: EvidenceSubgraphProps) {
  const loadedForResponseRef = useRef<string | null>(null);
  const staggerTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Cleanup stagger timers on unmount
  useEffect(() => {
    return () => {
      for (const timer of staggerTimersRef.current) clearTimeout(timer);
    };
  }, []);

  // Listen for stage events via window
  useEffect(() => {
    function handler(event: Event) {
      const detail = (event as CustomEvent<{ stage: StageEvent }>).detail;
      if (!detail?.stage) return;
      const stage = detail.stage;

      if (stage.name === 'retrieval_complete') {
        // Collect all object IDs from BM25 and SBERT, ordered by score
        const scored: Array<{ id: string; score: number }> = [];
        for (const hit of stage.bm25_hits ?? []) {
          scored.push({ id: String(hit.object_id), score: hit.score });
        }
        for (const hit of stage.sbert_scores ?? []) {
          const existing = scored.find((s) => s.id === String(hit.object_id));
          if (existing) {
            existing.score += hit.similarity;
          } else {
            scored.push({ id: String(hit.object_id), score: hit.similarity });
          }
        }
        scored.sort((a, b) => b.score - a.score);

        const objectIds = scored.map((s) => s.id);

        if (objectIds.length > 0) {
          // Load data first
          graphData.loadSubgraph(objectIds).then(() => {
            // 600ms stagger animation: initially hide nodes, then reveal
            // 50ms per node, ordered by retrieval score
            for (const timer of staggerTimersRef.current) clearTimeout(timer);
            staggerTimersRef.current = [];

            // Start with all new nodes at size 0, then grow them in
            for (const id of objectIds) {
              if (graphData.graph.hasNode(id)) {
                graphData.graph.setNodeAttribute(id, 'size', 0);
              }
            }

            objectIds.forEach((id, index) => {
              const timer = setTimeout(() => {
                if (graphData.graph.hasNode(id)) {
                  const edgeCount = (graphData.graph.getNodeAttribute(id, 'edge_count') as number) ?? 0;
                  const targetSize = Math.max(4, Math.min(4 + Math.sqrt(edgeCount) * 1.5, 28));
                  graphData.graph.setNodeAttribute(id, 'size', targetSize);
                }
              }, index * 50); // 50ms stagger per node
              staggerTimersRef.current.push(timer);
            });
          });
        }
      }

      if (stage.name === 'objects_loaded') {
        const focalIds = (stage.focal_object_ids ?? []).map(String);
        for (const id of focalIds) {
          if (graphData.graph.hasNode(id)) {
            graphData.graph.setNodeAttribute(id, 'size', 18);
            graphData.graph.setNodeAttribute(id, 'highlighted', true);
          }
        }
      }
    }

    window.addEventListener('theseus:stage-event', handler);
    return () => window.removeEventListener('theseus:stage-event', handler);
  }, [graphData]);

  // On expression_complete (final response), mark cited nodes
  useEffect(() => {
    if (!response || loadedForResponseRef.current === response.query) return;
    loadedForResponseRef.current = response.query;

    const evidenceSections = response.sections.filter(
      (s): s is EvidencePathSection => s.type === 'evidence_path',
    );

    for (const section of evidenceSections) {
      for (const node of section.nodes) {
        const id = String(node.object_id);
        if (graphData.graph.hasNode(id)) {
          graphData.graph.setNodeAttribute(id, 'cited', true);
        }
      }
    }
  }, [response, graphData]);

  return null;
}
