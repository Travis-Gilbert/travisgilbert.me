'use client';

import { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
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

const SCREEN_HASHES: Record<string, ScreenType> = {
  '#daily': 'daily',
  '#library': 'library',
  '#models': 'models',
  '#notebooks': 'notebooks',
  '#projects': 'projects',
  '#engine': 'engine',
  '#settings': 'settings',
  '#settings-github-app': 'settings',
  '#chat': 'chat',
  '#code': 'code',
  '#accounts': 'accounts',
  '#cobrowser': 'cobrowser',
  '#coordination': 'coordination',
  '#receiver': 'receiver',
  '#desktop': 'desktop',
};

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

function screenFromHash(): ScreenType | null {
  if (typeof window === 'undefined') return null;
  return SCREEN_HASHES[window.location.hash] ?? null;
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
  activeScreen: 'daily',
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
  const [activeScreen, setActiveScreen] = useState<ScreenType | null>(() => screenFromHash() ?? 'daily');

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
    if (typeof window !== 'undefined') {
      const hash = Object.entries(SCREEN_HASHES).find(([, target]) => target === screen)?.[0];
      if (hash && window.location.hash !== hash) {
        window.history.replaceState(null, '', hash);
      }
    }
  }, []);

  useEffect(() => {
    function handleHashChange() {
      const screen = screenFromHash();
      if (screen) {
        setActiveScreen(screen);
        setFullscreenPaneId(null);
      }
    }

    window.addEventListener('hashchange', handleHashChange);
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
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
          return splitLeaf(prev, focusedPaneId, 'vertical', viewId, context);
        }

        const existing = findLeafWithView(prev, viewId);
        if (existing) {
          setFocusedPaneId(existing.id);
          return context
            ? replaceView(prev, existing.id, viewId, context)
            : prev;
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
