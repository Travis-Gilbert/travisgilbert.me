'use client';

import type { HighlightMode } from './useExplorerSelection';
import type { InvestigationView } from '@/lib/theseus-types';

interface StatusStripProps {
  highlightMode: HighlightMode;
  selectedNodeId: string | null;
  vizMode: string;
  activeView?: InvestigationView;
  nodeCount?: number;
  edgeCount?: number;
  pipelineStatus?: string;
  loading?: boolean;
  hasAnswer?: boolean;
}

const VIEW_LABELS: Record<InvestigationView, string> = {
  all: 'All',
  evidence: 'Evidence',
  claim_tension: 'Tensions',
  entity_network: 'Entities',
  reasoning_trace: 'Reasoning',
  provenance: 'Sources',
};

/**
 * StatusStrip: thin bar at the bottom of the graph canvas.
 *
 * Shows current view, active filter, node/edge counts,
 * pipeline stage, and selected node.
 */
export default function StatusStrip({
  highlightMode,
  selectedNodeId,
  activeView = 'all',
  nodeCount = 0,
  edgeCount = 0,
  pipelineStatus,
  loading,
  hasAnswer = false,
}: StatusStripProps) {
  const viewLabel = VIEW_LABELS[activeView];

  // Empty state for evidence/reasoning views without active answer
  const needsAnswerMessage =
    !hasAnswer && (activeView === 'evidence' || activeView === 'reasoning_trace')
      ? 'Ask a question to see evidence / reasoning trace'
      : null;

  return (
    <div className="explorer-status-strip" data-interactive>
      <span className="explorer-status-item">
        {viewLabel}
      </span>

      {needsAnswerMessage && (
        <>
          <span className="explorer-status-sep" aria-hidden="true">/</span>
          <span className="explorer-status-item explorer-status-pipeline">
            {needsAnswerMessage}
          </span>
        </>
      )}

      {nodeCount > 0 && (
        <>
          <span className="explorer-status-sep" aria-hidden="true">/</span>
          <span className="explorer-status-item">
            {nodeCount} nodes, {edgeCount} edges
          </span>
        </>
      )}

      {highlightMode !== 'none' && (
        <>
          <span className="explorer-status-sep" aria-hidden="true">/</span>
          <span className="explorer-status-item explorer-status-highlight">
            {highlightMode}
          </span>
        </>
      )}

      {selectedNodeId && (
        <>
          <span className="explorer-status-sep" aria-hidden="true">/</span>
          <span className="explorer-status-item">
            node {selectedNodeId}
          </span>
        </>
      )}

      {pipelineStatus && (
        <>
          <span className="explorer-status-sep" aria-hidden="true">/</span>
          <span
            className="explorer-status-item explorer-status-pipeline"
            style={{ transition: 'opacity 200ms ease' }}
          >
            {pipelineStatus}
          </span>
        </>
      )}

      {loading && (
        <>
          <span className="explorer-status-sep" aria-hidden="true">/</span>
          <span className="explorer-status-item">loading</span>
        </>
      )}
    </div>
  );
}
