'use client';

/**
 * CommonPlaceContext: lightweight event bus for cross-component
 * communication within the CommonPlace route group.
 *
 * Primary use case: when a capture syncs successfully in the
 * sidebar, the timeline needs to refetch. The context provides
 * a `captureVersion` counter that increments on each successful
 * sync, and the timeline includes it in its useApiData deps.
 *
 * Architecture: the CommonPlace layout is a Server Component
 * that cannot hold state. This Client Component provider wraps
 * the layout's children so both CommonPlaceSidebar and
 * TimelineView (inside SplitPaneContainer) can share state.
 */

import { createContext, useContext, useState, useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';
import type { ViewType } from '@/lib/commonplace';

/** A request from the sidebar (or a list view) to open a pane tab */
export interface ViewRequest {
  viewType: ViewType;
  label?: string;
  context?: Record<string, unknown>;
}

interface CommonPlaceContextValue {
  /** Monotonically increasing counter; changes trigger timeline refetch */
  captureVersion: number;
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
  /** Sidebar or list view calls this to request a new pane tab */
  requestView: (viewType: ViewType, label?: string, context?: Record<string, unknown>) => void;
  /** SplitPaneContainer reads this and creates a tab, then clears it */
  pendingView: ViewRequest | null;
  /** Clear the pending view after consuming it */
  clearPendingView: () => void;
}

const CommonPlaceContext = createContext<CommonPlaceContextValue>({
  captureVersion: 0,
  notifyCaptured: () => {},
  mobileSidebarOpen: false,
  openMobileSidebar: () => {},
  closeMobileSidebar: () => {},
  toggleMobileSidebar: () => {},
  requestView: () => {},
  pendingView: null,
  clearPendingView: () => {},
});

export function CommonPlaceProvider({ children }: { children: ReactNode }) {
  const [captureVersion, setCaptureVersion] = useState(0);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [pendingView, setPendingView] = useState<ViewRequest | null>(null);

  const notifyCaptured = useCallback(() => {
    setCaptureVersion((v) => v + 1);
  }, []);

  const requestView = useCallback(
    (viewType: ViewType, label?: string, context?: Record<string, unknown>) => {
      setPendingView({ viewType, label, context });
    },
    [],
  );

  const clearPendingView = useCallback(() => {
    setPendingView(null);
  }, []);

  const openMobileSidebar = useCallback(() => {
    setMobileSidebarOpen(true);
  }, []);

  const closeMobileSidebar = useCallback(() => {
    setMobileSidebarOpen(false);
  }, []);

  const toggleMobileSidebar = useCallback(() => {
    setMobileSidebarOpen((open) => !open);
  }, []);

  const value = useMemo(
    () => ({
      captureVersion,
      notifyCaptured,
      mobileSidebarOpen,
      openMobileSidebar,
      closeMobileSidebar,
      toggleMobileSidebar,
      requestView,
      pendingView,
      clearPendingView,
    }),
    [
      captureVersion,
      notifyCaptured,
      mobileSidebarOpen,
      openMobileSidebar,
      closeMobileSidebar,
      toggleMobileSidebar,
      requestView,
      pendingView,
      clearPendingView,
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
