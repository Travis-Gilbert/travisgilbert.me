'use client';

import { useCallback } from 'react';
import { useCommonPlace } from '@/lib/commonplace-context';
import type { RenderableObject } from './objects/ObjectRenderer';

export function useRenderableObjectAction(
  onOpenObject?: (obj: RenderableObject) => void,
) {
  const { connectionDraft, selectConnectionTarget } = useCommonPlace();

  return useCallback(
    (obj: RenderableObject) => {
      if (connectionDraft && !connectionDraft.target) {
        const sameObject =
          (connectionDraft.source.slug && obj.slug && connectionDraft.source.slug === obj.slug) ||
          connectionDraft.source.id === obj.id;

        if (!sameObject) {
          selectConnectionTarget(obj);
        }
        return;
      }

      onOpenObject?.(obj);
    },
    [connectionDraft, onOpenObject, selectConnectionTarget],
  );
}
