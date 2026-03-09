'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import type {
  PaneNode,
  PaneTab,
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
  addTab,
  closeTab,
  setActiveTab,
  collectLeafIds,
  findPane,
  findAdjacentLeaf,
  serializeLayout,
  deserializeLayout,
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
import GridView from './GridView';
import TimelineView from './TimelineView';
import NetworkView from './NetworkView';
import ObjectDetailView from './ObjectDetailView';
import ResurfaceView from './ResurfaceView';
import NotebookView from './NotebookView';
import ProjectView from './ProjectView';
import NotebookListView from './NotebookListView';
import ProjectListView from './ProjectListView';
import CalendarView from './CalendarView';
import LooseEndsView from './LooseEndsView';
import ComposeView from './ComposeView';

const STORAGE_KEY = 'commonplace-layout';

/* ─────────────────────────────────────────────────
   Main container: owns the layout tree state
   ───────────────────────────────────────────────── */

export default function SplitPaneContainer() {
  const { toggleMobileSidebar, openMobileSidebar, pendingView, clearPendingView } = useCommonPlace();
  const isMobile = useIsAppShellMobile();
  const [layout, setLayout] = useState<PaneNode>(LAYOUT_PRESETS[0].tree);
  const [hasLoadedPersistedLayout, setHasLoadedPersistedLayout] = useState(false);

  const [focusedPaneId, setFocusedPaneId] = useState<string | null>(null);
  const [mobileLeafIndex, setMobileLeafIndex] = useState(0);
  const [mobileObjectSheet, setMobileObjectSheet] = useState<{
    objectRef: number;
    title?: string;
  } | null>(null);
  const [activePresetName, setActivePresetName] = useState<string | null>(
    LAYOUT_PRESETS[0].name
  );

  /* Load persisted layout after mount to keep server/client first render deterministic */
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = deserializeLayout(saved);
      if (parsed) {
        setLayout(parsed);
        setActivePresetName(null);
      }
    }
    setHasLoadedPersistedLayout(true);
  }, []);

  /* Persist layout changes to localStorage */
  useEffect(() => {
    if (!hasLoadedPersistedLayout) return;
    localStorage.setItem(STORAGE_KEY, serializeLayout(layout));
  }, [layout, hasLoadedPersistedLayout]);

  /* ── Layout mutations (all immutable) ── */

  const handleSplit = useCallback(
    (paneId: string, direction: SplitDirection) => {
      setLayout((prev) => splitLeaf(prev, paneId, direction));
      setActivePresetName(null);
    },
    []
  );

  const handleClosePane = useCallback((paneId: string) => {
    setLayout((prev) => closePane(prev, paneId));
    setActivePresetName(null);
  }, []);

  const handleResize = useCallback((splitId: string, ratio: number) => {
    setLayout((prev) => updateRatio(prev, splitId, ratio));
    setActivePresetName(null);
  }, []);

  const handleAddTab = useCallback(
    (paneId: string, viewType: ViewType) => {
      setLayout((prev) => addTab(prev, paneId, viewType));
    },
    []
  );

  /** Open an object detail in an adjacent pane (auto-splits if single pane) */
  const handleOpenObject = useCallback(
    (fromPaneId: string, objectRef: number, title?: string) => {
      if (isMobile) {
        setMobileObjectSheet({ objectRef, title });
        return;
      }

      setLayout((prev) => {
        let tree = prev;
        let targetPaneId = findAdjacentLeaf(tree, fromPaneId);

        /* If there's only one pane, auto-split to create a second */
        if (!targetPaneId) {
          tree = splitLeaf(tree, fromPaneId, 'horizontal');
          targetPaneId = findAdjacentLeaf(tree, fromPaneId);
          if (!targetPaneId) return prev;
        }

        const label = title
          ? title.length > 25 ? title.slice(0, 24) + '\u2026' : title
          : 'Object';
        return addTab(tree, targetPaneId, 'object-detail', label, { objectRef });
      });
      setActivePresetName(null);
    },
    [isMobile]
  );

  const handleCloseTab = useCallback(
    (paneId: string, tabIndex: number) => {
      setLayout((prev) => closeTab(prev, paneId, tabIndex));
    },
    []
  );

  const handleSetActiveTab = useCallback(
    (paneId: string, tabIndex: number) => {
      setLayout((prev) => setActiveTab(prev, paneId, tabIndex));
    },
    []
  );

  const handlePreset = useCallback((presetIndex: number) => {
    if (presetIndex >= 0 && presetIndex < LAYOUT_PRESETS.length) {
      setLayout(LAYOUT_PRESETS[presetIndex].tree);
      setFocusedPaneId(null);
      setActivePresetName(LAYOUT_PRESETS[presetIndex].name);
    }
  }, []);

  /* ── Keyboard shortcuts ── */

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
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
            case 'close-tab': {
              if (!focusedPaneId) break;
              const focused = findPane(layout, focusedPaneId);
              if (focused?.type === 'leaf') {
                handleCloseTab(focusedPaneId, focused.activeTabIndex);
              }
              break;
            }
            case 'next-tab': {
              if (!focusedPaneId) break;
              const fp = findPane(layout, focusedPaneId);
              if (fp?.type === 'leaf') {
                const next = (fp.activeTabIndex + 1) % fp.tabs.length;
                handleSetActiveTab(focusedPaneId, next);
              }
              break;
            }
            case 'prev-tab': {
              if (!focusedPaneId) break;
              const fp2 = findPane(layout, focusedPaneId);
              if (fp2?.type === 'leaf') {
                const prev =
                  (fp2.activeTabIndex - 1 + fp2.tabs.length) % fp2.tabs.length;
                handleSetActiveTab(focusedPaneId, prev);
              }
              break;
            }
            case 'preset-focus':
              handlePreset(0);
              break;
            case 'preset-compare':
              handlePreset(1);
              break;
            case 'preset-research':
              handlePreset(2);
              break;
            case 'preset-connect':
              handlePreset(3);
              break;
          }
          return;
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    focusedPaneId,
    layout,
    handleSplit,
    handleClosePane,
    handleCloseTab,
    handleSetActiveTab,
    handlePreset,
  ]);

  /* ── Consume pendingView from context (sidebar / list view requests) ── */

  useEffect(() => {
    if (!pendingView) return;
    setLayout((prev) => {
      const leaves = collectLeafIds(prev);
      const targetPaneId = leaves[0];
      if (!targetPaneId) return prev;
      return addTab(
        prev,
        targetPaneId,
        pendingView.viewType,
        pendingView.label,
        pendingView.context,
      );
    });
    clearPendingView();
  }, [pendingView, clearPendingView]);

  /* ── Mobile: single pane view ── */

  const leafIds = collectLeafIds(layout);

  if (isMobile) {
    const safeIndex = Math.min(mobileLeafIndex, leafIds.length - 1);
    const activeLeafId = leafIds[safeIndex];
    const activeLeaf = activeLeafId
      ? (findPane(layout, activeLeafId) as LeafPane | null)
      : null;
    const activeTab = activeLeaf?.tabs[activeLeaf.activeTabIndex];
    const activeViewType = activeTab?.viewType ?? 'empty';
    const activeTitle =
      activeTab?.label ?? VIEW_REGISTRY[activeViewType].label;

    return (
      <div className="cp-mobile-shell" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <MobileTopBar
          title={activeTitle}
          onMenu={toggleMobileSidebar}
          menuAriaLabel="Open CommonPlace navigation drawer"
          className="cp-mobile-top-bar"
          titleClassName="cp-mobile-view-title"
          menuButtonClassName="cp-mobile-top-bar-btn"
          primaryAction={(
            <button
              type="button"
              className="cp-mobile-top-bar-btn cp-mobile-capture-btn"
              onClick={openMobileSidebar}
              aria-label="Open capture drawer"
            >
              <CaptureIcon />
              <span>Capture</span>
            </button>
          )}
        />

        <div className="cp-mobile-preset-row">
          <LayoutPresetSelector
            activePresetName={activePresetName}
            onSelect={handlePreset}
          />
        </div>

        {/* Active pane content */}
        <div className="cp-mobile-pane-scroll cp-scrollbar" style={{ flex: 1, overflow: 'auto' }}>
          {activeLeaf ? (
            <PaneViewContent
              viewType={
                activeLeaf.tabs[activeLeaf.activeTabIndex]?.viewType ?? 'empty'
              }
              context={activeLeaf.tabs[activeLeaf.activeTabIndex]?.context}
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
                const activeTab = leaf.tabs[leaf.activeTabIndex];
                return {
                  key: id,
                  icon: <MobileTabIcon viewType={activeTab?.viewType ?? 'empty'} />,
                  label:
                    activeTab?.label ??
                    VIEW_REGISTRY[activeTab?.viewType ?? 'empty'].label,
                };
              })
              .filter(Boolean) as Array<{ key: string; icon: ReactNode; label: string }>}
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
      {/* Toolbar: layout presets */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          borderBottom: '1px solid var(--cp-border-faint)',
          background: 'var(--cp-surface)',
          flexShrink: 0,
        }}
      >
        <LayoutPresetSelector
          activePresetName={activePresetName}
          onSelect={handlePreset}
        />
        <div
          style={{
            fontFamily: 'var(--cp-font-mono)',
            fontSize: 10,
            color: 'var(--cp-text-faint)',
            letterSpacing: '0.05em',
            marginLeft: 'auto',
            paddingRight: 12,
          }}
        >
          {focusedPaneId ? 'CTRL+\\ SPLIT' : 'CLICK A PANE TO FOCUS'}
        </div>
      </div>

      {/* Pane tree */}
      <div style={{ flex: 1, display: 'flex', minWidth: 0, minHeight: 0, overflow: 'hidden' }}>
        <RenderNode
          node={layout}
          focusedPaneId={focusedPaneId}
          onFocus={setFocusedPaneId}
          onSplit={handleSplit}
          onClosePane={handleClosePane}
          onResize={handleResize}
          onAddTab={handleAddTab}
          onCloseTab={handleCloseTab}
          onSetActiveTab={handleSetActiveTab}
          onOpenObject={handleOpenObject}
        />
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────
   Recursive node renderer
   ───────────────────────────────────────────────── */

