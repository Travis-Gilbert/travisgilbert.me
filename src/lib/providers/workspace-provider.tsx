'use client';

import { createContext, useContext, useState, useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';
import type { RenderableObject } from '@/components/commonplace/objects/ObjectRenderer';

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

export interface WorkspaceContextValue {
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  mobileSidebarOpen: boolean;
  openMobileSidebar: () => void;
  closeMobileSidebar: () => void;
  toggleMobileSidebar: () => void;
  viewMode: 'grid' | 'timeline' | 'graph';
  setViewMode: (mode: 'grid' | 'timeline' | 'graph') => void;
  paletteOpen: boolean;
  openPalette: () => void;
  closePalette: () => void;
  stashedObjects: RenderableObject[];
  stashObject: (obj: RenderableObject) => void;
  unstashObject: (objectId: number) => void;
  clearStash: () => void;
  draggedComponent: string | null;
  setDraggedComponent: (id: string | null) => void;
}

const NOOP = () => {};

const WorkspaceContext = createContext<WorkspaceContextValue>({
  sidebarCollapsed: false,
  setSidebarCollapsed: NOOP,
  mobileSidebarOpen: false,
  openMobileSidebar: NOOP,
  closeMobileSidebar: NOOP,
  toggleMobileSidebar: NOOP,
  viewMode: 'grid',
  setViewMode: NOOP,
  paletteOpen: false,
  openPalette: NOOP,
  closePalette: NOOP,
  stashedObjects: [],
  stashObject: NOOP,
  unstashObject: NOOP,
  clearStash: NOOP,
  draggedComponent: null,
  setDraggedComponent: NOOP,
});

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'timeline' | 'graph'>('grid');
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [stashedObjects, setStashedObjects] = useState<RenderableObject[]>([]);
  const [draggedComponent, setDraggedComponent] = useState<string | null>(null);

  const openMobileSidebar = useCallback(() => setMobileSidebarOpen(true), []);
  const closeMobileSidebar = useCallback(() => setMobileSidebarOpen(false), []);
  const toggleMobileSidebar = useCallback(() => setMobileSidebarOpen((o) => !o), []);
  const openPalette = useCallback(() => setPaletteOpen(true), []);
  const closePalette = useCallback(() => setPaletteOpen(false), []);
  const stashObject = useCallback((obj: RenderableObject) => {
    setStashedObjects((prev) => dedupeRenderableObjects([obj, ...prev]));
  }, []);
  const unstashObject = useCallback((objectId: number) => {
    setStashedObjects((prev) => prev.filter((item) => item.id !== objectId));
  }, []);
  const clearStash = useCallback(() => setStashedObjects([]), []);

  const value = useMemo(
    () => ({
      sidebarCollapsed,
      setSidebarCollapsed,
      mobileSidebarOpen,
      openMobileSidebar,
      closeMobileSidebar,
      toggleMobileSidebar,
      viewMode,
      setViewMode,
      paletteOpen,
      openPalette,
      closePalette,
      stashedObjects,
      stashObject,
      unstashObject,
      clearStash,
      draggedComponent,
      setDraggedComponent,
    }),
    [
      sidebarCollapsed,
      mobileSidebarOpen,
      openMobileSidebar,
      closeMobileSidebar,
      toggleMobileSidebar,
      viewMode,
      paletteOpen,
      openPalette,
      closePalette,
      stashedObjects,
      stashObject,
      unstashObject,
      clearStash,
      draggedComponent,
    ],
  );

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace(): WorkspaceContextValue {
  return useContext(WorkspaceContext);
}
