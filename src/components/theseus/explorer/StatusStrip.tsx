'use client';

import type { HighlightMode } from './useExplorerSelection';

interface StatusStripProps {
  highlightMode: HighlightMode;
  selectedNodeId: string | null;
  vizMode: string;
}

function highlightLabel(mode: HighlightMode): string {
  switch (mode) {
    case 'reasoning': return 'Reasoning paths';
    case 'contradictions': return 'Contradictions';
    case 'provenance': return 'Source provenance';
    case 'recent': return 'Recently added';
    default: return '';
  }
}

/**
 * StatusStrip: thin bar at the bottom of the graph canvas.
 *
 * Shows current filter description, active highlight mode,
 * and visualization mode. Keeps the user oriented.
 */
export default function StatusStrip({
  highlightMode,
  selectedNodeId,
  vizMode,
}: StatusStripProps) {
  const highlight = highlightLabel(highlightMode);

  return (
    <div className="explorer-status-strip" data-interactive>
      <span className="explorer-status-item">
        {vizMode}
      </span>

      {highlight && (
        <>
          <span className="explorer-status-sep" aria-hidden="true">/</span>
          <span className="explorer-status-item explorer-status-highlight">
            {highlight}
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
    </div>
  );
}
