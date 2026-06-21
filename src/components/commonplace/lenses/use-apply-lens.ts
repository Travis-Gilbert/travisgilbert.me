'use client';

/**
 * The single apply-a-lens entry point. Drag-to-apply (toolbox) and the
 * per-object click affordance both call this, so there is one path from
 * "lens + object" to "lens open in a pane" (FR-002). Engine and attachment
 * lenses open the same way; attachment lenses persist on save inside the pane.
 */

import { useCallback } from 'react';
import { useLayout } from '@/lib/providers/layout-provider';
import { getLens } from '@/lib/commonplace-lenses';
import type { LensContext } from '@/lib/commonplace-lenses';

export interface LensTarget {
  objectRef: number;
  objectSlug: string;
  objectType: string;
  objectTitle: string;
}

export function useApplyLens() {
  const { launchView } = useLayout();
  return useCallback(
    (lensId: string, target: LensTarget): boolean => {
      if (!getLens(lensId) || !target.objectRef) return false;
      const ctx: LensContext = { lensId, ...target };
      launchView('lens', ctx as unknown as Record<string, unknown>, true);
      return true;
    },
    [launchView],
  );
}
