'use client';

import { createContext, useContext, useState, useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';
import type { RenderableObject } from '@/components/commonplace/objects/ObjectRenderer';
import { fetchObjectById, postObjectConnection } from '@/lib/commonplace-api';

async function resolveObjectSlug(obj: RenderableObject): Promise<string> {
  if (obj.slug && obj.slug !== String(obj.id)) return obj.slug;
  const detail = await fetchObjectById(obj.id);
  return detail.slug;
}

export interface SelectionContextValue {
  selectedItems: Set<string>;
  selectItem: (id: string) => void;
  toggleSelectItem: (id: string) => void;
  selectAll: (ids: string[]) => void;
  clearSelection: () => void;
  selectSingle: (id: string) => void;
  selectRect: (ids: string[]) => void;
  connectionDraft: { source: RenderableObject; target: RenderableObject | null } | null;
  beginConnection: (obj: RenderableObject) => void;
  selectConnectionTarget: (obj: RenderableObject) => void;
  cancelConnection: () => void;
  submitConnection: (input?: { edgeType?: string; reason?: string }) => Promise<void>;
}

const NOOP = () => {};

const SelectionContext = createContext<SelectionContextValue>({
  selectedItems: new Set<string>(),
  selectItem: NOOP,
  toggleSelectItem: NOOP,
  selectAll: NOOP,
  clearSelection: NOOP,
  selectSingle: NOOP,
  selectRect: NOOP,
  connectionDraft: null,
  beginConnection: NOOP,
  selectConnectionTarget: NOOP,
  cancelConnection: NOOP,
  submitConnection: async () => {},
});

export function SelectionProvider({
  children,
  onCaptured,
}: {
  children: ReactNode;
  onCaptured?: () => void;
}) {
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [connectionDraft, setConnectionDraft] = useState<{
    source: RenderableObject;
    target: RenderableObject | null;
  } | null>(null);

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
      onCaptured?.();
    },
    [connectionDraft, onCaptured],
  );

  const value = useMemo(
    () => ({
      selectedItems,
      selectItem,
      toggleSelectItem,
      selectAll,
      clearSelection,
      selectSingle,
      selectRect,
      connectionDraft,
      beginConnection,
      selectConnectionTarget,
      cancelConnection,
      submitConnection,
    }),
    [
      selectedItems,
      connectionDraft,
      beginConnection,
      selectConnectionTarget,
      cancelConnection,
      submitConnection,
    ],
  );

  return (
    <SelectionContext.Provider value={value}>
      {children}
    </SelectionContext.Provider>
  );
}

export function useSelection(): SelectionContextValue {
  return useContext(SelectionContext);
}
