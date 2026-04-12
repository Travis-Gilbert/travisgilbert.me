'use client';

import type { StageEvent } from '@/lib/theseus-api';

interface WhyThisNodeProps {
  nodeId: string;
  retrievalData: StageEvent | null;
}

/**
 * WhyThisNode: explains why a node appears in the graph.
 *
 * Shows retrieval signal breakdown: BM25, SBERT, PageRank, community.
 * Data comes from the retrieval_complete SSE StageEvent.
 */
export default function WhyThisNode({ nodeId, retrievalData }: WhyThisNodeProps) {
  if (!retrievalData || retrievalData.name !== 'retrieval_complete') {
    return (
      <div className="explorer-why-empty">
        <p className="explorer-panel-empty">
          This node was not retrieved for the current query.
          It appears in the graph via neighborhood expansion or manual search.
        </p>
      </div>
    );
  }

  const rd = retrievalData as Extract<StageEvent, { name: 'retrieval_complete' }>;
  const bm25Hit = rd.bm25_hits?.find((h) => String(h.object_id) === nodeId);
  const sbertHit = rd.sbert_scores?.find((h) => String(h.object_id) === nodeId);
  const pprScore = rd.pagerank_scores?.[nodeId];
  const community = rd.community_assignments?.[nodeId];

  const signals: Array<{ label: string; value: string }> = [];
  if (bm25Hit) signals.push({ label: 'BM25 score', value: bm25Hit.score.toFixed(3) });
  if (sbertHit) signals.push({ label: 'SBERT similarity', value: sbertHit.similarity.toFixed(3) });
  if (pprScore !== undefined) signals.push({ label: 'PageRank', value: pprScore.toFixed(4) });
  if (community !== undefined) signals.push({ label: 'Community', value: String(community) });

  if (signals.length === 0) {
    return (
      <div className="explorer-why-empty">
        <p className="explorer-panel-empty">
          This node was not retrieved for the current query.
          It appears in the graph via neighborhood expansion or manual search.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div
        style={{
          fontFamily: 'var(--vie-font-mono, monospace)',
          fontSize: 10.5,
          color: 'var(--vie-ink-3, #7a7670)',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}
      >
        Retrieval signals
      </div>
      {signals.map((signal) => (
        <div
          key={signal.label}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '6px 0',
            borderBottom: '1px solid var(--vie-border, rgba(255,255,255,0.06))',
          }}
        >
          <span
            style={{
              fontSize: 12,
              color: 'var(--vie-ink-2, #b5b0a8)',
              fontFamily: 'var(--vie-font-sans, sans-serif)',
            }}
          >
            {signal.label}
          </span>
          <span
            style={{
              fontSize: 12,
              color: 'var(--vie-teal-ink, #4A8A96)',
              fontFamily: 'var(--vie-font-mono, monospace)',
              fontWeight: 600,
            }}
          >
            {signal.value}
          </span>
        </div>
      ))}
    </div>
  );
}
