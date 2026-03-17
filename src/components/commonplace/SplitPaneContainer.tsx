'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import type {
  PaneNode,
  SplitDirection,
  LeafPane,
  SplitPane,
} from '@/lib/commonplace-layout';
import {
  LAYOUT_PRESETS,
  KEY_BINDINGS,
  splitLeaf,
  closePane,
  updateRatio,
  collectLeafIds,
  findPane,
  findAdjacentLeaf,
  findParentSplit,
  replaceView,
} from '@/lib/commonplace-layout';
import type { ViewType } from '@/lib/commonplace';
import { VIEW_REGISTRY } from '@/lib/commonplace';
import { useCommonPlace } from '@/lib/commonplace-context';
import { useIsAppShellMobile } from '@/hooks/useIsAppShellMobile';
import MobileTopBar from '@/components/mobile-shell/MobileTopBar';
import MobileTabs from '@/components/mobile-shell/MobileTabs';
import MobileSheet from '@/components/mobile-shell/MobileSheet';
import DragHandle from './DragHandle';
import LayoutPresetSelector from './LayoutPresetSelector';
import ScreenRouter from './ScreenRouter';
import PaneHeader from './PaneHeader';
import GridView from './GridView';
import TimelineView from './TimelineView';
import NetworkView from './NetworkView';
import ObjectDetailView from './ObjectDetailView';
import ResurfaceView from './ResurfaceView';
import NotebookWorkspace from './NotebookWorkspace';
import ProjectView from './ProjectView';
import NotebookListView from './NotebookListView';
import ProjectListView from './ProjectListView';
import CalendarView from './CalendarView';
import LooseEndsView from './LooseEndsView';
import ComposeView from './ComposeView';
import LibraryView from './LibraryView';
import ModelView from './ModelView';
import NotebookFormationView from './NotebookFormationView';
import PromotionQueueView from './PromotionQueueView';
import EntityPromotionView from './EntityPromotionView';
import EmergentTypeSuggestionsView from './EmergentTypeSuggestionsView';
import ArtifactBrowserView from './ArtifactBrowserView';
import TemporalEvolutionView from './TemporalEvolutionView';

/* =============================================
   Main container: consumes layout from context,
   renders screen router or pane workspace.
   ============================================= */

