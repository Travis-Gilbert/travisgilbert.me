'use client';

import type { HighlightMode } from './useExplorerSelection';
import type { InvestigationView, TheseusResponse } from '@/lib/theseus-types';
import type Graph from 'graphology';
import ArtifactExporter from './ArtifactExporter';

interface ControlDockProps {
  structurePanelOpen: boolean;
  onToggleStructure: () => void;
  highlightMode: HighlightMode;
  onSetHighlightMode: (mode: HighlightMode) => void;
  vizMode: 'force' | 'face' | 'cluster';
  onSetVizMode: (mode: 'force' | 'face' | 'cluster') => void;
  onResetView: () => void;
  answerActive?: boolean;
  hidden?: boolean;
  activeView?: InvestigationView;
  onSetActiveView?: (view: InvestigationView) => void;
  onOpenSearch?: () => void;
  secondarySelectedId?: string | null;
  onShowPath?: () => void;
  hasAnswer?: boolean;
  response?: TheseusResponse | null;
  graph?: Graph;
  deepFieldVisible?: boolean;
  onToggleDeepField?: () => void;
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

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" strokeWidth="1.5" aria-hidden="true">
      <circle cx="11" cy="11" r="7" stroke="currentColor" />
      <path d="M16 16L20 20" stroke="currentColor" strokeLinecap="round" />
    </svg>
  );
}

const VIEW_OPTIONS: { view: InvestigationView; label: string }[] = [
  { view: 'all', label: 'All' },
  { view: 'evidence', label: 'Evidence' },
  { view: 'claim_tension', label: 'Tensions' },
  { view: 'entity_network', label: 'Entities' },
  { view: 'reasoning_trace', label: 'Reasoning' },
  { view: 'provenance', label: 'Sources' },
];

function DockDivider() {
  return (
    <div
      className="explorer-dock-divider"
    />
  );
}

export default function ControlDock({
  structurePanelOpen,
  onToggleStructure,
  onResetView,
  answerActive = false,
  hidden = false,
  activeView = 'all',
  onSetActiveView,
  onOpenSearch,
  secondarySelectedId,
  onShowPath,
  hasAnswer = false,
  response,
  graph,
  deepFieldVisible = false,
  onToggleDeepField,
}: ControlDockProps) {
  if (hidden) return null;

  const needsAnswer = (view: InvestigationView) =>
    view === 'evidence' || view === 'reasoning_trace';

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

        {/* Search */}
        <button
          type="button"
          className="explorer-dock-btn"
          onClick={onOpenSearch}
          aria-label="Search objects"
          title="Search (press /)"
        >
          <SearchIcon />
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

        {/* Deep field toggle */}
        {onToggleDeepField && (
          <button
            type="button"
            className={`explorer-dock-btn${deepFieldVisible ? ' is-active' : ''}`}
            onClick={onToggleDeepField}
            aria-label={deepFieldVisible ? 'Hide full graph' : 'Show full graph'}
            aria-pressed={deepFieldVisible}
            title={deepFieldVisible ? 'Hide Theseus graph' : 'Show Theseus graph'}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" strokeWidth="1.5" aria-hidden="true">
              <circle cx="12" cy="12" r="3" stroke="currentColor" />
              <circle cx="12" cy="12" r="8" stroke="currentColor" strokeDasharray="2 3" opacity="0.5" />
              <circle cx="6" cy="6" r="1.5" fill="currentColor" opacity="0.4" />
              <circle cx="18" cy="8" r="1" fill="currentColor" opacity="0.4" />
              <circle cx="7" cy="18" r="1" fill="currentColor" opacity="0.4" />
            </svg>
          </button>
        )}

        <DockDivider />

        {/* View lens pills */}
        {VIEW_OPTIONS.map((opt) => {
          const isActive = activeView === opt.view;
          const waitingForData = needsAnswer(opt.view) && !hasAnswer;

          return (
            <button
              key={opt.view}
              type="button"
              className={`explorer-dock-pill${isActive ? ' is-active' : ''}${waitingForData && isActive ? ' is-waiting' : ''}`}
              onClick={() => onSetActiveView?.(opt.view)}
            >
              {opt.label}
            </button>
          );
        })}

        {/* Show Path button (appears when two nodes are selected) */}
        {secondarySelectedId && (
          <>
            <DockDivider />
            <button
              type="button"
              className="explorer-dock-pill is-active"
              onClick={onShowPath}
            >
              Show Path
            </button>
          </>
        )}

        {/* Artifact exporter (appears when answer is active) */}
        {hasAnswer && response && graph && (
          <>
            <DockDivider />
            <ArtifactExporter
              response={response}
              graph={graph}
              activeView={activeView}
            />
          </>
        )}
      </div>
    </div>
  );
}
