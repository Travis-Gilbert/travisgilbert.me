'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ComposeSignal } from '@/lib/commonplace';
import {
  fetchComposeRelated,
  type ComposeLiveResponse,
  type ComposeLiveResult,
} from '@/lib/commonplace-api';

interface UseLiveResearchOptions {
  notebookSlug?: string;
  minScore?: number;
  enableNli?: boolean;
  passes?: ComposeSignal[];
}

interface UseLiveResearchReturn {
  results: ComposeLiveResult[];
  loading: boolean;
  paused: boolean;
  togglePause: () => void;
  activeSignals: string[];
  degraded: ComposeLiveResponse['degraded'];
}

interface CacheEntry {
  payload: ComposeLiveResponse;
  savedAt: number;
}

const DEBOUNCE_MS = 1200;
const CACHE_MAX = 5;
const CACHE_TTL_MS = 5 * 60 * 1000;

function stableHash(value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return hash.toString(36);
}

function buildCacheKey(text: string, options: UseLiveResearchOptions): string {
  return stableHash(
    JSON.stringify({
      text,
      notebookSlug: options.notebookSlug ?? '',
      minScore: options.minScore ?? 0.25,
      enableNli: !!options.enableNli,
      passes: options.passes ?? [],
    }),
  );
}

export function useLiveResearch(
  text: string,
  options: UseLiveResearchOptions = {},
): UseLiveResearchReturn {
  const [results, setResults] = useState<ComposeLiveResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [paused, setPaused] = useState(false);
  const [activeSignals, setActiveSignals] = useState<string[]>([]);
  const [degraded, setDegraded] = useState<ComposeLiveResponse['degraded']>({
    degraded: false,
    sbertUnavailable: false,
    kgeUnavailable: false,
    reasons: [],
  });

  const abortRef = useRef<AbortController | null>(null);
  const cacheRef = useRef<Map<string, CacheEntry>>(new Map());

  const normalizedText = useMemo(() => text.trim(), [text]);
  const cacheKey = useMemo(
    () => buildCacheKey(normalizedText, options),
    [normalizedText, options.enableNli, options.minScore, options.notebookSlug, options.passes],
  );

  const togglePause = useCallback(() => {
    setPaused((prev) => !prev);
  }, []);

  useEffect(() => {
    if (paused) return;
    if (normalizedText.length < 20) {
      setResults([]);
      setActiveSignals([]);
      setDegraded({
        degraded: false,
        sbertUnavailable: false,
        kgeUnavailable: false,
        reasons: [],
      });
      return;
    }

    const timer = setTimeout(async () => {
      const cached = cacheRef.current.get(cacheKey);
      const now = Date.now();
      if (cached && now - cached.savedAt < CACHE_TTL_MS) {
        setResults(cached.payload.results);
        setActiveSignals(cached.payload.passesRun);
        setDegraded(cached.payload.degraded);
        return;
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);
      try {
        const payload = await fetchComposeRelated({
          text: normalizedText,
          notebook_slug: options.notebookSlug,
          limit: 8,
          min_score: options.minScore ?? 0.25,
          enable_nli: options.enableNli ?? false,
          passes: options.passes,
          signal: controller.signal,
        });

        if (controller.signal.aborted) return;

        setResults(payload.results);
        setActiveSignals(payload.passesRun);
        setDegraded(payload.degraded);

        cacheRef.current.set(cacheKey, { payload, savedAt: now });
        if (cacheRef.current.size > CACHE_MAX) {
          const firstKey = cacheRef.current.keys().next().value;
          if (firstKey) cacheRef.current.delete(firstKey);
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        console.error('[useLiveResearch] query failed', err);
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
    };
  }, [cacheKey, normalizedText, options.enableNli, options.minScore, options.notebookSlug, options.passes, paused]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  return { results, loading, paused, togglePause, activeSignals, degraded };
}