export default function SplitPaneContainer() {
  const {
    activeScreen,
    layout,
    setLayout,
    focusedPaneId,
    setFocusedPaneId,
    fullscreenPaneId,
    toggleFullscreen,
    exitFullscreen,
    toggleMobileSidebar,
    openMobileSidebar,
    setSidebarCollapsed,
  } = useCommonPlace();
  const isMobile = useIsAppShellMobile();

  const [mobileLeafIndex, setMobileLeafIndex] = useState(0);
  const [mobileObjectSheet, setMobileObjectSheet] = useState<{
    objectRef: number;
    title?: string;
  } | null>(null);
  const [activePresetName, setActivePresetName] = useState<string | null>(
    LAYOUT_PRESETS[0].name,
  );

  /* ── Layout mutations (all immutable) ── */

  const handleSplit = useCallback(
    (paneId: string, direction: SplitDirection) => {
      setLayout((prev: PaneNode) => splitLeaf(prev, paneId, direction));
      setActivePresetName(null);
    },
    [setLayout],
  );

  const handleClosePane = useCallback(
    (paneId: string) => {
      setLayout((prev: PaneNode) => closePane(prev, paneId));
      setActivePresetName(null);
    },
    [setLayout],
  );

  const handleResize = useCallback(
    (splitId: string, ratio: number) => {
      setLayout((prev: PaneNode) => updateRatio(prev, splitId, ratio));
      setActivePresetName(null);
    },
    [setLayout],
  );

  /** Open an object detail in an adjacent pane (auto-splits if single pane) */
  const handleOpenObject = useCallback(
    (fromPaneId: string, objectRef: number, title?: string) => {
      if (isMobile) {
        setMobileObjectSheet({ objectRef, title });
        return;
      }

      setLayout((prev: PaneNode) => {
        let tree = prev;
        let targetPaneId = findAdjacentLeaf(tree, fromPaneId);

        /* If there is only one pane, auto-split to create a second */
        if (!targetPaneId) {
          tree = splitLeaf(tree, fromPaneId, 'horizontal');
          targetPaneId = findAdjacentLeaf(tree, fromPaneId);
          if (!targetPaneId) return prev;
        }

        return replaceView(tree, targetPaneId, 'object-detail', { objectRef });
      });
      setActivePresetName(null);
    },
    [isMobile, setLayout],
  );

  const handlePreset = useCallback(
    (presetIndex: number) => {
      if (presetIndex >= 0 && presetIndex < LAYOUT_PRESETS.length) {
        setLayout(LAYOUT_PRESETS[presetIndex].tree);
        setFocusedPaneId(null);
        setActivePresetName(LAYOUT_PRESETS[presetIndex].name);
      }
    },
    [setLayout, setFocusedPaneId],
  );

  /* ── Keyboard shortcuts ── */

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      /* Escape exits fullscreen */
      if (e.key === 'Escape' && fullscreenPaneId) {
        e.preventDefault();
        exitFullscreen();
        return;
      }

      for (const binding of KEY_BINDINGS) {
        const ctrlMatch = binding.ctrl ? e.ctrlKey || e.metaKey : true;
        const shiftMatch = binding.shift ? e.shiftKey : !e.shiftKey;
        const altMatch = binding.alt ? e.altKey : !e.altKey;

        if (e.key === binding.key && ctrlMatch && shiftMatch && altMatch) {
          e.preventDefault();

          switch (binding.action) {
            case 'split-horizontal':
              if (focusedPaneId) handleSplit(focusedPaneId, 'horizontal');
              break;
            case 'split-vertical':
              if (focusedPaneId) handleSplit(focusedPaneId, 'vertical');
              break;
            case 'close-pane':
              if (focusedPaneId) handleClosePane(focusedPaneId);
              break;
            case 'preset-focus':
              handlePreset(0);
              break;
            case 'preset-research':
              handlePreset(1);
              break;
            case 'preset-studio':
              handlePreset(2);
              break;
            case 'ratio-shrink':
            case 'ratio-grow': {
              if (!focusedPaneId) break;
              const parent = findParentSplit(layout, focusedPaneId);
              if (parent) {
                const delta = binding.action === 'ratio-grow' ? 0.05 : -0.05;
                const newRatio = Math.min(
                  0.85,
                  Math.max(0.15, parent.ratio + delta),
                );
                handleResize(parent.id, newRatio);
              }
              break;
            }
          }
          return;
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    focusedPaneId,
    fullscreenPaneId,
    layout,
    handleSplit,
    handleClosePane,
    handlePreset,
    handleResize,
    exitFullscreen,
  ]);

  /* ── Auto-collapse sidebar when compose view is focused ── */

  const activeLeafViewTypes = collectLeafIds(layout).map((leafId) => {
    const leaf = findPane(layout, leafId);
    if (!leaf || leaf.type !== 'leaf') return 'empty';
    return leaf.viewId ?? 'empty';
  });

  useEffect(() => {
    setSidebarCollapsed(activeLeafViewTypes.includes('compose'));
  }, [activeLeafViewTypes, setSidebarCollapsed]);

  /* ── Screen mode: render ScreenRouter instead of panes ── */

  if (activeScreen && !isMobile) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden', position: 'relative' }}>
        <ScreenRouter screen={activeScreen} />
      </div>
    );
  }

  /* ── Mobile: single pane view ── */

  const leafIds = collectLeafIds(layout);

  if (isMobile) {
    /* On mobile, screens render full-width too */
    if (activeScreen) {
      return (
        <div className="cp-mobile-shell" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <MobileTopBar
            title={activeScreen.charAt(0).toUpperCase() + activeScreen.slice(1)}
            onMenu={toggleMobileSidebar}
            menuAriaLabel="Open CommonPlace navigation drawer"
            className="cp-mobile-top-bar"
            titleClassName="cp-mobile-view-title"
            menuButtonClassName="cp-mobile-top-bar-btn"
            primaryAction={
              <button
                type="button"
                className="cp-mobile-top-bar-btn cp-mobile-capture-btn"
                onClick={openMobileSidebar}
                aria-label="Open capture drawer"
              >
                <CaptureIcon />
                <span>Capture</span>
              </button>
            }
          />
          <div style={{ flex: 1, overflow: 'auto' }}>
            <ScreenRouter screen={activeScreen} />
          </div>
        </div>
      );
    }

    const safeIndex = Math.min(mobileLeafIndex, leafIds.length - 1);
    const activeLeafId = leafIds[safeIndex];
    const activeLeaf = activeLeafId
      ? (findPane(layout, activeLeafId) as LeafPane | null)
      : null;
    const activeViewType = activeLeaf?.viewId ?? 'empty';
    const activeTitle = VIEW_REGISTRY[activeViewType]?.label ?? activeViewType;

    return (
      <div className="cp-mobile-shell" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <MobileTopBar
          title={activeTitle}
          onMenu={toggleMobileSidebar}
          menuAriaLabel="Open CommonPlace navigation drawer"
          className="cp-mobile-top-bar"
          titleClassName="cp-mobile-view-title"
          menuButtonClassName="cp-mobile-top-bar-btn"
          primaryAction={
            <button
              type="button"
              className="cp-mobile-top-bar-btn cp-mobile-capture-btn"
              onClick={openMobileSidebar}
              aria-label="Open capture drawer"
            >
              <CaptureIcon />
              <span>Capture</span>
            </button>
          }
        />

        <div className="cp-mobile-preset-row">
          <LayoutPresetSelector
            activePresetName={activePresetName}
            onSelect={handlePreset}
          />
        </div>

        {/* Active pane content */}
        <div
          className="cp-mobile-pane-scroll cp-scrollbar"
          style={{ flex: 1, overflow: 'auto' }}
        >
          {activeLeaf ? (
            <PaneViewContent
              viewType={activeLeaf.viewId}
              context={activeLeaf.context}
              paneId={activeLeaf.id}
              onOpenObject={handleOpenObject}
            />
          ) : (
            <PaneViewContent viewType="empty" />
          )}
        </div>

        {/* Bottom tab bar */}
        <div className="cp-mobile-only">
          <MobileTabs
            items={leafIds
              .map((id) => {
                const leaf = findPane(layout, id) as LeafPane | null;
                if (!leaf) return null;
                const vt = leaf.viewId ?? 'empty';
                return {
                  key: id,
                  icon: <MobileTabIcon viewType={vt} />,
                  label: VIEW_REGISTRY[vt]?.label ?? vt,
                };
              })
              .filter(Boolean) as Array<{
              key: string;
              icon: ReactNode;
              label: string;
            }>}
            activeKey={activeLeafId ?? ''}
            onChange={(nextLeafId) => {
              const nextIndex = leafIds.findIndex((id) => id === nextLeafId);
              if (nextIndex >= 0) setMobileLeafIndex(nextIndex);
            }}
            ariaLabel="CommonPlace pane tabs"
            containerClassName="cp-mobile-tab-bar"
            itemClassName="cp-mobile-tab"
          />
        </div>

        <MobileSheet
          open={Boolean(mobileObjectSheet)}
          onClose={() => setMobileObjectSheet(null)}
          title={mobileObjectSheet?.title ?? 'Object detail'}
        >
          {mobileObjectSheet && (
            <PaneViewContent
              viewType="object-detail"
              context={{ objectRef: mobileObjectSheet.objectRef }}
              paneId={activeLeafId ?? 'mobile-sheet'}
              onOpenObject={handleOpenObject}
            />
          )}
        </MobileSheet>
      </div>
    );
  }

  /* ── Desktop: fullscreen single pane ── */

  if (fullscreenPaneId) {
    const fsLeaf = findPane(layout, fullscreenPaneId);
    if (fsLeaf && fsLeaf.type === 'leaf') {
      return (
        <FullscreenLeaf
          leaf={fsLeaf}
          leafCount={leafIds.length}
          onSplit={handleSplit}
          onToggleFullscreen={toggleFullscreen}
          onClosePane={handleClosePane}
          onOpenObject={handleOpenObject}
        />
      );
    }
  }

  /* ── Desktop: recursive split pane tree ── */

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
        minHeight: 0,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          flex: 1,
          display: 'flex',
          minWidth: 0,
          minHeight: 0,
          overflow: 'hidden',
        }}
      >
        <RenderNode
          node={layout}
          focusedPaneId={focusedPaneId}
          leafCount={leafIds.length}
          onFocus={setFocusedPaneId}
          onSplit={handleSplit}
          onClosePane={handleClosePane}
          onResize={handleResize}
          onOpenObject={handleOpenObject}
          onToggleFullscreen={toggleFullscreen}
        />
      </div>
    </div>
  );
}

