'use client';

import { useIsMobile } from '@/hooks/useIsMobile';

/**
 * Backward-compatible hook wrapper.
 *
 * New code should use `useIsMobile()` directly.
 */
export function useIsMobileViewport(): boolean {
  return useIsMobile();
}
