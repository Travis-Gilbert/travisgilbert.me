'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useExplorerSelection } from './useExplorerSelection';
import type { HighlightMode } from './useExplorerSelection';
import { useGalaxy } from '@/components/theseus/TheseusShell';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useGraphData } from './useGraphData';
import { useInvestigationView } from './useInvestigationView';
import type { InvestigationView } from '@/lib/theseus-types';
import type { StageEvent } from '@/lib/theseus-api';
import StructurePanel from './StructurePanel';
import ContextPanel from './ContextPanel';
import ControlDock from './ControlDock';
import StatusStrip from './StatusStrip';
import AnswerReadingPanel from './AnswerReadingPanel';
import ExplorerCanvas from './ExplorerCanvas';
import ExplorerSearch from './ExplorerSearch';
import EvidenceSubgraph from './EvidenceSubgraph';
import PathOverlay from './PathOverlay';

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
  const graphDataHook = useGraphData();

  // Active exploration state (triggers crossfade from IdleGraph to GraphRenderer)
  const [activeExploration, setActiveExploration] = useState(false);
  // Search overlay
  const [searchOpen, setSearchOpen] = useState(false);
  // Secondary node selection for path tracing
  const [secondarySelectedId, setSecondarySelectedId] = useState<string | null>(null);
  // Highlighted node IDs (from evidence paths, focus events, etc.)
  const [highlightedNodeIds, setHighlightedNodeIds] = useState<Set<string>>(new Set());
  // Retrieval object IDs for reasoning trace view
  const [retrievalObjectIds, setRetrievalObjectIds] = useState<Set<string>>(new Set());
  // Type filter from StructurePanel
  const [typeFilter, setTypeFilter] = useState<string | null>(null);

  // Investigation view lens (Phase 2)
  const investigationView = useInvestigationView(
    graphDataHook.graph,
    response,
    retrievalObjectIds,
  );

  // Compute visible nodes: combine view lens + type filter
  const effectiveVisibleNodes = (() => {
    const viewNodes = investigationView.projection.visibleNodes;
    if (!typeFilter) return viewNodes;
    // Intersect with type filter
    const filtered = new Set<string>();
    graphDataHook.graph.forEachNode((node, attrs) => {
      if (attrs.object_type === typeFilter && viewNodes.has(node)) {
        filtered.add(node);
      }
    });
    return filtered;
  })();
  // SSE stage event capture for "Why" tab and pipeline viz
  const [lastStageEvent, setLastStageEvent] = useState<StageEvent | null>(null);
  const [retrievalData, setRetrievalData] = useState<StageEvent | null>(null);
  // Pipeline status text
  const [pipelineStatus, setPipelineStatus] = useState<string>('');

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

  // Determine if graph renderer should show (active exploration, search done, or answer active)
  const showGraphRenderer = activeExploration || answerActive;

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
    // Clear secondary selection when primary changes
    if (!nodeId) {
      setSecondarySelectedId(null);
    }
  }, [explorer, onNodeSelect]);

  // Search overlay: select result loads neighborhood
  const handleSearchSelect = useCallback(async (objectId: string) => {
    setActiveExploration(true);
    await graphDataHook.loadNeighborhood(objectId, 2);
    handleNodeSelect(objectId);
  }, [graphDataHook, handleNodeSelect]);

  // Keyboard: "/" opens search, Escape cascades
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // "/" opens search (unless already typing in an input)
      if (e.key === '/' && !searchOpen && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        setSearchOpen(true);
        return;
      }

      if (e.key === 'Escape') {
        if (searchOpen) {
          setSearchOpen(false);
        } else if (secondarySelectedId) {
          setSecondarySelectedId(null);
        } else if (drilldownId) {
          setDrilldownId(null);
        } else if (mobileOverlayOpen) {
          setMobileOverlayOpen(false);
        } else if (explorer.selectedNodeId) {
          handleNodeSelect(null);
        } else if (explorer.structurePanelOpen) {
          explorer.toggleStructurePanel();
        }
      }

      // Shift-click support handled in GraphRenderer events
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [explorer, handleNodeSelect, drilldownId, mobileOverlayOpen, searchOpen, secondarySelectedId]);

  // Global node select event from graph renderers
  useEffect(() => {
    function handler(event: Event) {
      const detail = (event as CustomEvent<{ nodeId: string | null }>).detail;
      if (detail) handleNodeSelect(detail.nodeId);
    }
    window.addEventListener('explorer:select-node', handler);
    return () => window.removeEventListener('explorer:select-node', handler);
  }, [handleNodeSelect]);

  // Focus nodes event (from StructurePanel, AnswerReadingPanel, etc.)
  useEffect(() => {
    function handler(event: Event) {
      const detail = (event as CustomEvent<{ nodeIds: string[] }>).detail;
      if (detail?.nodeIds?.length) {
        setHighlightedNodeIds(new Set(detail.nodeIds));
        setActiveExploration(true);
        graphDataHook.loadSubgraph(detail.nodeIds);
      }
    }
    window.addEventListener('explorer:focus-nodes', handler);
    return () => window.removeEventListener('explorer:focus-nodes', handler);
  }, [graphDataHook]);

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

  // Capture SSE stage events for pipeline visualization and "Why" tab
  useEffect(() => {
    function handler(event: Event) {
      const detail = (event as CustomEvent<{ stage: StageEvent }>).detail;
      if (!detail?.stage) return;
      const stage = detail.stage;
      setLastStageEvent(stage);

      // Pipeline status text
      switch (stage.name) {
        case 'pipeline_start':
          setPipelineStatus('Analyzing query...');
          break;
        case 'e4b_classify_start':
          setPipelineStatus('Classifying intent...');
          break;
        case 'e4b_classify_complete':
          setPipelineStatus(`Intent: ${stage.answer_type ?? 'analyzing'}`);
          break;
        case 'retrieval_start':
          setPipelineStatus('Searching...');
          break;
        case 'retrieval_complete': {
          setPipelineStatus(`Found ${stage.evidence_count} evidence nodes`);
          setRetrievalData(stage);
          // Collect retrieval object IDs for reasoning_trace view
          const ids = new Set<string>();
          for (const h of stage.bm25_hits ?? []) ids.add(String(h.object_id));
          for (const h of stage.sbert_scores ?? []) ids.add(String(h.object_id));
          setRetrievalObjectIds(ids);
          break;
        }
        case 'objects_loaded':
          setPipelineStatus(`Loading ${stage.object_count} objects`);
          break;
        case 'expression_start':
          setPipelineStatus('Composing answer...');
          break;
        case 'expression_complete':
          setPipelineStatus('Answer ready');
          break;
      }
    }
    window.addEventListener('theseus:stage-event', handler);
    return () => window.removeEventListener('theseus:stage-event', handler);
  }, []);

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

  // Node/edge count for StatusStrip
  const nodeCount = graphDataHook.graph.order;
  const edgeCount = graphDataHook.graph.size;

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
        onFocusCluster={(clusterId) => {
          setActiveExploration(true);
          graphDataHook.loadNeighborhood(String(clusterId), 1);
        }}
        onFocusType={(objectType) => {
          setTypeFilter(objectType);
        }}
      />

      {/* Graph canvas area */}
      <div className="explorer-graph-area">
        {/* IdleGraph (children) with crossfade */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            opacity: showGraphRenderer ? 0 : 1,
            transition: 'opacity 400ms ease',
            pointerEvents: showGraphRenderer ? 'none' : 'auto',
          }}
        >
          {children}
        </div>

        {/* Active ExplorerCanvas with crossfade (spec section 9) */}
        {showGraphRenderer && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              opacity: showGraphRenderer ? 1 : 0,
              transition: 'opacity 400ms ease',
            }}
          >
            <ExplorerCanvas
              nodes={graphDataHook.explorerNodes}
              edges={graphDataHook.explorerEdges}
              selectedNodeId={explorer.selectedNodeId}
              highlightedNodeIds={highlightedNodeIds}
              activeView={investigationView.activeView}
              askState={askState}
              onSelectNode={handleNodeSelect}
              onHoverNode={() => {}}
            />
          </div>
        )}

        {/* Evidence subgraph auto-extraction (headless) */}
        <EvidenceSubgraph
          askState={askState}
          response={response}
          graphData={graphDataHook}
        />

        {/* Path overlay (when two nodes are selected) */}
        {secondarySelectedId && explorer.selectedNodeId && (
          <PathOverlay
            nodeA={explorer.selectedNodeId}
            nodeB={secondarySelectedId}
            onClear={() => setSecondarySelectedId(null)}
          />
        )}

        {/* Search overlay */}
        <ExplorerSearch
          isOpen={searchOpen}
          onClose={() => setSearchOpen(false)}
          onSelect={handleSearchSelect}
        />

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
            investigationView.setActiveView('all');
            setTypeFilter(null);
            setHighlightedNodeIds(new Set());
          }}
          answerActive={answerActive && !isMobile}
          hidden={isMobile && mobileOverlayOpen}
          activeView={investigationView.activeView}
          onSetActiveView={investigationView.setActiveView}
          onOpenSearch={() => setSearchOpen(true)}
          secondarySelectedId={secondarySelectedId}
          onShowPath={() => {/* Path is auto-loaded by PathOverlay when both nodes selected */}}
          hasAnswer={answerActive}
          response={response}
          graph={graphDataHook.graph}
        />

        {/* Status strip */}
        <StatusStrip
          highlightMode={explorer.highlightMode}
          selectedNodeId={explorer.selectedNodeId}
          vizMode={explorer.vizMode}
          activeView={investigationView.activeView}
          nodeCount={nodeCount}
          edgeCount={edgeCount}
          pipelineStatus={pipelineStatus}
          loading={graphDataHook.loading}
          hasAnswer={answerActive}
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

          {/* Reading panel: z-index ensures it sits above the dot grid canvas */}
          <div
            style={{
              width: panelWidth,
              flexShrink: 0,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              position: 'relative',
              zIndex: 15,
              background: 'var(--vie-panel-bg)',
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
        retrievalData={retrievalData}
      />
    </div>
  );
}
