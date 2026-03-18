'use client';

/**
 * CommonPlaceContext: state management for cross-component
 * communication within the CommonPlace route group.
 *
 * Owns: layout tree, active screen, capture version counter,
 * sidebar collapse, mobile drawer, command palette, object drawer,
 * context menu, stash, and manual connection draft.
 *
 * Architecture: the CommonPlace layout is a Server Component
 * that cannot hold state. This Client Component provider wraps
 * the layout's children so all CommonPlace components share state.
 */

import { createContext, useContext, useState, useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';
import type { ViewType, ScreenType } from '@/lib/commonplace';
import type { PaneNode } from '@/lib/commonplace-layout';
import {
  LAYOUT_PRESETS,
  collectLeafIds,
  findLeafWithView,
  replaceView,
  splitLeaf,
  deserializeLayout,
  shouldDiscardPersistedLayout,
} from '@/lib/commonplace-layout';
import { fetchObjectById, postObjectConnection } from '@/lib/commonplace-api';
import type { RenderableObject } from '@/components/commonplace/objects/ObjectRenderer';

interface CommonPlaceContextValue {
  /** Monotonically increasing counter; changes trigger timeline refetch */
  captureVersion: number;
  /** True when sidebar is collapsed to 48px icon rail */
  sidebarCollapsed: boolean;
  /** Set sidebar collapsed state (auto-set by SplitPaneContainer on compose) */
  setSidebarCollapsed: (collapsed: boolean) => void;
  /** Call after a capture successfully syncs to the API */
  notifyCaptured: () => void;
  /** Mobile drawer state for CommonPlace sidebar */
  mobileSidebarOpen: boolean;
  /** Open sidebar drawer */
  openMobileSidebar: () => void;
  /** Close sidebar drawer */
  closeMobileSidebar: () => void;
  /** Toggle sidebar drawer */
  toggleMobileSidebar: () => void;

  /** Currently active screen (null when in pane workspace mode) */
  activeScreen: ScreenType | null;
  /** Navigate to a full-screen mode (Library, Models, etc.) */
  navigateToScreen: (screen: ScreenType) => void;
  /** Open a view in the pane workspace using Smart Launch strategy */
  launchView: (viewId: ViewType, context?: Record<string, unknown>, forceNewPane?: boolean) => void;
  /** Exit any active screen and return to the pane workspace */
  exitScreen: () => void;

  /** The layout tree (owned by context, consumed by SplitPaneContainer) */
  layout: PaneNode;
  /** Update the layout tree */
  setLayout: (updater: PaneNode | ((prev: PaneNode) => PaneNode)) => void;
  /** Currently focused pane ID */
  focusedPaneId: string | null;
  /** Set the focused pane */
  setFocusedPaneId: (id: string | null) => void;
  /** Pane in fullscreen mode (null for normal view) */
  fullscreenPaneId: string | null;
  /** Toggle fullscreen for a pane */
  toggleFullscreen: (paneId: string) => void;
  /** Exit fullscreen mode */
  exitFullscreen: () => void;

  /** Active content view mode within a pane (Grid, Timeline, or Graph) */
  viewMode: 'grid' | 'timeline' | 'graph';
  /** Set the active content view mode */
  setViewMode: (mode: 'grid' | 'timeline' | 'graph') => void;
  /** Cmd+K command palette open state */
  paletteOpen: boolean;
  /** Open the command palette */
  openPalette: () => void;
  /** Close the command palette */
  closePalette: () => void;
  /** Slug of the object currently open in the Vaul drawer (null when closed) */
  drawerSlug: string | null;
  /** Most recently viewed object slug/id opened in the drawer */
  lastViewedObjectSlug: string | null;
  /** Open the object detail drawer for the given slug */
  openDrawer: (slug: string) => void;
  /** Close the object detail drawer */
  closeDrawer: () => void;
  /** Object currently targeted by a right-click context menu (null when closed) */
  contextMenuTarget: { x: number; y: number; obj: RenderableObject } | null;
  /** Open the context menu anchored to screen position with the given object */
  openContextMenu: (x: number, y: number, obj: RenderableObject) => void;
  /** Close the context menu */
  closeContextMenu: () => void;
  /** Collected objects stashed for later synthesis */
  stashedObjects: RenderableObject[];
  /** Add an object to the shared stash */
  stashObject: (obj: RenderableObject) => void;
  /** Remove an object from the shared stash */
  unstashObject: (objectId: number) => void;
  /** Clear the shared stash */
  clearStash: () => void;
  /** Currently dragged component type ID from toolbox, or null */
  draggedComponent: string | null;
  /** Set the dragged component type ID (null to clear) */
  setDraggedComponent: (id: string | null) => void;
  /** Active manual connection draft */
  connectionDraft: {
    source: RenderableObject;
    target: RenderableObject | null;
  } | null;
  /** Start a manual connection flow from the given object */
  beginConnection: (obj: RenderableObject) => void;
  /** Select the target object for the pending connection */
  selectConnectionTarget: (obj: RenderableObject) => void;
  /** Cancel the pending manual connection */
  cancelConnection: () => void;
  /** Submit the pending manual connection */
  submitConnection: (input?: { edgeType?: string; reason?: string }) => Promise<void>;

  /** Set of selected PlacedItem/object IDs for multi-select */
  selectedItems: Set<string>;
  /** Add an item to the selection */
  selectItem: (id: string) => void;
  /** Toggle an item in/out of the selection */
  toggleSelectItem: (id: string) => void;
  /** Select all items (pass array of all IDs on the board) */
  selectAll: (ids: string[]) => void;
  /** Clear all selection */
  clearSelection: () => void;
  /** Replace selection with a single item */
  selectSingle: (id: string) => void;
  /** Replace selection with a set from rubber-band */
  selectRect: (ids: string[]) => void;
}

const NOOP = () => {};

const CommonPlaceContext = createContext<CommonPlaceContextValue>({
  captureVersion: 0,
  sidebarCollapsed: false,
  setSidebarCollapsed: NOOP,
  notifyCaptured: NOOP,
  mobileSidebarOpen: false,
  openMobileSidebar: NOOP,
  closeMobileSidebar: NOOP,
  toggleMobileSidebar: NOOP,
  activeScreen: 'library',
  navigateToScreen: NOOP,
  launchView: NOOP,
  exitScreen: NOOP,
  layout: LAYOUT_PRESETS[0].tree,
  setLayout: NOOP,
  focusedPaneId: null,
  setFocusedPaneId: NOOP,
  fullscreenPaneId: null,
  toggleFullscreen: NOOP,
  exitFullscreen: NOOP,
  viewMode: 'grid',
  setViewMode: NOOP,
  paletteOpen: false,
  openPalette: NOOP,
  closePalette: NOOP,
  drawerSlug: null,
  lastViewedObjectSlug: null,
  openDrawer: NOOP,
  closeDrawer: NOOP,
  contextMenuTarget: null,
  openContextMenu: NOOP,
  closeContextMenu: NOOP,
  stashedObjects: [],
  stashObject: NOOP,
  unstashObject: NOOP,
  clearStash: NOOP,
  draggedComponent: null,
  setDraggedComponent: NOOP,
  connectionDraft: null,
  beginConnection: NOOP,
  selectConnectionTarget: NOOP,
  cancelConnection: NOOP,
  submitConnection: async () => {},
  selectedItems: new Set<string>(),
  selectItem: NOOP,
  toggleSelectItem: NOOP,
  selectAll: NOOP,
  clearSelection: NOOP,
  selectSingle: NOOP,
  selectRect: NOOP,
});

function dedupeRenderableObjects(items: RenderableObject[]): RenderableObject[] {
  const seen = new Set<string>();
  const next: RenderableObject[] = [];

  for (const item of items) {
    const key = item.slug || String(item.id);
    if (seen.has(key)) continue;
    seen.add(key);
    next.push(item);
  }

  return next;
}

async function resolveObjectSlug(obj: RenderableObject): Promise<string> {
  if (obj.slug && obj.slug !== String(obj.id)) return obj.slug;
  const detail = await fetchObjectById(obj.id);
  return detail.slug;
}

const STORAGE_KEY = 'commonplace-layout-v6';

function loadPersistedLayout(): PaneNode | null {
  if (typeof window === 'undefined') return null;
  try {
    const json = localStorage.getItem(STORAGE_KEY);
    if (!json) return null;
    const layout = deserializeLayout(json);
    if (!layout) return null;
    if (shouldDiscardPersistedLayout(layout)) return null;
    return layout;
  } catch {
    return null;
  }
}

export function CommonPlaceProvider({ children }: { children: ReactNode }) {
  const [captureVersion, setCaptureVersion] = useState(0);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [activeScreen, setActiveScreen] = useState<ScreenType | null>('library');
  const [layout, setLayoutRaw] = useState<PaneNode>(
    () => loadPersistedLayout() ?? LAYOUT_PRESETS[0].tree,
  );
  const [focusedPaneId, setFocusedPaneId] = useState<string | null>(null);
  const [fullscreenPaneId, setFullscreenPaneId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'timeline' | 'graph'>('grid');
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [drawerSlug, setDrawerSlug] = useState<string | null>(null);
  const [lastViewedObjectSlug, setLastViewedObjectSlug] = useState<string | null>(null);
  const [contextMenuTarget, setContextMenuTarget] = useState<{
    x: number;
    y: number;
    obj: RenderableObject;
  } | null>(null);
  const [stashedObjects, setStashedObjects] = useState<RenderableObject[]>([]);
  const [draggedComponent, setDraggedComponent] = useState<string | null>(null);
  const [connectionDraft, setConnectionDraft] = useState<{
    source: RenderableObject;
    target: RenderableObject | null;
  } | null>(null);

  /* ── Multi-select ── */
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  const selectItem = useCallback((id: string) => {
    setSelectedItems((prev) => new Set(prev).add(id));
  }, []);

  const toggleSelectItem = useCallback((id: string) => {
    setSelectedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback((ids: string[]) => {
    setSelectedItems(new Set(ids));
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedItems(new Set());
  }, []);

  const selectSingle = useCallback((id: string) => {
    setSelectedItems(new Set([id]));
  }, []);

  const selectRect = useCallback((ids: string[]) => {
    setSelectedItems(new Set(ids));
  }, []);

  /* ── Layout persistence ── */
  const setLayout = useCallback(
    (updater: PaneNode | ((prev: PaneNode) => PaneNode)) => {
      setLayoutRaw((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater;
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
          } catch { /* quota exceeded: ignore */ }
        }
        return next;
      });
    },
    [],
  );

  /* ── Navigation: screens ── */
  const navigateToScreen = useCallback((screen: ScreenType) => {
    setActiveScreen(screen);
    setFullscreenPaneId(null);
  }, []);

  const exitScreen = useCallback(() => {
    setActiveScreen(null);
  }, []);

  /* ── Navigation: views (Smart Launch) ── */
  const launchView = useCallback(
    (viewId: ViewType, context?: Record<string, unknown>, forceNewPane?: boolean) => {
      // Exit any screen
      setActiveScreen(null);
      setFullscreenPaneId(null);

      setLayout((prev) => {
        // 1. Force new pane via shift+click
        if (forceNewPane && focusedPaneId) {
          return splitLeaf(prev, focusedPaneId, 'vertical', viewId);
        }

        // 2. If view already open in a pane, focus that pane
        const existing = findLeafWithView(prev, viewId);
        if (existing) {
          setFocusedPaneId(existing.id);
          return prev;
        }

        // 3. Single pane: replace its view
        const leaves = collectLeafIds(prev);
        if (leaves.length === 1) {
          return replaceView(prev, leaves[0], viewId, context);
        }

        // 4. Multiple panes: replace the focused pane
        const targetId = focusedPaneId && leaves.includes(focusedPaneId)
          ? focusedPaneId : leaves[0];
        return replaceView(prev, targetId, viewId, context);
      });
    },
    [focusedPaneId, setLayout],
  );

  /* ── Fullscreen ── */
  const toggleFullscreen = useCallback((paneId: string) => {
    setFullscreenPaneId((prev) => (prev === paneId ? null : paneId));
  }, []);

  const exitFullscreen = useCallback(() => {
    setFullscreenPaneId(null);
  }, []);

  /* ── Other callbacks ── */
  const notifyCaptured = useCallback(() => {
    setCaptureVersion((v) => v + 1);
  }, []);

  const openMobileSidebar = useCallback(() => setMobileSidebarOpen(true), []);
  const closeMobileSidebar = useCallback(() => setMobileSidebarOpen(false), []);
  const toggleMobileSidebar = useCallback(() => setMobileSidebarOpen((o) => !o), []);

  const openPalette = useCallback(() => setPaletteOpen(true), []);
  const closePalette = useCallback(() => setPaletteOpen(false), []);
  const openContextMenu = useCallback(
    (x: number, y: number, obj: RenderableObject) => setContextMenuTarget({ x, y, obj }),
    [],
  );
  const closeContextMenu = useCallback(() => setContextMenuTarget(null), []);
  const stashObject = useCallback((obj: RenderableObject) => {
    setStashedObjects((prev) => dedupeRenderableObjects([obj, ...prev]));
  }, []);
  const unstashObject = useCallback((objectId: number) => {
    setStashedObjects((prev) => prev.filter((item) => item.id !== objectId));
  }, []);
  const clearStash = useCallback(() => setStashedObjects([]), []);
  const beginConnection = useCallback((obj: RenderableObject) => {
    setConnectionDraft({ source: obj, target: null });
  }, []);
  const selectConnectionTarget = useCallback((obj: RenderableObject) => {
    setConnectionDraft((prev) => {
      if (!prev) return prev;
      return { ...prev, target: obj };
    });
  }, []);
  const cancelConnection = useCallback(() => setConnectionDraft(null), []);
  const submitConnection = useCallback(
    async (input?: { edgeType?: string; reason?: string }) => {
      if (!connectionDraft?.source || !connectionDraft.target) return;

      const sourceSlug = await resolveObjectSlug(connectionDraft.source);
      const targetSlug = await resolveObjectSlug(connectionDraft.target);

      await postObjectConnection(sourceSlug, {
        target_slug: targetSlug,
        edge_type: input?.edgeType || 'related',
        reason: input?.reason || '',
      });

      setConnectionDraft(null);
      setCaptureVersion((v) => v + 1);
    },
    [connectionDraft],
  );
  const openDrawer = useCallback((slug: string) => {
    setDrawerSlug(slug);
    setLastViewedObjectSlug(slug);
  }, []);
  const closeDrawer = useCallback(() => setDrawerSlug(null), []);

  const value = useMemo(
    () => ({
      captureVersion,
      sidebarCollapsed,
      setSidebarCollapsed,
      notifyCaptured,
      mobileSidebarOpen,
      openMobileSidebar,
      closeMobileSidebar,
      toggleMobileSidebar,
      activeScreen,
      navigateToScreen,
      launchView,
      exitScreen,
      layout,
      setLayout,
      focusedPaneId,
      setFocusedPaneId,
      fullscreenPaneId,
      toggleFullscreen,
      exitFullscreen,
      viewMode,
      setViewMode,
      paletteOpen,
      openPalette,
      closePalette,
      drawerSlug,
      lastViewedObjectSlug,
      openDrawer,
      closeDrawer,
      contextMenuTarget,
      openContextMenu,
      closeContextMenu,
      stashedObjects,
      stashObject,
      unstashObject,
      clearStash,
      draggedComponent,
      setDraggedComponent,
      connectionDraft,
      beginConnection,
      selectConnectionTarget,
      cancelConnection,
      submitConnection,
      selectedItems,
      selectItem,
      toggleSelectItem,
      selectAll,
      clearSelection,
      selectSingle,
      selectRect,
    }),
    [
      captureVersion,
      sidebarCollapsed,
      notifyCaptured,
      mobileSidebarOpen,
      openMobileSidebar,
      closeMobileSidebar,
      toggleMobileSidebar,
      activeScreen,
      navigateToScreen,
      launchView,
      exitScreen,
      layout,
      setLayout,
      focusedPaneId,
      fullscreenPaneId,
      toggleFullscreen,
      exitFullscreen,
      viewMode,
      paletteOpen,
      openPalette,
      closePalette,
      drawerSlug,
      lastViewedObjectSlug,
      openDrawer,
      closeDrawer,
      contextMenuTarget,
      openContextMenu,
      closeContextMenu,
      stashedObjects,
      stashObject,
      unstashObject,
      clearStash,
      draggedComponent,
      connectionDraft,
      beginConnection,
      selectConnectionTarget,
      cancelConnection,
      submitConnection,
      selectedItems,
    ],
  );

  return (
    <CommonPlaceContext.Provider value={value}>
      {children}
    </CommonPlaceContext.Provider>
  );
}

export function useCommonPlace(): CommonPlaceContextValue {
  return useContext(CommonPlaceContext);
}

/** Map active screen/view to its section color for the dot grid. */
export function getContextColor(activeScreen: string | null, viewType?: string): string {
  const key = activeScreen || viewType || 'library';
  switch (key) {
    case 'timeline':
    case 'network':
    case 'calendar':
    case 'loose-ends':
      return '#2D5F6B';  // teal
    case 'notebook':
    case 'notebooks':
    case 'project':
    case 'projects':
      return '#C49A4A';  // gold
    case 'connection-engine':
    case 'engine':
    case 'settings':
      return '#8B6FA0';  // purple
    case 'compose':
    case 'library':
    default:
      return '#B8623D';  // terracotta
  }
}
