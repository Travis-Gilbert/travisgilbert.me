/**
 * Shared ambient signal hook for Theseus VIE.
 *
 * Fuels the "eavesdropping on the machine" motion system (TransmissionLine,
 * AmbientGraphActivity, ProactiveIntel). Polls the backend on a slow cadence,
 * caches results at module scope so multiple consumers don't fan out their
 * own fetches, and exposes derived deltas so edge-formation animations can
 * fire only when the graph actually grew.
 *
 * Poll cadence: 60s. This is ambient texture, not a live dashboard.
 */

'use client';

import { useEffect, useState } from 'react';
import { getGraphWeather, getHypotheses } from '@/lib/theseus-api';
import type { GraphWeather, Hypothesis } from '@/lib/theseus-types';

const POLL_INTERVAL_MS = 60_000;

export interface AmbientSignal {
  weather: GraphWeather | null;
  hypotheses: Hypothesis[];
  /** Deltas since the previous poll. All zero on first load. */
  deltas: {
    objects: number;
    edges: number;
    clusters: number;
    tensions: number;
  };
  loaded: boolean;
}

interface CacheState extends AmbientSignal {
  lastFetchedAt: number;
  subscribers: Set<(signal: AmbientSignal) => void>;
  pollTimer: number | null;
}

const cache: CacheState = {
  weather: null,
  hypotheses: [],
  deltas: { objects: 0, edges: 0, clusters: 0, tensions: 0 },
  loaded: false,
  lastFetchedAt: 0,
  subscribers: new Set(),
  pollTimer: null,
};

function snapshot(): AmbientSignal {
  return {
    weather: cache.weather,
    hypotheses: cache.hypotheses,
    deltas: cache.deltas,
    loaded: cache.loaded,
  };
}

function broadcast() {
  const snap = snapshot();
  for (const fn of cache.subscribers) {
    fn(snap);
  }
}

async function fetchOnce() {
  const [weatherResult, hypResult] = await Promise.all([
    getGraphWeather(),
    getHypotheses(),
  ]);

  const nextWeather = weatherResult.ok ? weatherResult : null;
  const nextHypotheses = hypResult.ok ? hypResult.hypotheses : cache.hypotheses;

  if (nextWeather && cache.weather) {
    cache.deltas = {
      objects: Math.max(0, nextWeather.total_objects - cache.weather.total_objects),
      edges: Math.max(0, nextWeather.total_edges - cache.weather.total_edges),
      clusters: Math.max(0, nextWeather.total_clusters - cache.weather.total_clusters),
      tensions: Math.max(
        0,
        (nextWeather.tensions_active ?? 0) - (cache.weather.tensions_active ?? 0),
      ),
    };
  } else {
    cache.deltas = { objects: 0, edges: 0, clusters: 0, tensions: 0 };
  }

  cache.weather = nextWeather;
  cache.hypotheses = nextHypotheses;
  cache.loaded = true;
  cache.lastFetchedAt = Date.now();
  broadcast();
}

function ensurePolling() {
  if (cache.pollTimer !== null) return;
  cache.pollTimer = window.setInterval(() => {
    fetchOnce().catch(() => {
      /* silent: ambient signal, a missed poll is fine */
    });
  }, POLL_INTERVAL_MS);
}

function teardownPolling() {
  if (cache.pollTimer !== null) {
    window.clearInterval(cache.pollTimer);
    cache.pollTimer = null;
  }
}

/**
 * Subscribe to the ambient graph signal. Returns the current snapshot and
 * re-renders when the underlying cache updates.
 *
 * Multiple consumers share a single fetch loop. Unmounting the last
 * subscriber stops polling.
 */
export function useAmbientGraphSignal(): AmbientSignal {
  const [signal, setSignal] = useState<AmbientSignal>(() => snapshot());

  useEffect(() => {
    cache.subscribers.add(setSignal);

    // If this is the first subscriber, kick off the initial fetch + poll.
    if (cache.subscribers.size === 1) {
      fetchOnce().catch(() => {});
      ensurePolling();
    } else {
      // Late subscriber: hand over the current snapshot immediately.
      setSignal(snapshot());
    }

    return () => {
      cache.subscribers.delete(setSignal);
      if (cache.subscribers.size === 0) {
        teardownPolling();
      }
    };
  }, []);

  return signal;
}