/* =============================================
   Fullscreen leaf: extracted so useState works
   ============================================= */

function FullscreenLeaf({
  leaf,
  leafCount,
  onSplit,
  onToggleFullscreen,
  onClosePane,
  onOpenObject,
}: {
  leaf: LeafPane;
  leafCount: number;
  onSplit: (paneId: string, direction: SplitDirection) => void;
  onToggleFullscreen: (paneId: string) => void;
  onClosePane: (paneId: string) => void;
  onOpenObject: (fromPaneId: string, objectRef: number, title?: string) => void;
}) {
  const [splitPreview, setSplitPreview] = useState<'horizontal' | 'vertical' | null>(null);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
      <PaneHeader
        viewId={leaf.viewId}
        paneId={leaf.id}
        isFocused
        isFullscreen
        leafCount={leafCount}
        onSplitH={() => onSplit(leaf.id, 'horizontal')}
        onSplitV={() => onSplit(leaf.id, 'vertical')}
        onToggleFullscreen={() => onToggleFullscreen(leaf.id)}
        onClose={() => onClosePane(leaf.id)}
        onSplitPreview={setSplitPreview}
      />
      <div style={{ position: 'relative', flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <PaneViewContent
          viewType={leaf.viewId}
          context={leaf.context}
          paneId={leaf.id}
          onOpenObject={onOpenObject}
        />
        {splitPreview && (
          <div className={`cp-split-preview cp-split-preview--${splitPreview}`}>
            <span className="cp-split-preview-label">New pane</span>
          </div>
        )}
      </div>
    </div>
  );
}

/* =============================================
   Recursive node renderer
   ============================================= */

interface NodeProps {
  node: PaneNode;
  focusedPaneId: string | null;
  leafCount: number;
  onFocus: (id: string) => void;
  onSplit: (paneId: string, direction: SplitDirection) => void;
  onClosePane: (paneId: string) => void;
  onResize: (splitId: string, ratio: number) => void;
  onOpenObject: (
    fromPaneId: string,
    objectRef: number,
    title?: string,
  ) => void;
  onToggleFullscreen: (paneId: string) => void;
}

function RenderNode(props: NodeProps) {
  if (props.node.type === 'leaf') {
    return <RenderLeaf {...props} node={props.node} />;
  }
  return <RenderSplit {...props} node={props.node} />;
}

/* =============================================
   Split node: two children + drag handle
   ============================================= */

function RenderSplit(props: NodeProps & { node: SplitPane }) {
  const { node, onResize, ...rest } = props;
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={containerRef}
      className="cp-pane-container"
      data-direction={node.direction}
    >
      <div
        style={{
          flex: node.ratio,
          minWidth: 0,
          minHeight: 0,
          display: 'flex',
        }}
      >
        <RenderNode {...rest} onResize={onResize} node={node.first} />
      </div>

      <DragHandle
        direction={node.direction}
        splitId={node.id}
        onResize={onResize}
        containerRef={containerRef}
      />

      <div
        style={{
          flex: 1 - node.ratio,
          minWidth: 0,
          minHeight: 0,
          display: 'flex',
        }}
      >
        <RenderNode {...rest} onResize={onResize} node={node.second} />
      </div>
    </div>
  );
}

