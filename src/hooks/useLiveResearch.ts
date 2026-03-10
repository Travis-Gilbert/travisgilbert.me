'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ApiComposePassState, ComposePassId } from '@/lib/commonplace';
import {
  fetchComposeRelated,
  type ComposeLiveResponse,
  type ComposeLiveResult,
} from '@/lib/commonplace-api';

interface UseLiveResearchOptions {
  notebookSlug?: string;
  minScore?: number;
  enableNli?: boolean;
  passes?: ComposePassId[];
}

interface UseLiveResearchReturn {
  results: ComposeLiveResult[];
  loading: boolean;
  paused: boolean;
  togglePause: () => void;
  activeSignals: string[];
  passStates: ApiComposePassState[];
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
  const [passStates, setPassStates] = useState<ApiComposePassState[]>([]);
  const [degraded, setDegraded] = useState<ComposeLiveResponse['degraded']>({
    degraded: false,
    sbertUnavailable: false,
    nliUnavailable: false,
    kgeUnavailable: false,
    reasons: [],
  });

  const abortRef = useRef<AbortController | null>(null);
  const cacheRef = useRef<Map<string, CacheEntry>>(new Map());

  const normalizedText = useMemo(() => text.trim(), [text]);
  const normalizedOptions = useMemo<UseLiveResearchOptions>(
    () => ({
      notebookSlug: options.notebookSlug,
      minScore: options.minScore,
      enableNli: options.enableNli,
      passes: options.passes,
    }),
    [options.enableNli, options.minScore, options.notebookSlug, options.passes],
  );
  const cacheKey = useMemo(
    () => buildCacheKey(normalizedText, normalizedOptions),
    [normalizedOptions, normalizedText],
  );

  const togglePause = useCallback(() => {
    setPaused((prev) => !prev);
  }, []);

  useEffect(() => {
    if (paused) return;
    if (normalizedText.length < 20) {
      setResults([]);
      setActiveSignals([]);
      setPassStates([]);
      setDegraded({
        degraded: false,
        sbertUnavailable: false,
        nliUnavailable: false,
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
        setPassStates(cached.payload.passStates);
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
          notebook_slug: normalizedOptions.notebookSlug,
          limit: 8,
          min_score: normalizedOptions.minScore ?? 0.25,
          enable_nli: normalizedOptions.enableNli ?? false,
          passes: normalizedOptions.passes,
          signal: controller.signal,
        });

        if (controller.signal.aborted) return;

        setResults(payload.results);
        setActiveSignals(payload.passesRun);
        setPassStates(payload.passStates);
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
  }, [cacheKey, normalizedOptions, normalizedText, paused]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  return {
    results,
    loading,
    paused,
    togglePause,
    activeSignals,
    passStates,
    degraded,
  };
}
