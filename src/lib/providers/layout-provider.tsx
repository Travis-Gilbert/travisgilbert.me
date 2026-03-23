'use client';

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

const STORAGE_KEY = 'commonplace-layout-v7';

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

export interface LayoutContextValue {
  layout: PaneNode;
  setLayout: (updater: PaneNode | ((prev: PaneNode) => PaneNode)) => void;
  focusedPaneId: string | null;
  setFocusedPaneId: (id: string | null) => void;
  fullscreenPaneId: string | null;
  toggleFullscreen: (paneId: string) => void;
  exitFullscreen: () => void;
  activeScreen: ScreenType | null;
  navigateToScreen: (screen: ScreenType) => void;
  launchView: (viewId: ViewType, context?: Record<string, unknown>, forceNewPane?: boolean) => void;
  exitScreen: () => void;
  resetLayout: () => void;
}

const NOOP = () => {};

const LayoutContext = createContext<LayoutContextValue>({
  layout: LAYOUT_PRESETS[0].tree,
  setLayout: NOOP,
  focusedPaneId: null,
  setFocusedPaneId: NOOP,
  fullscreenPaneId: null,
  toggleFullscreen: NOOP,
  exitFullscreen: NOOP,
  activeScreen: 'library',
  navigateToScreen: NOOP,
  launchView: NOOP,
  exitScreen: NOOP,
  resetLayout: NOOP,
});

export function LayoutProvider({ children }: { children: ReactNode }) {
  const [layout, setLayoutRaw] = useState<PaneNode>(
    () => loadPersistedLayout() ?? LAYOUT_PRESETS[0].tree,
  );
  const [focusedPaneId, setFocusedPaneId] = useState<string | null>(null);
  const [fullscreenPaneId, setFullscreenPaneId] = useState<string | null>(null);
  const [activeScreen, setActiveScreen] = useState<ScreenType | null>('library');

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

  const navigateToScreen = useCallback((screen: ScreenType) => {
    setActiveScreen(screen);
    setFullscreenPaneId(null);
  }, []);

  const exitScreen = useCallback(() => {
    setActiveScreen(null);
  }, []);

  const resetLayout = useCallback(() => {
    if (typeof window !== 'undefined') {
      try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    }
    setLayoutRaw(LAYOUT_PRESETS[0].tree);
    setFullscreenPaneId(null);
  }, []);

  const launchView = useCallback(
    (viewId: ViewType, context?: Record<string, unknown>, forceNewPane?: boolean) => {
      setActiveScreen(null);
      setFullscreenPaneId(null);

      setLayout((prev) => {
        if (forceNewPane && focusedPaneId) {
          return splitLeaf(prev, focusedPaneId, 'vertical', viewId);
        }

        const existing = findLeafWithView(prev, viewId);
        if (existing) {
          setFocusedPaneId(existing.id);
          return prev;
        }

        const leaves = collectLeafIds(prev);
        if (leaves.length === 1) {
          return replaceView(prev, leaves[0], viewId, context);
        }

        const targetId = focusedPaneId && leaves.includes(focusedPaneId)
          ? focusedPaneId : leaves[0];
        return replaceView(prev, targetId, viewId, context);
      });
    },
    [focusedPaneId, setLayout],
  );

  const toggleFullscreen = useCallback((paneId: string) => {
    setFullscreenPaneId((prev) => (prev === paneId ? null : paneId));
  }, []);

  const exitFullscreen = useCallback(() => {
    setFullscreenPaneId(null);
  }, []);

  const value = useMemo(
    () => ({
      layout,
      setLayout,
      focusedPaneId,
      setFocusedPaneId,
      fullscreenPaneId,
      toggleFullscreen,
      exitFullscreen,
      activeScreen,
      navigateToScreen,
      launchView,
      exitScreen,
      resetLayout,
    }),
    [
      layout,
      setLayout,
      focusedPaneId,
      fullscreenPaneId,
      toggleFullscreen,
      exitFullscreen,
      activeScreen,
      navigateToScreen,
      launchView,
      exitScreen,
      resetLayout,
    ],
  );

  return (
    <LayoutContext.Provider value={value}>
      {children}
    </LayoutContext.Provider>
  );
}

export function useLayout(): LayoutContextValue {
  return useContext(LayoutContext);
}