/* =============================================
   Leaf node: header + content
   ============================================= */

function RenderLeaf(props: NodeProps & { node: LeafPane }) {
  const {
    node,
    focusedPaneId,
    leafCount,
    onFocus,
    onSplit,
    onClosePane,
    onOpenObject,
    onToggleFullscreen,
  } = props;
  const isFocused = focusedPaneId === node.id;
  const [splitPreview, setSplitPreview] = useState<'horizontal' | 'vertical' | null>(null);

  return (
    <div
      className="cp-pane"
      style={{
        flex: 1,
        boxShadow: isFocused
          ? 'inset 0 0 0 1px rgba(196, 80, 60, 0.18)'
          : 'none',
        transition: 'box-shadow 150ms',
      }}
      onClick={() => onFocus(node.id)}
    >
      <PaneHeader
        viewId={node.viewId}
        paneId={node.id}
        isFocused={isFocused}
        isFullscreen={false}
        leafCount={leafCount}
        onSplitH={() => onSplit(node.id, 'horizontal')}
        onSplitV={() => onSplit(node.id, 'vertical')}
        onToggleFullscreen={() => onToggleFullscreen(node.id)}
        onClose={() => onClosePane(node.id)}
        onSplitPreview={setSplitPreview}
      />

      {/* Content with canvas dot grid */}
      <div
        style={{
          position: 'relative',
          flex: 1,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <PaneViewContent
          viewType={node.viewId}
          context={node.context}
          paneId={node.id}
          onOpenObject={onOpenObject}
        />
        {splitPreview && (
          <div className={`cp-split-preview cp-split-preview--${splitPreview}`}>
            <span className="cp-split-preview-label">New pane</span>
          </div>
        )}
      </div>
    </div>
  );
}

/* =============================================
   Pane content: dispatches to view components
   ============================================= */

interface PaneViewContentProps {
  viewType: ViewType;
  context?: Record<string, unknown>;
  paneId?: string;
  onOpenObject?: (
    fromPaneId: string,
    objectRef: number,
    title?: string,
  ) => void;
}

function PaneViewContent({
  viewType,
  context,
  paneId,
  onOpenObject,
}: PaneViewContentProps) {
  const view = VIEW_REGISTRY[viewType];

  if (viewType === 'empty') {
    return (
      <div className="cp-pane-empty">
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 8,
              border: '2px dashed var(--cp-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 12px',
              color: 'var(--cp-text-faint)',
              fontSize: 20,
            }}
          >
            +
          </div>
          <div
            style={{
              fontFamily: 'var(--cp-font-mono)',
              fontSize: 11,
              color: 'var(--cp-text-faint)',
              letterSpacing: '0.05em',
            }}
          >
            ADD A VIEW
          </div>
        </div>
      </div>
    );
  }

  /* Grid (masonry object browser) */
  if (viewType === 'grid') {
    return (
      <GridView
        onOpenObject={
          paneId && onOpenObject
            ? (objectRef) => onOpenObject(paneId, objectRef)
            : undefined
        }
      />
    );
  }

  /* Library (clustered object browser) */
  if (viewType === 'library') {
    return (
      <LibraryView
        paneId={paneId}
        onOpenObject={
          paneId && onOpenObject
            ? (objectRef) => onOpenObject(paneId, objectRef)
            : undefined
        }
      />
    );
  }

  /* Timeline */
  if (viewType === 'timeline') {
    return <TimelineView />;
  }

  /* Scoped Timeline (re-uses TimelineView for now) */
  if (viewType === 'scoped-timeline') {
    return <TimelineView />;
  }

  /* Network (Map) */
  if (viewType === 'network') {
    const filterTypes = Array.isArray(context?.filterTypes)
      ? (context?.filterTypes as string[])
      : undefined;
    return (
      <NetworkView
        filterTypes={filterTypes}
        onOpenObject={
          paneId && onOpenObject
            ? (objectId) => onOpenObject(paneId, Number(objectId))
            : undefined
        }
      />
    );
  }

  /* Object Detail */
  if (viewType === 'object-detail' && context?.objectRef) {
    return (
      <ObjectDetailView
        objectRef={context.objectRef as number}
        onOpenObject={
          paneId && onOpenObject
            ? (ref, title) => onOpenObject(paneId, ref, title)
            : undefined
        }
      />
    );
  }

  /* Resurface */
  if (viewType === 'resurface') {
    return (
      <ResurfaceView
        onOpenObject={
          paneId && onOpenObject
            ? (ref, title) => onOpenObject(paneId, ref, title)
            : undefined
        }
      />
    );
  }

  /* Notebook (workspace or list) */
  if (viewType === 'notebook') {
    if (context?.slug) {
      return (
        <NotebookWorkspace
          slug={context.slug as string}
          onOpenObject={
            paneId && onOpenObject
              ? (ref, title) => onOpenObject(paneId, ref, title)
              : undefined
          }
        />
      );
    }
    return <NotebookListView />;
  }

  /* Project (list or detail) */
  if (viewType === 'project') {
    if (context?.slug) {
      return (
        <ProjectView
          slug={context.slug as string}
          onOpenObject={
            paneId && onOpenObject
              ? (ref, title) => onOpenObject(paneId, ref, title)
              : undefined
          }
        />
      );
    }
    return <ProjectListView />;
  }

  /* Calendar */
  if (viewType === 'calendar') {
    return (
      <CalendarView
        onOpenObject={
          paneId && onOpenObject
            ? (ref, title) => onOpenObject(paneId, ref, title)
            : undefined
        }
      />
    );
  }

  /* Loose Ends */
  if (viewType === 'loose-ends') {
    return (
      <LooseEndsView
        onOpenObject={
          paneId && onOpenObject
            ? (ref, title) => onOpenObject(paneId, ref, title)
            : undefined
        }
      />
    );
  }

  /* Compose (rich text editor) */
  if (viewType === 'compose') {
    return (
      <ComposeView
        prefillText={context?.prefillText as string | undefined}
        prefillType={context?.prefillType as string | undefined}
        onSaved={
          paneId && onOpenObject
            ? (objectId) => onOpenObject(paneId, objectId)
            : undefined
        }
      />
    );
  }

  /* Model (epistemic argument workbench) */
  if (viewType === 'model-view') {
    return (
      <ModelView
        paneId={paneId}
        onOpenObject={
          paneId && onOpenObject
            ? (pid, ref, title) => onOpenObject(pid, ref, title)
            : undefined
        }
      />
    );
  }

  /* Promotion Queue */
  if (viewType === 'promotion-queue') {
    return <PromotionQueueView />;
  }

  /* Notebook Formation */
  if (viewType === 'notebook-formation') {
    return <NotebookFormationView />;
  }

  /* Entity Promotions */
  if (viewType === 'entity-promotions') {
    return <EntityPromotionView />;
  }

  /* Emergent Types */
  if (viewType === 'emergent-types') {
    return <EmergentTypeSuggestionsView />;
  }

  /* Artifacts */
  if (viewType === 'artifacts') {
    return <ArtifactBrowserView />;
  }

  /* Temporal Evolution */
  if (viewType === 'temporal-evolution') {
    return <TemporalEvolutionView notebookSlug={context?.slug as string | undefined} />;
  }

  /* Placeholder for views not yet implemented */
  return (
    <div
      className="cp-pane-content"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flex: 1,
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <ViewTypeIcon viewType={viewType} size={32} />
        <div
          style={{
            fontFamily: 'var(--cp-font-title)',
            fontSize: 20,
            color: 'var(--cp-text)',
            marginTop: 12,
            marginBottom: 6,
          }}
        >
          {view?.label ?? viewType}
        </div>
        <div
          style={{
            fontFamily: 'var(--cp-font-mono)',
            fontSize: 10,
            color: 'var(--cp-text-faint)',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}
        >
          COMING SOON
        </div>
      </div>
    </div>
  );
}

/* =============================================
   SVG icons (inline for zero dependency)
   ============================================= */

function ViewTypeIcon({
  viewType,
  size = 16,
}: {
  viewType: ViewType;
  size?: number;
}) {
  const s = size;
  const sw = 1.5;
  const color = 'currentColor';

  switch (viewType) {
    case 'grid':
      return (
        <svg
          width={s}
          height={s}
          viewBox="0 0 16 16"
          fill="none"
          stroke={color}
          strokeWidth={sw}
          style={{ display: 'block', margin: '0 auto' }}
        >
          <rect x={1} y={1} width={6} height={6} rx={1} />
          <rect x={9} y={1} width={6} height={6} rx={1} />
          <rect x={1} y={9} width={6} height={6} rx={1} />
          <rect x={9} y={9} width={6} height={6} rx={1} />
        </svg>
      );
    case 'timeline':
      return (
        <svg
          width={s}
          height={s}
          viewBox="0 0 16 16"
          fill="none"
          stroke={color}
          strokeWidth={sw}
          style={{ display: 'block', margin: '0 auto' }}
        >
          <line x1={3} y1={2} x2={3} y2={14} />
          <line x1={3} y1={4} x2={12} y2={4} />
          <line x1={3} y1={8} x2={10} y2={8} />
          <line x1={3} y1={12} x2={13} y2={12} />
        </svg>
      );
    case 'network':
      return (
        <svg
          width={s}
          height={s}
          viewBox="0 0 16 16"
          fill="none"
          stroke={color}
          strokeWidth={sw}
          style={{ display: 'block', margin: '0 auto' }}
        >
          <circle cx={8} cy={4} r={2} />
          <circle cx={4} cy={12} r={2} />
          <circle cx={12} cy={12} r={2} />
          <line x1={8} y1={6} x2={4} y2={10} />
          <line x1={8} y1={6} x2={12} y2={10} />
        </svg>
      );
    case 'notebook':
      return (
        <svg
          width={s}
          height={s}
          viewBox="0 0 16 16"
          fill="none"
          stroke={color}
          strokeWidth={sw}
          style={{ display: 'block', margin: '0 auto' }}
        >
          <rect x={3} y={1} width={10} height={14} rx={1} />
          <line x1={6} y1={1} x2={6} y2={15} />
          <line x1={8} y1={5} x2={11} y2={5} />
          <line x1={8} y1={8} x2={11} y2={8} />
        </svg>
      );
    case 'project':
      return (
        <svg
          width={s}
          height={s}
          viewBox="0 0 16 16"
          fill="none"
          stroke={color}
          strokeWidth={sw}
          style={{ display: 'block', margin: '0 auto' }}
        >
          <rect x={1} y={3} width={14} height={11} rx={1} />
          <path d="M1 3 L5 1 H11 L15 3" />
        </svg>
      );
    case 'object-detail':
      return (
        <svg
          width={s}
          height={s}
          viewBox="0 0 16 16"
          fill="none"
          stroke={color}
          strokeWidth={sw}
          style={{ display: 'block', margin: '0 auto' }}
        >
          <rect x={2} y={2} width={12} height={12} rx={2} />
          <line x1={5} y1={6} x2={11} y2={6} />
          <line x1={5} y1={9} x2={9} y2={9} />
        </svg>
      );
    case 'calendar':
      return (
        <svg
          width={s}
          height={s}
          viewBox="0 0 16 16"
          fill="none"
          stroke={color}
          strokeWidth={sw}
          style={{ display: 'block', margin: '0 auto' }}
        >
          <rect x={1} y={3} width={14} height={12} rx={1} />
          <line x1={1} y1={7} x2={15} y2={7} />
          <line x1={5} y1={1} x2={5} y2={5} />
          <line x1={11} y1={1} x2={11} y2={5} />
        </svg>
      );
    case 'resurface':
      return (
        <svg
          width={s}
          height={s}
          viewBox="0 0 16 16"
          fill="none"
          stroke={color}
          strokeWidth={sw}
          style={{ display: 'block', margin: '0 auto' }}
        >
          <path d="M8 2 L9.5 6 L14 6.5 L10.5 9.5 L11.5 14 L8 11.5 L4.5 14 L5.5 9.5 L2 6.5 L6.5 6 Z" />
        </svg>
      );
    case 'loose-ends':
      return (
        <svg
          width={s}
          height={s}
          viewBox="0 0 16 16"
          fill="none"
          stroke={color}
          strokeWidth={sw}
          style={{ display: 'block', margin: '0 auto' }}
        >
          <circle cx={4} cy={4} r={1.5} />
          <circle cx={12} cy={6} r={1.5} />
          <circle cx={6} cy={11} r={1.5} />
          <circle cx={11} cy={13} r={1.5} />
        </svg>
      );
    case 'scoped-timeline':
      return (
        <svg
          width={s}
          height={s}
          viewBox="0 0 16 16"
          fill="none"
          stroke={color}
          strokeWidth={sw}
          style={{ display: 'block', margin: '0 auto' }}
        >
          <line x1={3} y1={2} x2={3} y2={14} />
          <line x1={3} y1={5} x2={10} y2={5} />
          <line x1={3} y1={9} x2={8} y2={9} />
          <circle cx={13} cy={5} r={1.5} />
          <circle cx={11} cy={9} r={1.5} />
        </svg>
      );
    case 'compose':
      return (
        <svg
          width={s}
          height={s}
          viewBox="0 0 16 16"
          fill="none"
          stroke={color}
          strokeWidth={sw}
          style={{ display: 'block', margin: '0 auto' }}
        >
          <rect x={2} y={2} width={12} height={12} rx={1} />
          <line x1={5} y1={5} x2={11} y2={5} />
          <line x1={5} y1={8} x2={11} y2={8} />
          <line x1={5} y1={11} x2={8} y2={11} />
        </svg>
      );
    case 'library':
      return (
        <svg
          width={s}
          height={s}
          viewBox="0 0 16 16"
          fill="none"
          stroke={color}
          strokeWidth={sw}
          style={{ display: 'block', margin: '0 auto' }}
        >
          <line x1={2} y1={4} x2={14} y2={4} />
          <line x1={2} y1={8} x2={11} y2={8} />
          <line x1={2} y1={12} x2={13} y2={12} />
        </svg>
      );
    case 'promotion-queue':
      return (
        <svg
          width={s}
          height={s}
          viewBox="0 0 16 16"
          fill="none"
          stroke={color}
          strokeWidth={sw}
          style={{ display: 'block', margin: '0 auto' }}
        >
          <line x1={5} y1={4} x2={14} y2={4} />
          <line x1={5} y1={8} x2={14} y2={8} />
          <line x1={5} y1={12} x2={14} y2={12} />
          <path d="M2 3.5 L3 4.5 L4.5 2.5" />
          <circle cx={3} cy={8} r={1} />
          <circle cx={3} cy={12} r={1} />
        </svg>
      );
    case 'notebook-formation':
      return (
        <svg
          width={s}
          height={s}
          viewBox="0 0 16 16"
          fill="none"
          stroke={color}
          strokeWidth={sw}
          style={{ display: 'block', margin: '0 auto' }}
        >
          <circle cx={5} cy={5} r={3} />
          <circle cx={11} cy={5} r={3} />
          <circle cx={8} cy={11} r={3} />
        </svg>
      );
    case 'entity-promotions':
      return (
        <svg
          width={s}
          height={s}
          viewBox="0 0 16 16"
          fill="none"
          stroke={color}
          strokeWidth={sw}
          style={{ display: 'block', margin: '0 auto' }}
        >
          <circle cx={8} cy={5} r={3} />
          <path d="M3 14 C3 10 13 10 13 14" />
          <line x1={12} y1={3} x2={12} y2={7} />
          <line x1={10} y1={5} x2={14} y2={5} />
        </svg>
      );
    case 'emergent-types':
      return (
        <svg
          width={s}
          height={s}
          viewBox="0 0 16 16"
          fill="none"
          stroke={color}
          strokeWidth={sw}
          style={{ display: 'block', margin: '0 auto' }}
        >
          <path d="M8 2 L9.5 6 L14 6.5 L10.5 9.5 L11.5 14 L8 11.5 L4.5 14 L5.5 9.5 L2 6.5 L6.5 6 Z" />
        </svg>
      );
    case 'artifacts':
      return (
        <svg
          width={s}
          height={s}
          viewBox="0 0 16 16"
          fill="none"
          stroke={color}
          strokeWidth={sw}
          style={{ display: 'block', margin: '0 auto' }}
        >
          <path d="M4 2 L10 2 L13 5 L13 14 L4 14 Z" />
          <path d="M10 2 L10 5 L13 5" />
          <line x1={6} y1={8} x2={11} y2={8} />
          <line x1={6} y1={11} x2={11} y2={11} />
        </svg>
      );
    default:
      return null;
  }
}

function MobileTabIcon({ viewType }: { viewType: ViewType }) {
  return <ViewTypeIcon viewType={viewType} size={18} />;
}

function CaptureIcon() {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
    >
      <path d="M7 2v10M2 7h10" />
    </svg>
  );
}
