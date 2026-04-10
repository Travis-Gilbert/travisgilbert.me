'use client';

import Link from 'next/link';
import type { HighlightMode } from './useExplorerSelection';

interface ControlDockProps {
  structurePanelOpen: boolean;
  onToggleStructure: () => void;
  highlightMode: HighlightMode;
  onSetHighlightMode: (mode: HighlightMode) => void;
  vizMode: 'force' | 'face' | 'cluster';
  onSetVizMode: (mode: 'force' | 'face' | 'cluster') => void;
  onResetView: () => void;
}

function StructureIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" strokeWidth="1.5" aria-hidden="true">
      <path d="M3 7H21M3 12H21M3 17H21" stroke="currentColor" strokeLinecap="round" />
    </svg>
  );
}

function ZoomResetIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" strokeWidth="1.5" aria-hidden="true">
      <path d="M21 3H15M21 3V9M21 3L14 10" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 21H9M3 21V15M3 21L10 14" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const HIGHLIGHT_OPTIONS: { mode: HighlightMode; label: string }[] = [
  { mode: 'none', label: 'Off' },
  { mode: 'reasoning', label: 'Reasoning' },
  { mode: 'contradictions', label: 'Tensions' },
  { mode: 'provenance', label: 'Sources' },
  { mode: 'recent', label: 'Recent' },
];

const VIZ_OPTIONS: { mode: 'force' | 'face' | 'cluster'; label: string }[] = [
  { mode: 'face', label: 'Face' },
  { mode: 'force', label: 'Force' },
  { mode: 'cluster', label: 'Clusters' },
];

/**
 * ControlDock: compact floating controls on the graph canvas.
 *
 * Positioned bottom-right of the graph area. Contains:
 * - Structure panel toggle
 * - Reset view button
 * - Highlight mode selector
 * - Visualization mode selector
 */
export default function ControlDock({
  structurePanelOpen,
  onToggleStructure,
  highlightMode,
  onSetHighlightMode,
  vizMode,
  onSetVizMode,
  onResetView,
}: ControlDockProps) {
  return (
    <div className="explorer-control-dock" data-interactive>
      {/* Row 1: Structure toggle + Reset */}
      <div className="explorer-dock-row">
        <button
          type="button"
          className={`explorer-dock-btn${structurePanelOpen ? ' is-active' : ''}`}
          onClick={onToggleStructure}
          aria-label="Toggle structure panel"
          aria-pressed={structurePanelOpen}
          title="Structure panel"
        >
          <StructureIcon />
        </button>
        <button
          type="button"
          className="explorer-dock-btn"
          onClick={onResetView}
          aria-label="Reset view"
          title="Reset view"
        >
          <ZoomResetIcon />
        </button>
      </div>

      {/* Row 2: Highlight mode */}
      <div className="explorer-dock-row explorer-dock-pills">
        <span className="explorer-dock-label">Highlight</span>
        {HIGHLIGHT_OPTIONS.map((opt) => (
          <button
            key={opt.mode}
            type="button"
            className={`explorer-dock-pill${highlightMode === opt.mode ? ' is-active' : ''}`}
            onClick={() => onSetHighlightMode(opt.mode)}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Row 3: Viz mode */}
      <div className="explorer-dock-row explorer-dock-pills">
        <span className="explorer-dock-label">View</span>
        {VIZ_OPTIONS.map((opt) => (
          <button
            key={opt.mode}
            type="button"
            className={`explorer-dock-pill${vizMode === opt.mode ? ' is-active' : ''}`}
            onClick={() => onSetVizMode(opt.mode)}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Row 4: Navigation shortcuts */}
      <div className="explorer-dock-row explorer-dock-pills">
        <Link href="/theseus" className="explorer-dock-pill">Ask</Link>
        <Link href="/theseus/library" className="explorer-dock-pill">Library</Link>
        <Link href="/theseus/artifacts" className="explorer-dock-pill">Artifacts</Link>
        <Link href="/theseus/truth-maps" className="explorer-dock-pill">Maps</Link>
      </div>
    </div>
  );
}
