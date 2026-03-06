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

interface CommonPlaceContextValue {
  /** Monotonically increasing counter; changes trigger timeline refetch */
  captureVersion: number;
  /** Call after a capture successfully syncs to the API */
  notifyCaptured: () => void;
}

const CommonPlaceContext = createContext<CommonPlaceContextValue>({
  captureVersion: 0,
  notifyCaptured: () => {},
});

export function CommonPlaceProvider({ children }: { children: ReactNode }) {
  const [captureVersion, setCaptureVersion] = useState(0);

  const notifyCaptured = useCallback(() => {
    setCaptureVersion((v) => v + 1);
  }, []);

  const value = useMemo(
    () => ({ captureVersion, notifyCaptured }),
    [captureVersion, notifyCaptured],
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
