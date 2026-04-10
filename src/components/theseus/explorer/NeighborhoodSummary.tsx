'use client';

interface NeighborhoodSummaryProps {
  connectionCount: number;
  claimCount: number;
  tensionCount: number;
  activeTensionCount: number;
  onNavigateTab: (tab: 'evidence' | 'claims' | 'tensions') => void;
  loading?: boolean;
}

/**
 * NeighborhoodSummary: 360-degree overview counts with expand-to-tab behavior.
 *
 * Three clickable count badges that jump to the relevant tab on click.
 * Active tension count is highlighted separately.
 */
export default function NeighborhoodSummary({
  connectionCount,
  claimCount,
  tensionCount,
  activeTensionCount,
  onNavigateTab,
  loading,
}: NeighborhoodSummaryProps) {
  if (loading) {
    return (
      <div className="explorer-neighborhood">
        <span className="explorer-neighborhood-loading">LOADING NEIGHBORHOOD</span>
      </div>
    );
  }

  return (
    <div className="explorer-neighborhood">
      <button
        type="button"
        className="explorer-neighborhood-stat"
        onClick={() => onNavigateTab('evidence')}
      >
        <span className="explorer-neighborhood-count">{connectionCount}</span>
        <span className="explorer-neighborhood-label">
          {connectionCount === 1 ? 'connection' : 'connections'}
        </span>
      </button>

      <button
        type="button"
        className="explorer-neighborhood-stat"
        onClick={() => onNavigateTab('claims')}
      >
        <span className="explorer-neighborhood-count">{claimCount}</span>
        <span className="explorer-neighborhood-label">
          {claimCount === 1 ? 'claim' : 'claims'}
        </span>
      </button>

      <button
        type="button"
        className="explorer-neighborhood-stat"
        onClick={() => onNavigateTab('tensions')}
      >
        <span className="explorer-neighborhood-count">{tensionCount}</span>
        <span className="explorer-neighborhood-label">
          {tensionCount === 1 ? 'tension' : 'tensions'}
          {activeTensionCount > 0 && (
            <span className="explorer-neighborhood-active">
              {` (${activeTensionCount} active)`}
            </span>
          )}
        </span>
      </button>
    </div>
  );
}
