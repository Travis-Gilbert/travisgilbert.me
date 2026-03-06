'use client';

import { useSyncExternalStore } from 'react';

function getServerSnapshot() {
  return false;
}

function buildSubscribe(query: string) {
  return (onStoreChange: () => void) => {
    if (typeof window === 'undefined') {
      return () => {};
    }

    const media = window.matchMedia(query);
    const listener = () => onStoreChange();

    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', listener);
      return () => media.removeEventListener('change', listener);
    }

    media.addListener(listener);
    return () => media.removeListener(listener);
  };
}

function buildSnapshot(query: string) {
  return () => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(query).matches;
  };
}

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    buildSubscribe(query),
    buildSnapshot(query),
    getServerSnapshot,
  );
}
