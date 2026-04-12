'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useExplorerSelection } from './useExplorerSelection';
import type { HighlightMode } from './useExplorerSelection';
import { useGalaxy } from '@/components/theseus/TheseusShell';
import { useIsMobile } from '@/hooks/useIsMobile';
import StructurePanel from './StructurePanel';
import ContextPanel from './ContextPanel';
import ControlDock from './ControlDock';
import StatusStrip from './StatusStrip';
import AnswerReadingPanel from './AnswerReadingPanel';

const DEFAULT_PANEL_WIDTH = 460;
const MIN_PANEL_WIDTH = 340;
const MAX_PANEL_WIDTH = 640;

interface ExplorerLayoutProps {
  children: React.ReactNode;
  onNodeSelect?: (nodeId: string | null) => void;
}

/**
 * ExplorerLayout: progressive reveal container with answer split pane.
 *
 * Idle: graph fills the viewport. Structure panel (left) slides in on demand.
 * Context panel (right) slides in when a node is selected.
 * Answer active: graph left, cream reading panel right (desktop) or
 * full-screen slide-in overlay (mobile <768px).
 */
export default function ExplorerLayout({ children, onNodeSelect }: ExplorerLayoutProps) {
  const explorer = useExplorerSelection();
  const searchParams = useSearchParams();
  const { response, askState } = useGalaxy();
  const isMobile = useIsMobile();

  // Drilldown state
  const [drilldownId, setDrilldownId] = useState<string | null>(null);

  // Resize handle state (desktop only)
  const [panelWidth, setPanelWidth] = useState(DEFAULT_PANEL_WIDTH);
  const [dragging, setDragging] = useState(false);
  const dragStartX = useRef(0);
  const dragStartW = useRef(DEFAULT_PANEL_WIDTH);

  // Mobile overlay visibility
  const [mobileOverlayOpen, setMobileOverlayOpen] = useState(false);

  // Answer is active when we have a response at CONSTRUCTING phase or later
  const answerActive =
    response !== null &&
    (askState === 'CONSTRUCTING' || askState === 'EXPLORING');

  // Open mobile overlay when answer becomes active on mobile
  useEffect(() => {
    if (answerActive && isMobile) {
      setMobileOverlayOpen(true);
    }
  }, [answerActive, isMobile]);

  // Reset drilldown when response changes
  useEffect(() => {
    setDrilldownId(null);
  }, [response]);

  // Read scene params from URL
  useEffect(() => {
    const focusParam = searchParams?.get('focus');
    const highlightParam = searchParams?.get('highlight');

    if (highlightParam) {
      const valid: HighlightMode[] = ['reasoning', 'contradictions', 'provenance', 'recent'];
      if (valid.includes(highlightParam as HighlightMode)) {
        explorer.setHighlightMode(highlightParam as HighlightMode);
      }
    }

    if (focusParam) {
      const ids = focusParam.split(',').filter(Boolean);
      if (ids.length > 0) {
        explorer.selectNode(ids[0]);
        window.dispatchEvent(
          new CustomEvent('explorer:focus-nodes', { detail: { nodeIds: ids } }),
        );
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleNodeSelect = useCallback((nodeId: string | null) => {
    explorer.selectNode(nodeId);
    onNodeSelect?.(nodeId);
  }, [explorer, onNodeSelect]);

  // Escape key: close drilldown, then clear selection, then close structure
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (drilldownId) {
          setDrilldownId(null);
        } else if (mobileOverlayOpen) {
          setMobileOverlayOpen(false);
        } else if (explorer.selectedNodeId) {
          handleNodeSelect(null);
        } else if (explorer.structurePanelOpen) {
          explorer.toggleStructurePanel();
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [explorer, handleNodeSelect, drilldownId, mobileOverlayOpen]);

  // Global node select event from graph renderers
  useEffect(() => {
    function handler(event: Event) {
      const detail = (event as CustomEvent<{ nodeId: string | null }>).detail;
      if (detail) handleNodeSelect(detail.nodeId);
    }
    window.addEventListener('explorer:select-node', handler);
    return () => window.removeEventListener('explorer:select-node', handler);
  }, [handleNodeSelect]);

  // Drilldown event from graph/stipple canvas
  useEffect(() => {
    function handler(event: Event) {
      const detail = (event as CustomEvent<{ nodeId: string }>).detail;
      if (detail?.nodeId) setDrilldownId(detail.nodeId);
    }
    window.addEventListener('explorer:drilldown', handler);
    return () => window.removeEventListener('explorer:drilldown', handler);
  }, []);

  // Dispatch structured_visual regions to stipple canvas when available
  useEffect(() => {
    if (!response?.structured_visual?.regions) return;
    window.dispatchEvent(
      new CustomEvent('explorer:visual-regions', {
        detail: { regions: response.structured_visual.regions },
      }),
    );
  }, [response?.structured_visual?.regions]);

  // Resize drag handlers (desktop)
  const handleResizeDown = useCallback((e: React.MouseEvent) => {
    setDragging(true);
    dragStartX.current = e.clientX;
    dragStartW.current = panelWidth;
  }, [panelWidth]);

  useEffect(() => {
    if (!dragging) return;

    function handleMove(e: MouseEvent) {
      const delta = dragStartX.current - e.clientX;
      const next = Math.max(MIN_PANEL_WIDTH, Math.min(MAX_PANEL_WIDTH, dragStartW.current + delta));
      setPanelWidth(next);
    }

    function handleUp() {
      setDragging(false);
    }

    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
    return () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
    };
  }, [dragging]);

  const contextPanelOpen = explorer.selectedNodeId !== null;

  return (
    <div
      className={[
        'explorer-layout',
        explorer.structurePanelOpen ? 'structure-open' : '',
        contextPanelOpen ? 'context-open' : '',
      ].filter(Boolean).join(' ')}
      style={{
        userSelect: dragging ? 'none' : undefined,
      }}
    >
      {/* Structure panel (left) */}
      <StructurePanel
        isOpen={explorer.structurePanelOpen}
        onClose={explorer.toggleStructurePanel}
      />

      {/* Graph canvas area */}
      <div className="explorer-graph-area">
        {children}

        {/* Control dock */}
        <ControlDock
          structurePanelOpen={explorer.structurePanelOpen}
          onToggleStructure={explorer.toggleStructurePanel}
          highlightMode={explorer.highlightMode}
          onSetHighlightMode={explorer.setHighlightMode}
          vizMode={explorer.vizMode}
          onSetVizMode={explorer.setVizMode}
          onResetView={() => {
            handleNodeSelect(null);
            explorer.setHighlightMode('none');
          }}
          answerActive={answerActive && !isMobile}
          hidden={isMobile && mobileOverlayOpen}
        />

        {/* Status strip */}
        <StatusStrip
          highlightMode={explorer.highlightMode}
          selectedNodeId={explorer.selectedNodeId}
          vizMode={explorer.vizMode}
        />
      </div>

      {/* Desktop: split pane with resize handle + reading panel */}
      {answerActive && response && !isMobile && (
        <>
          {/* Resize handle */}
          <div
            role="separator"
            aria-orientation="vertical"
            onMouseDown={handleResizeDown}
            style={{
              width: 6,
              cursor: 'col-resize',
              flexShrink: 0,
              zIndex: 20,
              background: dragging ? 'var(--vie-border-focus)' : 'transparent',
              transition: 'background 0.15s',
              position: 'relative',
            }}
            onMouseEnter={(e) => {
              if (!dragging) e.currentTarget.style.background = 'hsla(25, 5%, 14%, 0.5)';
            }}
            onMouseLeave={(e) => {
              if (!dragging) e.currentTarget.style.background = 'transparent';
            }}
          >
            {/* Centered drag affordance pill */}
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: 2,
                height: 24,
                borderRadius: 1,
                background: dragging ? 'var(--vie-border-focus)' : 'var(--vie-border)',
                opacity: 0.5,
              }}
            />
          </div>

          {/* Reading panel */}
          <div
            style={{
              width: panelWidth,
              flexShrink: 0,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            <AnswerReadingPanel
              response={response}
              drilldownId={drilldownId}
              onDrilldown={setDrilldownId}
              onBack={() => setDrilldownId(null)}
            />
          </div>
        </>
      )}

      {/* Mobile: full-screen slide-in overlay */}
      {answerActive && response && isMobile && (
        <div
          data-interactive
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 50,
            transform: mobileOverlayOpen ? 'translateX(0)' : 'translateX(100%)',
            transition: 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)',
            display: 'flex',
            flexDirection: 'column',
            background: 'var(--vie-panel-bg)',
          }}
        >
          {/* Top bar */}
          <div
            style={{
              height: 44,
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              padding: '0 16px',
              borderBottom: '1px solid var(--vie-panel-border)',
              background: 'var(--vie-panel-bg)',
            }}
          >
            <button
              type="button"
              onClick={() => setMobileOverlayOpen(false)}
              style={{
                background: 'transparent',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                cursor: 'pointer',
                fontFamily: 'var(--vie-font-mono)',
                fontSize: 10.5,
                color: 'var(--vie-ink-3)',
                textTransform: 'uppercase',
                letterSpacing: '0.03em',
                padding: 0,
              }}
            >
              <span style={{ fontSize: 14, lineHeight: 1 }}>&larr;</span>
              Back to visual
            </button>
          </div>

          {/* Reading panel content */}
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <AnswerReadingPanel
              response={response}
              drilldownId={drilldownId}
              onDrilldown={setDrilldownId}
              onBack={() => setDrilldownId(null)}
            />
          </div>
        </div>
      )}

      {/* Context panel (right, node selection) */}
      <ContextPanel
        nodeId={explorer.selectedNodeId}
        onClose={() => handleNodeSelect(null)}
        onSelectNode={handleNodeSelect}
      />
    </div>
  );
}
