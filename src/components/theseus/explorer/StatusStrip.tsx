'use client';

import type { HighlightMode } from './useExplorerSelection';
import type { InvestigationView } from '@/lib/theseus-types';
import TerminalStream from '@/components/theseus/TerminalStream';
import type { TerminalStreamHandle } from '@/hooks/useTerminalStream';

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
  stream?: TerminalStreamHandle;
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
 * Shows current view, active filter, node/edge counts, and, when provided,
 * a TerminalStream for honest loading status. The legacy plain-text "loading"
 * fallback still renders when no stream handle is passed (e.g. from older
 * call sites that haven't migrated).
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
  stream,
}: StatusStripProps) {
  const viewLabel = VIEW_LABELS[activeView];

  // Empty state for evidence/reasoning views without active answer
  const needsAnswerMessage =
    !hasAnswer && (activeView === 'evidence' || activeView === 'reasoning_trace')
      ? 'Ask a question to see evidence / reasoning trace'
      : null;

  const hasStreamContent =
    stream && (stream.active || stream.completionMs !== null || stream.events.length > 0);

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

      {pipelineStatus && !hasStreamContent && (
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

      {hasStreamContent && stream && (
        <>
          <span className="explorer-status-sep" aria-hidden="true">/</span>
          <span className="explorer-status-item" style={{ position: 'relative' }}>
            <TerminalStream
              events={stream.events}
              active={stream.active}
              completionMs={stream.completionMs}
              variant="inline"
              label="graph ready"
            />
          </span>
        </>
      )}

      {loading && !hasStreamContent && (
        <>
          <span className="explorer-status-sep" aria-hidden="true">/</span>
          <span className="explorer-status-item">loading</span>
        </>
      )}
    </div>
  );
}
