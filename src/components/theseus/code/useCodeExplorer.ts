'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type {
  CodeContextResult,
  CodeEntityType,
  CodeImpactResult,
  CodeSymbol,
  DriftTension,
  FixPattern,
  IngestRequest,
  IngestionStats,
} from '@/lib/theseus-types';
import {
  codeContext,
  codeDrift,
  codeImpact,
  getCodeSymbols,
  getFixPatterns,
  ingestCodebase,
  resolveDriftTension,
  submitFixPattern,
} from '@/lib/theseus-api';
import {
  MOCK_CONTEXT,
  MOCK_DRIFT,
  MOCK_IMPACT,
  MOCK_INGESTION_STATS,
  MOCK_PATTERNS,
  MOCK_SYMBOLS,
} from './mockCodeData';

type DriftAction = 'update_spec' | 'flag' | 'dismiss';

export interface CodeExplorerState {
  // Selection
  focalSymbol: string | null;
  setFocalSymbol: (name: string | null) => void;

  // Data
  symbols: CodeSymbol[];
  symbolsLoading: boolean;
  impact: CodeImpactResult | null;
  impactLoading: boolean;
  context: CodeContextResult | null;
  drift: DriftTension[];
  patterns: FixPattern[];

  // Filters
  languageFilter: string | null;
  setLanguageFilter: (lang: string | null) => void;
  entityTypeFilter: CodeEntityType | null;
  setEntityTypeFilter: (t: CodeEntityType | null) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;

  // Panels
  driftOpen: boolean;
  setDriftOpen: (open: boolean) => void;
  patternsOpen: boolean;
  setPatternsOpen: (open: boolean) => void;
  repoConnectOpen: boolean;
  setRepoConnectOpen: (open: boolean) => void;

  // Status
  isMock: boolean;
  lastIngestionStats: IngestionStats | null;
  error: string | null;

  // Actions
  refreshSymbols: () => Promise<void>;
  refreshImpact: () => Promise<void>;
  ingestRepo: (payload: IngestRequest) => Promise<IngestionStats | null>;
  resolveDrift: (id: string, action: DriftAction) => Promise<void>;
  submitPattern: (id: string) => Promise<boolean>;
}

/**
 * Single source of truth for CodeExplorer state.
 *
 * Handles URL param sync (?symbol=&mock=), debounced filter fetches,
 * and auto-open behaviour for drift/patterns panels.
 */
