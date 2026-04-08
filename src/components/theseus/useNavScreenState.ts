'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import type { ScreenState } from '@/lib/galaxy/navPredictor';

const ROUTE_INDEX_MAP: Record<string, number> = {
  '/theseus':           0,
  '/theseus/ask':       0.25,
  '/theseus/library':   0.5,
  '/theseus/artifacts': 0.75,
  '/theseus/models':    1,
};

export interface NavScreenStateInputs {
  engineState?: 'idle' | 'reasoning' | 'constructing';
  visibleNodeCount?: number;
  activeTensionCount?: number;
  sessionDepth?: number;
  hasActiveQuery?: boolean;
  panelOpen?: 'none' | 'drawer' | 'detail';
}

/**
 * Collects a ScreenState snapshot for the nav predictor from current React
 * context. Inputs are optional: callers that don't know engine/panel state
 * can pass an empty object and the cold-start priors will still produce a
 * sensible button set.
 */
export function useNavScreenState(inputs: NavScreenStateInputs = {}): ScreenState {
  const pathname = usePathname() ?? '/theseus';
  const lastActionTimeRef = useRef<number | null>(null);
  const [scrollDepth, setScrollDepth] = useState(0);
  const [viewportWidth, setViewportWidth] = useState<number>(() =>
    typeof window === 'undefined' ? 1280 : window.innerWidth,
  );
  const [secondsSinceLastAction, setSecondsSinceLastAction] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    // Seed "last action" in an effect so render stays pure. Use a ref so
    // this doesn't trigger a cascading render.
    if (lastActionTimeRef.current === null) {
      lastActionTimeRef.current = Date.now();
    }

    const onScroll = () => {
      const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      setScrollDepth(Math.min(1, Math.max(0, window.scrollY / max)));
    };
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
    onScroll();
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onClick = () => {
      lastActionTimeRef.current = Date.now();
      setSecondsSinceLastAction(0);
    };
    document.addEventListener('click', onClick, true);
    // Tick once per second so predictions reflect idle time.
    const interval = window.setInterval(() => {
      const last = lastActionTimeRef.current;
      if (last !== null) {
        setSecondsSinceLastAction((Date.now() - last) / 1000);
      }
    }, 1000);
    return () => {
      document.removeEventListener('click', onClick, true);
      window.clearInterval(interval);
    };
  }, []);

  // Longest prefix match wins.
  let routeIndex = 0;
  for (const [path, idx] of Object.entries(ROUTE_INDEX_MAP)) {
    if (pathname.startsWith(path) && idx > routeIndex) {
      routeIndex = idx;
    }
  }

  const engineStateNum =
    inputs.engineState === 'constructing' ? 1
    : inputs.engineState === 'reasoning' ? 0.5
    : 0;

  const panelOpenNum =
    inputs.panelOpen === 'detail' ? 1
    : inputs.panelOpen === 'drawer' ? 0.5
    : 0;

  const viewportWidthBucket =
    viewportWidth < 768 ? 0
    : viewportWidth < 1024 ? 0.5
    : 1;

  return {
    routeIndex,
    engineState: engineStateNum,
    visibleNodeCount: Math.min(1, (inputs.visibleNodeCount ?? 0) / 200),
    activeTensionCount: Math.min(1, (inputs.activeTensionCount ?? 0) / 20),
    sessionDepth: Math.min(1, (inputs.sessionDepth ?? 0) / 10),
    timeSinceLastAction: Math.min(1, secondsSinceLastAction / 60),
    scrollDepth,
    hasActiveQuery: inputs.hasActiveQuery ? 1 : 0,
    panelOpen: panelOpenNum,
    viewportWidthBucket,
  };
}
