'use client';

import type { HighlightMode } from './useExplorerSelection';

interface ControlDockProps {
  structurePanelOpen: boolean;
  onToggleStructure: () => void;
  highlightMode: HighlightMode;
  onSetHighlightMode: (mode: HighlightMode) => void;
  vizMode: 'force' | 'face' | 'cluster';
  onSetVizMode: (mode: 'force' | 'face' | 'cluster') => void;
  onResetView: () => void;
  /** When true, dock repositions to top-left (split pane active). */
  answerActive?: boolean;
  /** When true on mobile, dock is hidden (reading panel overlay visible). */
  hidden?: boolean;
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
];

const VIZ_OPTIONS: { mode: 'force' | 'face' | 'cluster'; label: string }[] = [
  { mode: 'face', label: 'Graph' },
  { mode: 'force', label: 'Force' },
  { mode: 'cluster', label: 'Clusters' },
];

function DockDivider() {
  return (
    <div
      style={{
        width: 1,
        height: 16,
        background: 'var(--vie-border)',
        margin: '0 4px',
        flexShrink: 0,
      }}
    />
  );
}

export default function ControlDock({
  structurePanelOpen,
  onToggleStructure,
  highlightMode,
  onSetHighlightMode,
  vizMode,
  onSetVizMode,
  onResetView,
  answerActive = false,
  hidden = false,
}: ControlDockProps) {
  if (hidden) return null;

  return (
    <div
      className="explorer-control-dock"
      data-interactive
      data-answer-active={answerActive || undefined}
    >
      <div className="explorer-dock-row">
        {/* Structure toggle */}
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

        {/* Reset view */}
        <button
          type="button"
          className="explorer-dock-btn"
          onClick={onResetView}
          aria-label="Reset view"
          title="Reset view"
        >
          <ZoomResetIcon />
        </button>

        <DockDivider />

        {/* View mode pills */}
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

        <DockDivider />

        {/* Highlight mode pills */}
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
    </div>
  );
}
