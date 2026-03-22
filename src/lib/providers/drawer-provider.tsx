'use client';

import { createContext, useContext, useState, useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';
import type { RenderableObject } from '@/components/commonplace/objects/ObjectRenderer';

export interface DrawerContextValue {
  drawerSlug: string | null;
  lastViewedObjectSlug: string | null;
  openDrawer: (slug: string) => void;
  closeDrawer: () => void;
  readerObjectId: number | null;
  openReader: (objectId: number) => void;
  closeReader: () => void;
  contextMenuTarget: { x: number; y: number; obj: RenderableObject } | null;
  openContextMenu: (x: number, y: number, obj: RenderableObject) => void;
  closeContextMenu: () => void;
}

const NOOP = () => {};

const DrawerContext = createContext<DrawerContextValue>({
  drawerSlug: null,
  lastViewedObjectSlug: null,
  openDrawer: NOOP,
  closeDrawer: NOOP,
  readerObjectId: null,
  openReader: NOOP,
  closeReader: NOOP,
  contextMenuTarget: null,
  openContextMenu: NOOP,
  closeContextMenu: NOOP,
});

export function DrawerProvider({ children }: { children: ReactNode }) {
  const [drawerSlug, setDrawerSlug] = useState<string | null>(null);
  const [lastViewedObjectSlug, setLastViewedObjectSlug] = useState<string | null>(null);
  const [readerObjectId, setReaderObjectId] = useState<number | null>(null);
  const [contextMenuTarget, setContextMenuTarget] = useState<{
    x: number;
    y: number;
    obj: RenderableObject;
  } | null>(null);

  const openDrawer = useCallback((slug: string) => {
    setDrawerSlug(slug);
    setLastViewedObjectSlug(slug);
  }, []);
  const closeDrawer = useCallback(() => setDrawerSlug(null), []);
  const openReader = useCallback((objectId: number) => setReaderObjectId(objectId), []);
  const closeReader = useCallback(() => setReaderObjectId(null), []);
  const openContextMenu = useCallback(
    (x: number, y: number, obj: RenderableObject) => setContextMenuTarget({ x, y, obj }),
    [],
  );
  const closeContextMenu = useCallback(() => setContextMenuTarget(null), []);

  const value = useMemo(
    () => ({
      drawerSlug,
      lastViewedObjectSlug,
      openDrawer,
      closeDrawer,
      readerObjectId,
      openReader,
      closeReader,
      contextMenuTarget,
      openContextMenu,
      closeContextMenu,
    }),
    [
      drawerSlug,
      lastViewedObjectSlug,
      openDrawer,
      closeDrawer,
      readerObjectId,
      openReader,
      closeReader,
      contextMenuTarget,
      openContextMenu,
      closeContextMenu,
    ],
  );

  return (
    <DrawerContext.Provider value={value}>
      {children}
    </DrawerContext.Provider>
  );
}

export function useDrawer(): DrawerContextValue {
  return useContext(DrawerContext);
}