interface NodeProps {
  node: PaneNode;
  focusedPaneId: string | null;
  onFocus: (id: string) => void;
  onSplit: (paneId: string, direction: SplitDirection) => void;
  onClosePane: (paneId: string) => void;
  onResize: (splitId: string, ratio: number) => void;
  onAddTab: (paneId: string, viewType: ViewType) => void;
  onCloseTab: (paneId: string, tabIndex: number) => void;
  onSetActiveTab: (paneId: string, tabIndex: number) => void;
  onOpenObject: (fromPaneId: string, objectRef: number, title?: string) => void;
}

function RenderNode(props: NodeProps) {
  if (props.node.type === 'leaf') {
    return <RenderLeaf {...props} node={props.node} />;
  }
  return <RenderSplit {...props} node={props.node} />;
}

/* ─────────────────────────────────────────────────
   Split node: two children + drag handle
   ───────────────────────────────────────────────── */

function RenderSplit(props: NodeProps & { node: SplitPane }) {
  const { node, onResize, ...rest } = props;
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={containerRef}
      className="cp-pane-container"
      data-direction={node.direction}
    >
      <div style={{ flex: node.ratio, minWidth: 0, minHeight: 0, display: 'flex' }}>
        <RenderNode {...rest} onResize={onResize} node={node.first} />
      </div>

      <DragHandle
        direction={node.direction}
        splitId={node.id}
        onResize={onResize}
        containerRef={containerRef}
      />

      <div style={{ flex: 1 - node.ratio, minWidth: 0, minHeight: 0, display: 'flex' }}>
        <RenderNode {...rest} onResize={onResize} node={node.second} />
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────
   Leaf node: tab bar + content
   ───────────────────────────────────────────────── */

function RenderLeaf(props: NodeProps & { node: LeafPane }) {
  const { node, focusedPaneId, onFocus, onSplit, onClosePane, onAddTab, onCloseTab, onSetActiveTab, onOpenObject } = props;
  const [showViewPicker, setShowViewPicker] = useState(false);
  const isFocused = focusedPaneId === node.id;
  const activeTab = node.tabs[node.activeTabIndex];

  return (
    <div
      className="cp-pane"
      style={{
        flex: 1,
        outline: isFocused ? '2px solid var(--cp-terracotta)' : '2px solid transparent',
        outlineOffset: -2,
        transition: 'outline-color 150ms',
      }}
      onClick={() => onFocus(node.id)}
    >
      {/* Tab bar */}
      <PaneTabBar
        tabs={node.tabs}
        activeTabIndex={node.activeTabIndex}
        paneId={node.id}
        onSetActiveTab={onSetActiveTab}
        onCloseTab={onCloseTab}
        onSplit={onSplit}
        onClosePane={onClosePane}
        showViewPicker={showViewPicker}
        onToggleViewPicker={() => setShowViewPicker(!showViewPicker)}
        onAddTab={(viewType) => {
          onAddTab(node.id, viewType);
          setShowViewPicker(false);
        }}
      />

      {/* Content */}
      <PaneViewContent
        viewType={activeTab?.viewType ?? 'empty'}
        context={activeTab?.context}
        paneId={node.id}
        onOpenObject={onOpenObject}
      />
    </div>
  );
}

/* ─────────────────────────────────────────────────
   Tab bar: tabs + split buttons + add tab
   ───────────────────────────────────────────────── */

interface TabBarProps {
  tabs: PaneTab[];
  activeTabIndex: number;
  paneId: string;
  onSetActiveTab: (paneId: string, index: number) => void;
  onCloseTab: (paneId: string, index: number) => void;
  onSplit: (paneId: string, direction: SplitDirection) => void;
  onClosePane: (paneId: string) => void;
  showViewPicker: boolean;
  onToggleViewPicker: () => void;
  onAddTab: (viewType: ViewType) => void;
}

function PaneTabBar({
  tabs,
  activeTabIndex,
  paneId,
  onSetActiveTab,
  onCloseTab,
  onSplit,
  onClosePane,
  showViewPicker,
  onToggleViewPicker,
  onAddTab,
}: TabBarProps) {
  return (
    <div className="cp-tab-bar" style={{ position: 'relative' }}>
      {/* Tabs */}
      {tabs.map((tab, i) => (
        <div
          key={tab.id}
          className="cp-tab"
          data-active={i === activeTabIndex ? 'true' : 'false'}
          onClick={(e) => {
            e.stopPropagation();
            onSetActiveTab(paneId, i);
          }}
        >
          <span>{tab.label}</span>
          <button
            className="cp-tab-close"
            onClick={(e) => {
              e.stopPropagation();
              onCloseTab(paneId, i);
            }}
            aria-label={`Close ${tab.label}`}
          >
            ×
          </button>
        </div>
      ))}

      {/* Add tab button */}
      <button
        className="cp-tab"
        onClick={(e) => {
          e.stopPropagation();
          onToggleViewPicker();
        }}
        title="Add view"
        aria-label="Add view to pane"
        style={{
          border: 'none',
          borderRight: 'none',
          color: 'var(--cp-text-faint)',
          fontSize: 16,
          padding: '0 10px',
        }}
      >
        +
      </button>

      {/* Spacer pushes action buttons to right */}
      <div style={{ flex: 1 }} />

      {/* Split + close actions */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          paddingRight: 4,
        }}
      >
        <TabBarAction
          title="Split horizontal (Ctrl+\\)"
          onClick={() => onSplit(paneId, 'horizontal')}
        >
          <SplitHIcon />
        </TabBarAction>
        <TabBarAction
          title="Split vertical (Ctrl+-)"
          onClick={() => onSplit(paneId, 'vertical')}
        >
          <SplitVIcon />
        </TabBarAction>
        <TabBarAction
          title="Close pane (Ctrl+Shift+W)"
          onClick={() => onClosePane(paneId)}
        >
          <CloseIcon />
        </TabBarAction>
      </div>

      {/* View picker dropdown */}
      {showViewPicker && (
        <ViewPickerDropdown
          onSelect={onAddTab}
          onClose={onToggleViewPicker}
        />
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────
   Tab bar action button (small icon)
   ───────────────────────────────────────────────── */

function TabBarAction({
  children,
  title,
  onClick,
}: {
  children: React.ReactNode;
  title: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      title={title}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 24,
        height: 24,
        border: 'none',
        borderRadius: 4,
        background: 'transparent',
        color: 'var(--cp-text-faint)',
        cursor: 'pointer',
        transition: 'color 150ms, background 150ms',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.color = 'var(--cp-text)';
        e.currentTarget.style.background = 'var(--cp-surface-hover)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = 'var(--cp-text-faint)';
        e.currentTarget.style.background = 'transparent';
      }}
    >
      {children}
    </button>
  );
}

/* ─────────────────────────────────────────────────
   View picker dropdown
   ───────────────────────────────────────────────── */

function ViewPickerDropdown({
  onSelect,
  onClose,
}: {
  onSelect: (viewType: ViewType) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  const viewTypes = Object.entries(VIEW_REGISTRY).filter(
    ([key]) => key !== 'empty'
  ) as [ViewType, { label: string; icon: string }][];

  return (
    <div
      ref={ref}
      style={{
        position: 'absolute',
        top: '100%',
        left: 0,
        zIndex: 50,
        background: 'var(--cp-card)',
        border: '1px solid var(--cp-border)',
        borderRadius: 8,
        boxShadow: 'var(--cp-shadow-lg)',
        padding: 4,
        minWidth: 180,
      }}
    >
      <div
        style={{
          fontFamily: 'var(--cp-font-mono)',
          fontSize: 9,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: 'var(--cp-text-faint)',
          padding: '6px 10px 4px',
        }}
      >
        ADD VIEW
      </div>
      {viewTypes.map(([type, def]) => (
        <button
          key={type}
          onClick={() => onSelect(type)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            width: '100%',
            padding: '8px 10px',
            border: 'none',
            borderRadius: 4,
            background: 'transparent',
            color: 'var(--cp-text-muted)',
            fontFamily: 'var(--cp-font-body)',
            fontSize: 13,
            cursor: 'pointer',
            transition: 'background 150ms, color 150ms',
            textAlign: 'left',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--cp-surface-hover)';
            e.currentTarget.style.color = 'var(--cp-text)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = 'var(--cp-text-muted)';
          }}
        >
          <ViewTypeIcon viewType={type} size={14} />
          {def.label}
        </button>
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────────
   Pane content: placeholder for each view type.
   Real view components are built in later sessions.
   ───────────────────────────────────────────────── */

interface PaneViewContentProps {
  viewType: ViewType;
  context?: Record<string, unknown>;
  paneId?: string;
  onOpenObject?: (fromPaneId: string, objectRef: number, title?: string) => void;
}

function PaneViewContent({ viewType, context, paneId, onOpenObject }: PaneViewContentProps) {
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

  /* Live view: Grid (masonry object browser, default view) */
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

  /* Live view: Timeline */
  if (viewType === 'timeline') {
    return <TimelineView />;
  }

  /* Live view: Scoped Timeline (re-uses TimelineView for now) */
  if (viewType === 'scoped-timeline') {
    return <TimelineView />;
  }

  /* Live view: Network (Map / Entities / Timeline viz) */
  if (viewType === 'network') {
    return (
      <NetworkView
        onOpenObject={
          paneId && onOpenObject
            ? (objectId) => onOpenObject(paneId, Number(objectId))
            : undefined
        }
      />
    );
  }

  /* Live view: Object Detail */
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

  /* Live view: Resurface */
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

  /* Live view: Notebook (list or detail) */
  if (viewType === 'notebook') {
    if (context?.slug) {
      return (
        <NotebookView
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

  /* Live view: Project (list or detail) */
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

  /* Live view: Calendar */
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

  /* Live view: Loose Ends */
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

  /* Live view: Compose (rich text editor) */
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
          {view.label}
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

/* ─────────────────────────────────────────────────
   SVG icons (inline for zero dependency)
   ───────────────────────────────────────────────── */

function SplitHIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <rect x={1} y={1} width={5} height={12} rx={1} />
      <rect x={8} y={1} width={5} height={12} rx={1} />
    </svg>
  );
}

function SplitVIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <rect x={1} y={1} width={12} height={5} rx={1} />
      <rect x={1} y={8} width={12} height={5} rx={1} />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <line x1={3} y1={3} x2={11} y2={11} />
      <line x1={11} y1={3} x2={3} y2={11} />
    </svg>
  );
}

function ViewTypeIcon({ viewType, size = 16 }: { viewType: ViewType; size?: number }) {
  const s = size;
  const sw = 1.5;
  const color = 'currentColor';

  switch (viewType) {
    case 'grid':
      return (
        <svg width={s} height={s} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth={sw} style={{ display: 'block', margin: '0 auto' }}>
          <rect x={1} y={1} width={6} height={6} rx={1} />
          <rect x={9} y={1} width={6} height={6} rx={1} />
          <rect x={1} y={9} width={6} height={6} rx={1} />
          <rect x={9} y={9} width={6} height={6} rx={1} />
        </svg>
      );
    case 'timeline':
      return (
        <svg width={s} height={s} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth={sw} style={{ display: 'block', margin: '0 auto' }}>
          <line x1={3} y1={2} x2={3} y2={14} />
          <line x1={3} y1={4} x2={12} y2={4} />
          <line x1={3} y1={8} x2={10} y2={8} />
          <line x1={3} y1={12} x2={13} y2={12} />
        </svg>
      );
    case 'network':
      return (
        <svg width={s} height={s} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth={sw} style={{ display: 'block', margin: '0 auto' }}>
          <circle cx={8} cy={4} r={2} />
          <circle cx={4} cy={12} r={2} />
          <circle cx={12} cy={12} r={2} />
          <line x1={8} y1={6} x2={4} y2={10} />
          <line x1={8} y1={6} x2={12} y2={10} />
        </svg>
      );
    case 'notebook':
      return (
        <svg width={s} height={s} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth={sw} style={{ display: 'block', margin: '0 auto' }}>
          <rect x={3} y={1} width={10} height={14} rx={1} />
          <line x1={6} y1={1} x2={6} y2={15} />
          <line x1={8} y1={5} x2={11} y2={5} />
          <line x1={8} y1={8} x2={11} y2={8} />
        </svg>
      );
    case 'project':
      return (
        <svg width={s} height={s} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth={sw} style={{ display: 'block', margin: '0 auto' }}>
          <rect x={1} y={3} width={14} height={11} rx={1} />
          <path d="M1 3 L5 1 H11 L15 3" />
        </svg>
      );
    case 'object-detail':
      return (
        <svg width={s} height={s} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth={sw} style={{ display: 'block', margin: '0 auto' }}>
          <rect x={2} y={2} width={12} height={12} rx={2} />
          <line x1={5} y1={6} x2={11} y2={6} />
          <line x1={5} y1={9} x2={9} y2={9} />
        </svg>
      );
    case 'calendar':
      return (
        <svg width={s} height={s} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth={sw} style={{ display: 'block', margin: '0 auto' }}>
          <rect x={1} y={3} width={14} height={12} rx={1} />
          <line x1={1} y1={7} x2={15} y2={7} />
          <line x1={5} y1={1} x2={5} y2={5} />
          <line x1={11} y1={1} x2={11} y2={5} />
        </svg>
      );
    case 'resurface':
      return (
        <svg width={s} height={s} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth={sw} style={{ display: 'block', margin: '0 auto' }}>
          <path d="M8 2 L9.5 6 L14 6.5 L10.5 9.5 L11.5 14 L8 11.5 L4.5 14 L5.5 9.5 L2 6.5 L6.5 6 Z" />
        </svg>
      );
    case 'loose-ends':
      return (
        <svg width={s} height={s} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth={sw} style={{ display: 'block', margin: '0 auto' }}>
          <circle cx={4} cy={4} r={1.5} />
          <circle cx={12} cy={6} r={1.5} />
          <circle cx={6} cy={11} r={1.5} />
          <circle cx={11} cy={13} r={1.5} />
        </svg>
      );
    case 'scoped-timeline':
      return (
        <svg width={s} height={s} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth={sw} style={{ display: 'block', margin: '0 auto' }}>
          <line x1={3} y1={2} x2={3} y2={14} />
          <line x1={3} y1={5} x2={10} y2={5} />
          <line x1={3} y1={9} x2={8} y2={9} />
          <circle cx={13} cy={5} r={1.5} />
          <circle cx={11} cy={9} r={1.5} />
        </svg>
      );
    case 'compose':
      return (
        <svg width={s} height={s} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth={sw} style={{ display: 'block', margin: '0 auto' }}>
          <rect x={2} y={2} width={12} height={12} rx={1} />
          <line x1={5} y1={5} x2={11} y2={5} />
          <line x1={5} y1={8} x2={11} y2={8} />
          <line x1={5} y1={11} x2={8} y2={11} />
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
    <svg width={14} height={14} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth={1.6}>
      <path d="M7 2v10M2 7h10" />
    </svg>
  );
}