export function useCodeExplorer(): CodeExplorerState {
  const searchParams = useSearchParams();
  const isMock = useMemo(() => {
    const param = searchParams?.get('mock');
    return param === '1' || param === 'true';
  }, [searchParams]);

  const initialSymbol = searchParams?.get('symbol') ?? null;
  const initialIngestOpen = searchParams?.get('ingest') === '1';

  const [focalSymbol, setFocalSymbolState] = useState<string | null>(initialSymbol);
  const [symbols, setSymbols] = useState<CodeSymbol[]>([]);
  const [symbolsLoading, setSymbolsLoading] = useState(false);
  const [impact, setImpact] = useState<CodeImpactResult | null>(null);
  const [impactLoading, setImpactLoading] = useState(false);
  const [context, setContext] = useState<CodeContextResult | null>(null);
  const [drift, setDrift] = useState<DriftTension[]>([]);
  const [patterns, setPatterns] = useState<FixPattern[]>([]);

  const [languageFilter, setLanguageFilter] = useState<string | null>(null);
  const [entityTypeFilter, setEntityTypeFilter] = useState<CodeEntityType | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [driftOpen, setDriftOpen] = useState(false);
  const [patternsOpen, setPatternsOpen] = useState(false);
  const [repoConnectOpen, setRepoConnectOpen] = useState(initialIngestOpen);

  const [lastIngestionStats, setLastIngestionStats] = useState<IngestionStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  const symbolFetchAbortRef = useRef<AbortController | null>(null);
  const impactFetchAbortRef = useRef<AbortController | null>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setFocalSymbol = useCallback((name: string | null) => {
    setFocalSymbolState(name);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (name) {
        url.searchParams.set('symbol', name);
      } else {
        url.searchParams.delete('symbol');
      }
      window.history.replaceState({}, '', url.toString());
    }
  }, []);

  const refreshSymbols = useCallback(async () => {
    if (isMock) {
      const filtered = MOCK_SYMBOLS.filter((s) => {
        if (languageFilter && s.language !== languageFilter) return false;
        if (entityTypeFilter && s.entity_type !== entityTypeFilter) return false;
        if (searchQuery && !s.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
        return true;
      });
      setSymbols(filtered);
      return;
    }

    symbolFetchAbortRef.current?.abort();
    const controller = new AbortController();
    symbolFetchAbortRef.current = controller;

    setSymbolsLoading(true);
    setError(null);
    try {
      const result = await getCodeSymbols(
        {
          entityType: entityTypeFilter ?? undefined,
          language: languageFilter ?? undefined,
          search: searchQuery || undefined,
        },
        { signal: controller.signal },
      );
      if (result.ok) {
        setSymbols(result.symbols);
      } else if (result.reason !== 'aborted') {
        setError(result.message);
      }
    } finally {
      if (symbolFetchAbortRef.current === controller) {
        setSymbolsLoading(false);
      }
    }
  }, [isMock, languageFilter, entityTypeFilter, searchQuery]);

  const refreshImpact = useCallback(async () => {
    if (!focalSymbol) {
      setImpact(null);
      setContext(null);
      setPatterns([]);
      return;
    }

    if (isMock) {
      setImpact({ ...MOCK_IMPACT, target: focalSymbol });
      setContext(MOCK_CONTEXT);
      setPatterns(MOCK_PATTERNS);
      if (MOCK_PATTERNS.length > 0) setPatternsOpen(true);
      return;
    }

    impactFetchAbortRef.current?.abort();
    const controller = new AbortController();
    impactFetchAbortRef.current = controller;

    setImpactLoading(true);
    setError(null);
    try {
      const [impactRes, contextRes, patternsRes] = await Promise.all([
        codeImpact(focalSymbol, undefined, { signal: controller.signal }),
        codeContext(focalSymbol, { signal: controller.signal }),
        getFixPatterns(focalSymbol, { signal: controller.signal }),
      ]);

      if (impactRes.ok) setImpact(impactRes);
      else if (impactRes.reason !== 'aborted') setError(impactRes.message);

      if (contextRes.ok) setContext(contextRes);

      if (patternsRes.ok) {
        setPatterns(patternsRes.patterns);
        if (patternsRes.patterns.length > 0) setPatternsOpen(true);
      }
    } finally {
      if (impactFetchAbortRef.current === controller) {
        setImpactLoading(false);
      }
    }
  }, [focalSymbol, isMock]);

  const refreshDrift = useCallback(async () => {
    if (isMock) {
      setDrift(MOCK_DRIFT);
      if (MOCK_DRIFT.length > 0) setDriftOpen(true);
      return;
    }
    const result = await codeDrift('all');
    if (result.ok) {
      setDrift(result.tensions);
      if (result.tensions.length > 0) setDriftOpen(true);
    }
  }, [isMock]);

  const ingestRepo = useCallback(
    async (payload: IngestRequest): Promise<IngestionStats | null> => {
      if (isMock) {
        setLastIngestionStats(MOCK_INGESTION_STATS);
        await refreshSymbols();
        return MOCK_INGESTION_STATS;
      }
      const result = await ingestCodebase(payload, { timeoutMs: 120_000, retryPolicy: 'none' });
      if (result.ok) {
        setLastIngestionStats(result);
        await refreshSymbols();
        return result;
      }
      setError(result.message);
      return null;
    },
    [isMock, refreshSymbols],
  );

  const resolveDrift = useCallback(
    async (id: string, action: DriftAction) => {
      if (isMock) {
        setDrift((prev) => prev.filter((t) => t.id !== id));
        return;
      }
      const result = await resolveDriftTension(id, action);
      if (result.ok) {
        setDrift((prev) => prev.filter((t) => t.id !== id));
      } else {
        setError(result.message);
      }
    },
    [isMock],
  );

  const submitPattern = useCallback(
    async (id: string): Promise<boolean> => {
      if (isMock) {
        await new Promise((resolve) => setTimeout(resolve, 400));
        return true;
      }
      const result = await submitFixPattern(id);
      if (result.ok) return result.submitted;
      setError(result.message);
      return false;
    },
    [isMock],
  );

  // Initial symbol + drift fetch
  useEffect(() => {
    refreshSymbols();
    refreshDrift();
  }, [refreshSymbols, refreshDrift]);

  // Debounced search / filter refetch
  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      refreshSymbols();
    }, 200);
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [searchQuery, languageFilter, entityTypeFilter, refreshSymbols]);

  // Impact refetch on focal change
  useEffect(() => {
    refreshImpact();
  }, [refreshImpact]);

  return {
    focalSymbol,
    setFocalSymbol,
    symbols,
    symbolsLoading,
    impact,
    impactLoading,
    context,
    drift,
    patterns,
    languageFilter,
    setLanguageFilter,
    entityTypeFilter,
    setEntityTypeFilter,
    searchQuery,
    setSearchQuery,
    driftOpen,
    setDriftOpen,
    patternsOpen,
    setPatternsOpen,
    repoConnectOpen,
    setRepoConnectOpen,
    isMock,
    lastIngestionStats,
    error,
    refreshSymbols,
    refreshImpact,
    ingestRepo,
    resolveDrift,
    submitPattern,
  };
}
