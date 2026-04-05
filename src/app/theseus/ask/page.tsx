'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { askTheseus } from '@/lib/theseus-api';
import type { ApiError } from '@/lib/theseus-api';
import type {
  DataAcquisitionSection,
  EvidencePathSection,
  NarrativeSection,
  ObjectsSection,
  TheseusObject,
  TheseusResponse,
} from '@/lib/theseus-types';
import type { DataProcessingStatus } from '@/lib/theseus-data/types';
import type { ColumnDescriptor, DataShape } from '@/lib/theseus-viz/SceneSpec';
import type { SceneDirective } from '@/lib/theseus-viz/SceneDirective';
import { directScene } from '@/lib/theseus-viz/SceneDirector';
import { buildObjectLookup } from '@/components/theseus/renderers/rendering';
import RenderRouter from '@/components/theseus/renderers/RenderRouter';
import ThinkingScreen from '@/components/theseus/ThinkingScreen';
import { useGalaxy } from '@/components/theseus/TheseusShell';
import { getModel } from '@/lib/theseus-storage';
import { useIsMobile } from '@/hooks/useIsMobile';

export type AskState = 'IDLE' | 'THINKING' | 'MODEL' | 'CONSTRUCTING' | 'EXPLORING';

interface ProcessedDataset {
  data: Record<string, unknown>[];
  dataShape: DataShape | null;
}

type QueryHistoryStatus = 'in-progress' | 'success' | 'error';

interface QueryHistoryEntry {
  query: string;
  status: QueryHistoryStatus;
  timestamp: number;
}

const HISTORY_STORAGE_KEY = 'theseus-query-history-v1';
const HISTORY_LIMIT = 10;
const ASK_TIMEOUT_MS = 20_000;
const DATA_ACQUISITION_TIMEOUT_MS = 12_000;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => reject(new Error(message)), timeoutMs);
    promise.then(
      (value) => {
        window.clearTimeout(timeoutId);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timeoutId);
        reject(error);
      },
    );
  });
}

function normalizeErrorMessage(error: ApiError): string {
  if (error.reason === 'timeout') {
    return 'Request timed out. The backend may be slow or unreachable.';
  }
  if (error.reason === 'network') {
    return 'Network error. Check your connection or backend availability.';
  }
  if (error.reason === 'http' && error.status >= 500) {
    return 'Backend unavailable right now. Try again in a moment.';
  }
  return error.message;
}

function isRawNarration(content: string): boolean {
  const normalized = content.toLowerCase();
  return normalized.includes('perspective(s):') || normalized.startsWith('the evidence reveals');
}

async function processDataAcquisition(
  section: DataAcquisitionSection,
  onStatus: (status: DataProcessingStatus) => void,
  signal: AbortSignal,
  timeoutMs: number,
): Promise<ProcessedDataset | null> {
  onStatus({ phase: 'initializing' });

  const { loadDataSource } = await import('@/lib/theseus-data/DataLoader');
  const { runQuery, toObjectArray } = await import('@/lib/theseus-data/QueryRunner');

  if (signal.aborted) return null;

  onStatus({
    phase: 'loading',
    source: section.sources.map((source) => source.table_name).join(', '),
    progress: { loaded_bytes: 0, total_bytes: 0 },
  });

  const loadResults = await Promise.all(
    section.sources.map((source) => withTimeout(
      loadDataSource(source, (progress) => {
        onStatus({ phase: 'loading', source: source.table_name, progress });
      }),
      timeoutMs,
      `Data source load timed out for ${source.table_name}`,
    )),
  );

  if (signal.aborted) return null;

  const loadError = loadResults.find((result): result is Exclude<typeof result, string> => typeof result !== 'string');
  if (loadError) {
    onStatus({ phase: 'error', message: loadError.message, fallback: section.fallback_description });
    return null;
  }

  onStatus({ phase: 'processing', query_index: 0, total: section.queries.length });
  const queryResults = await Promise.all(
    section.queries.map((sql) => withTimeout(
      runQuery(sql),
      timeoutMs,
      'Data query timed out while constructing the scene',
    )),
  );

  if (signal.aborted) return null;

  const queryError = queryResults.find((result): result is Exclude<typeof result, { columns: string[] }> => 'code' in result);
  if (queryError) {
    onStatus({ phase: 'error', message: queryError.message, fallback: section.fallback_description });
    return null;
  }

  const primaryResult = queryResults.find(
    (result): result is Exclude<typeof result, { code: string }> => !('code' in result) && result.row_count > 0,
  ) ?? queryResults[0];

  if (!primaryResult || 'code' in primaryResult) {
    onStatus({ phase: 'complete' });
    return { data: [], dataShape: null };
  }

  const dataset = toObjectArray(primaryResult);
  onStatus({ phase: 'complete' });

  return {
    data: dataset,
    dataShape: inferDataShape(primaryResult),
  };
}

function inferDataShape(result: {
  columns: string[];
  types: string[];
  rows: unknown[][];
  row_count: number;
}): DataShape {
  const columns: ColumnDescriptor[] = result.columns.map((columnName, index) => {
    const values = result.rows.map((row) => row[index]);
    const uniqueCount = new Set(values.map((value) => String(value ?? ''))).size;
    return {
      name: columnName,
      type: inferColumnType(columnName, result.types[index], values, uniqueCount),
      unique_count: uniqueCount,
    };
  });

  return {
    columns,
    row_count: result.row_count,
    has_geographic: columns.some((column) => column.type === 'geographic'),
    has_temporal: columns.some((column) => column.type === 'temporal'),
    has_categorical: columns.some((column) => column.type === 'categorical'),
    has_numeric: columns.some((column) => column.type === 'numeric'),
  };
}

function inferColumnType(
  name: string,
  sqlType: string,
  values: unknown[],
  uniqueCount: number,
): ColumnDescriptor['type'] {
  const normalizedName = name.toLowerCase();
  const normalizedType = sqlType.toLowerCase();

  if (
    normalizedName.includes('lat')
    || normalizedName.includes('lon')
    || normalizedName.includes('lng')
    || normalizedName.includes('latitude')
    || normalizedName.includes('longitude')
  ) {
    return 'geographic';
  }

  if (
    normalizedType.includes('date')
    || normalizedType.includes('time')
    || normalizedType.includes('timestamp')
  ) {
    return 'temporal';
  }

  if (
    normalizedType.includes('int')
    || normalizedType.includes('float')
    || normalizedType.includes('double')
    || normalizedType.includes('decimal')
    || normalizedType.includes('numeric')
  ) {
    return 'numeric';
  }

  const stringValues = values.filter((value): value is string => typeof value === 'string');
  const averageLength = stringValues.length === 0
    ? 0
    : stringValues.reduce((sum, value) => sum + value.length, 0) / stringValues.length;

  if (uniqueCount <= Math.max(20, Math.floor(values.length * 0.2))) {
    return 'categorical';
  }

  if (averageLength > 40) {
    return 'text';
  }

  return 'categorical';
}

function getNarratives(response: TheseusResponse): NarrativeSection[] {
  return response.sections.filter(
    (section): section is NarrativeSection => section.type === 'narrative',
  );
}

function getObjects(response: TheseusResponse): TheseusObject[] {
  return response.sections.find(
    (section): section is ObjectsSection => section.type === 'objects',
  )?.objects ?? [];
}


function getEvidencePath(response: TheseusResponse): EvidencePathSection | null {
  return response.sections.find(
    (section): section is EvidencePathSection => section.type === 'evidence_path',
  ) ?? null;
}

const RENDERER_LABELS: Record<string, string> = {
  'force-graph-3d': 'GRAPH',
  'particle-field': 'GRAPH',
  'sigma-2d': 'GRAPH 2D',
  d3: 'MAP',
  'vega-lite': 'CHART',
};

/** Graph-native targets are handled by the 2D GalaxyController, not RenderRouter */
function isGraphNativeTarget(directive: SceneDirective): boolean {
  const primary = directive.render_target.primary;
  return primary === 'particle-field' || primary === 'force-graph-3d';
}

function getConfidenceColor(value: number): string {
  if (value >= 0.6) return 'var(--vie-teal)';
  if (value >= 0.3) return 'var(--vie-amber)';
  return 'var(--vie-terra)';
}

function StaticScreen({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        textAlign: 'center',
        gap: 10,
      }}
    >
      <p
        style={{
          color: 'var(--vie-text)',
          fontFamily: 'var(--vie-font-title)',
          fontSize: '1.5rem',
          margin: 0,
        }}
      >
        {title}
      </p>
      {subtitle && (
        <p
          style={{
            color: 'var(--vie-text-dim)',
            fontFamily: 'var(--vie-font-mono)',
            fontSize: '0.8rem',
            margin: 0,
          }}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
}

function AskContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = searchParams.get('q');
  const savedId = searchParams.get('saved');
  const isMobile = useIsMobile();
  const { setAskState: pushState, setResponse: pushResponse, setDirective: pushDirective, setDataStatus: pushDataStatus, setVizPrediction: pushVizPrediction, argumentView, setArgumentView } = useGalaxy();

  const [state, setState] = useState<AskState>(query ? 'THINKING' : 'IDLE');
  const [response, setResponse] = useState<TheseusResponse | null>(null);
  const [sceneDirective, setSceneDirective] = useState<SceneDirective | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [narrationReady, setNarrationReady] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [dataStatus, setDataStatus] = useState<DataProcessingStatus | null>(null);
  const [savedSceneSpec, setSavedSceneSpec] = useState<import('@/lib/theseus-viz/SceneSpec').SceneSpec | null>(null);
  const [savedQuery, setSavedQuery] = useState<string | null>(null);
  const [composerQuery, setComposerQuery] = useState(query ?? '');
  const [queryHistory, setQueryHistory] = useState<QueryHistoryEntry[]>([]);
  const [retryNonce, setRetryNonce] = useState(0);

  const requestIdRef = useRef(0);
  const askAbortRef = useRef<AbortController | null>(null);

  const persistHistory = useCallback((nextHistory: QueryHistoryEntry[]) => {
    const trimmed = nextHistory.slice(0, HISTORY_LIMIT);
    setQueryHistory(trimmed);
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(trimmed));
    }
  }, []);

  const upsertHistory = useCallback((entry: QueryHistoryEntry) => {
    setQueryHistory((current) => {
      const next = [
        entry,
        ...current.filter((item) => item.query !== entry.query),
      ].slice(0, HISTORY_LIMIT);
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(next));
      }
      return next;
    });
  }, []);

  const markHistoryStatus = useCallback((entryQuery: string, status: QueryHistoryStatus) => {
    setQueryHistory((current) => {
      const next = current.map((item) => (
        item.query === entryQuery
          ? { ...item, status, timestamp: Date.now() }
          : item
      ));
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(next));
      }
      return next;
    });
  }, []);

  const navigateToQuery = useCallback((nextQuery: string) => {
    const trimmed = nextQuery.trim();
    if (!trimmed) return;

    if (trimmed === query) {
      setRetryNonce((current) => current + 1);
      return;
    }

    router.push(`/theseus/ask?q=${encodeURIComponent(trimmed)}`);
  }, [query, router]);

  const handleRetry = useCallback(() => {
    if (!query) return;
    setRetryNonce((current) => current + 1);
  }, [query]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const rawHistory = window.sessionStorage.getItem(HISTORY_STORAGE_KEY);
    if (!rawHistory) return;

    try {
      const parsed = JSON.parse(rawHistory) as QueryHistoryEntry[];
      if (Array.isArray(parsed)) {
        persistHistory(parsed.filter((item) => typeof item?.query === 'string' && item.query.trim().length > 0));
      }
    } catch {
      window.sessionStorage.removeItem(HISTORY_STORAGE_KEY);
    }
  }, [persistHistory]);

  useEffect(() => {
    if (!query) return;
    setComposerQuery(query);
  }, [query]);

  useEffect(() => {
    if (!query || savedId) return;
    upsertHistory({ query, status: 'in-progress', timestamp: Date.now() });
  }, [query, retryNonce, savedId, upsertHistory]);

  useEffect(() => {
    if (!response?.query) return;
    markHistoryStatus(response.query, 'success');
  }, [markHistoryStatus, response?.query]);

  useEffect(() => {
    if (!error || !query) return;
    markHistoryStatus(query, 'error');
  }, [error, markHistoryStatus, query]);

  useEffect(() => {
    if (!savedId) return;

    getModel(savedId).then((model) => {
      if (model) {
        setSavedSceneSpec(model.scene_spec);
        setSavedQuery(model.query);
        setState('EXPLORING');
        pushState('EXPLORING');
      }
    });
  }, [pushState, savedId]);

  useEffect(() => {
    askAbortRef.current?.abort();
    askAbortRef.current = null;

    if (!query || savedId) {
      return;
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    const controller = new AbortController();
    askAbortRef.current = controller;

    setNarrationReady(false);
    setSceneDirective(null);
    setSelectedNodeId(null);
    setResponse(null);
    pushResponse(null);
    pushDirective(null);
    pushVizPrediction(null);
    setDataStatus(null);
    pushDataStatus(null);
    setError(null);

    async function run() {
      const activeQuery = query;
      if (!activeQuery) return;

      const isStale = () => requestId !== requestIdRef.current || controller.signal.aborted;
      const pushDataStatusIfCurrent = (status: DataProcessingStatus) => {
        if (isStale()) return;
        setDataStatus(status);
        pushDataStatus(status);
      };

      setState('THINKING');
      pushState('THINKING');

      // Fire viz prediction in parallel: does not block the ask call
      import('@/lib/theseus-viz/vizPlanner').then(({ predictVizType }) => {
        predictVizType(activeQuery).then((prediction) => {
          if (isStale()) return;
          pushVizPrediction(prediction);
        }).catch(() => {});
      }).catch(() => {});

      const result = await askTheseus(activeQuery, {
        signal: controller.signal,
        timeoutMs: ASK_TIMEOUT_MS,
        retryPolicy: 'transient-once',
        include_web: true,
      });
      if (isStale()) return;

      if (!result.ok) {
        setError(result);
        pushDataStatusIfCurrent({ phase: 'error', message: normalizeErrorMessage(result), fallback: 'Try a shorter query or retry.' });
        setState('IDLE');
        pushState('IDLE');
        return;
      }

      setState('MODEL');
      pushState('MODEL');
      setResponse(result);
      pushResponse(result);

      const dataSection = result.sections.find(
        (section): section is DataAcquisitionSection => section.type === 'data_acquisition',
      );

      await new Promise((resolve) => window.setTimeout(resolve, 500));
      if (isStale()) return;

      setState('CONSTRUCTING');
      pushState('CONSTRUCTING');

      let processedDataset: ProcessedDataset | null = null;
      if (dataSection) {
        try {
          processedDataset = await processDataAcquisition(
            dataSection,
            pushDataStatusIfCurrent,
            controller.signal,
            DATA_ACQUISITION_TIMEOUT_MS,
          );
        } catch (processingError) {
          if (isStale()) return;
          const message = processingError instanceof Error
            ? processingError.message
            : 'Data acquisition failed while constructing the scene';
          pushDataStatusIfCurrent({ phase: 'error', message, fallback: dataSection.fallback_description });
          processedDataset = null;
        }
        if (isStale()) return;
      }

      const directive = await directScene(
        result,
        processedDataset?.data,
        processedDataset?.dataShape ?? null,
      );
      if (isStale()) return;

      setSceneDirective(directive);
      pushDirective(directive);

      // Train the classifier with the actual renderer so the KNN improves over time
      import('@/lib/theseus-viz/vizPlanner').then(({ trainFromFeedback, inferVizTypeFromRenderTarget }) => {
        const actualType = inferVizTypeFromRenderTarget(directive.render_target);
        trainFromFeedback(activeQuery, actualType).catch(() => {});
      }).catch(() => {});

      const focalNodeId = directive.salience.find((salience) => salience.is_focal)?.node_id;
      const firstObjectId = getObjects(result)[0]?.id ?? null;
      setSelectedNodeId(focalNodeId ?? firstObjectId);
      setState('EXPLORING');
      pushState('EXPLORING');
      pushDataStatusIfCurrent({ phase: 'complete' });
    }

    run().catch((runError) => {
      if (controller.signal.aborted || requestId !== requestIdRef.current) return;
      const message = runError instanceof Error ? runError.message : 'Unexpected error while constructing response';
      setError({ ok: false, status: 0, message, reason: 'network', transient: true });
      setState('IDLE');
      pushState('IDLE');
      setDataStatus({ phase: 'error', message, fallback: 'Try a shorter query or retry.' });
      pushDataStatus({ phase: 'error', message, fallback: 'Try a shorter query or retry.' });
    });

    return () => {
      controller.abort();
    };
  }, [pushDataStatus, pushDirective, pushResponse, pushState, query, retryNonce, savedId]);

  // When the 2D path is active (no RenderRouter), trigger narration after construction settles
  useEffect(() => {
    if (state !== 'EXPLORING' || !sceneDirective || !isGraphNativeTarget(sceneDirective)) return;
    const delay = sceneDirective.construction.total_duration_ms || 3000;
    const timeoutId = window.setTimeout(() => setNarrationReady(true), delay);
    return () => window.clearTimeout(timeoutId);
  }, [state, sceneDirective]);

  const objectLookup = useMemo(
    () => (response ? buildObjectLookup(response) : new Map<string, TheseusObject>()),
    [response],
  );

  const narratives = response ? getNarratives(response) : [];
  const evidencePath = response ? getEvidencePath(response) : null;
  const renderedNarratives = narratives.filter((narrative) => !isRawNarration(narrative.content));
  const showComposer = state === 'EXPLORING' || Boolean(error);
  const showHistory = showComposer && queryHistory.length > 0;

  const renderBottomDock = () => {
    if (!showComposer) return null;
    const activeQuery = response?.query ?? query ?? null;
    return (
      <div
        className="theseus-bottom-dock"
        style={{
          position: 'fixed',
          left: '50%',
          transform: 'translateX(-50%)',
          bottom: isMobile ? 'calc(16px + env(safe-area-inset-bottom))' : 16,
          width: isMobile ? 'min(480px, calc(100vw - 32px))' : 'min(640px, calc(100vw - 32px))',
          zIndex: 20,
          pointerEvents: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            navigateToQuery(composerQuery);
          }}
          style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}
        >
          <input
            className="theseus-ask-composer-input"
            type="text"
            name="follow_up_query"
            value={composerQuery}
            onChange={(event) => setComposerQuery(event.target.value)}
            placeholder="Ask a follow-up…"
            autoComplete="off"
            spellCheck={false}
            aria-label="Ask a follow-up question"
          />
          <button
            type="submit"
            className="theseus-ask-composer-submit"
            disabled={composerQuery.trim().length === 0}
          >
            Ask
          </button>
        </form>
        {(showHistory || (response?.follow_ups && response.follow_ups.length > 0)) && (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 6,
              maxHeight: 68,
              overflow: 'hidden',
            }}
          >
            {queryHistory.map((entry) => (
              <button
                key={entry.query}
                type="button"
                className={`theseus-ask-history-chip ${entry.query === activeQuery ? 'is-active' : ''} ${entry.status === 'error' ? 'is-error' : ''} ${entry.status === 'in-progress' ? 'is-in-progress' : ''}`}
                onClick={() => navigateToQuery(entry.query)}
                aria-label={`Load previous query: ${entry.query}`}
              >
                {entry.query.length > 48 ? `${entry.query.slice(0, 48)}…` : entry.query}
              </button>
            ))}
            {response?.follow_ups?.map((followUp, index) => (
              <button
                key={`fu-${index}`}
                type="button"
                className="theseus-ask-history-chip"
                onClick={() => navigateToQuery(followUp.query)}
              >
                {followUp.query.length > 48 ? `${followUp.query.slice(0, 48)}…` : followUp.query}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  if (state === 'IDLE' && !error) {
    return <StaticScreen title="No query provided" subtitle="Go back to the Theseus homepage and ask a question." />;
  }

  if (error) {
    return (
      <div style={{ position: 'relative', width: '100%', height: '100%' }}>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            placeItems: 'center',
            padding: 24,
            pointerEvents: 'auto',
          }}
        >
          <div
            style={{
              width: 'min(560px, 100%)',
              borderRadius: 18,
              border: '1px solid rgba(255,255,255,0.08)',
              background: 'rgba(15,16,18,0.76)',
              backdropFilter: 'blur(18px)',
              padding: '20px 22px',
              display: 'grid',
              gap: 14,
            }}
          >
            <h1
              style={{
                margin: 0,
                color: 'var(--vie-text)',
                fontFamily: 'var(--vie-font-title)',
                fontSize: '1.45rem',
              }}
            >
              Something went wrong
            </h1>
            <p
              style={{
                margin: 0,
                color: 'var(--vie-text-muted)',
                fontFamily: 'var(--vie-font-body)',
                fontSize: 14,
                lineHeight: 1.55,
              }}
            >
              {normalizeErrorMessage(error)}
            </p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={handleRetry}
                style={{
                  borderRadius: 10,
                  border: '1px solid rgba(74,138,150,0.28)',
                  background: 'rgba(74,138,150,0.12)',
                  color: 'var(--vie-teal-light)',
                  fontFamily: 'var(--vie-font-mono)',
                  fontSize: 11,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  padding: '9px 12px',
                  cursor: 'pointer',
                }}
              >
                Try again
              </button>
              <Link
                href="/theseus"
                style={{
                  borderRadius: 10,
                  border: '1px solid rgba(255,255,255,0.14)',
                  background: 'rgba(255,255,255,0.03)',
                  color: 'var(--vie-text)',
                  fontFamily: 'var(--vie-font-mono)',
                  fontSize: 11,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  padding: '9px 12px',
                  textDecoration: 'none',
                }}
              >
                Back to Theseus
              </Link>
              <Link
                href="/theseus/library"
                style={{
                  borderRadius: 10,
                  border: '1px solid rgba(255,255,255,0.14)',
                  background: 'rgba(255,255,255,0.03)',
                  color: 'var(--vie-text)',
                  fontFamily: 'var(--vie-font-mono)',
                  fontSize: 11,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  padding: '9px 12px',
                  textDecoration: 'none',
                }}
              >
                Open Library
              </Link>
            </div>
          </div>
        </div>
        {renderBottomDock()}
      </div>
    );
  }

  if (savedSceneSpec && savedId) {
    return (
      <StaticScreen
        title={savedQuery ?? 'Saved model'}
        subtitle={`Legacy model view: ${savedSceneSpec.nodes.length} nodes · ${Math.round(savedSceneSpec.confidence * 100)}% confidence`}
      />
    );
  }

  if (!response || !sceneDirective || state !== 'EXPLORING') {
    return <ThinkingScreen state={state} query={query} dataStatus={dataStatus} />;
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {isGraphNativeTarget(sceneDirective) ? null : (
        <RenderRouter
          directive={sceneDirective}
          response={response}
          onSelectNode={setSelectedNodeId}
          onCrystallizeComplete={() => setNarrationReady(true)}
        />
      )}

      <div
        style={{
          position: 'absolute',
          left: 20,
          top: 20,
          maxWidth: isMobile ? 'calc(100vw - 40px)' : 520,
          padding: '16px 18px',
          borderRadius: 18,
          background: 'rgba(15,16,18,0.66)',
          border: '1px solid rgba(255,255,255,0.08)',
          backdropFilter: 'blur(18px)',
          zIndex: 10,
          pointerEvents: 'auto' as const,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginBottom: 8,
            flexWrap: 'wrap',
          }}
        >
          <span
            style={{
              padding: '3px 10px',
              borderRadius: 999,
              background: 'rgba(74,138,150,0.12)',
              color: 'var(--vie-teal-light)',
              fontFamily: 'var(--vie-font-mono)',
              fontSize: 11,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            {RENDERER_LABELS[sceneDirective.render_target.primary] ?? sceneDirective.render_target.primary}
          </span>
          <span
            style={{
              color: 'var(--vie-text-dim)',
              fontFamily: 'var(--vie-font-mono)',
              fontSize: 11,
            }}
          >
            {objectLookup.size} nodes
          </span>
          <span style={{ color: 'var(--vie-text-dim)', fontFamily: 'var(--vie-font-mono)', fontSize: 11 }}>·</span>
          <span
            style={{
              color: getConfidenceColor(response.confidence.combined),
              fontFamily: 'var(--vie-font-mono)',
              fontSize: 11,
            }}
          >
            {Math.round(response.confidence.combined * 100)}% confidence
          </span>
        </div>

        <h1
          style={{
            margin: 0,
            color: 'var(--vie-text)',
            fontFamily: 'var(--vie-font-title)',
            fontSize: isMobile ? '1.25rem' : '1.55rem',
            lineHeight: 1.2,
          }}
        >
          {response.query}
        </h1>
      </div>

      {/* InsightPanel: response text with scoped pointer-events */}
      {narrationReady && renderedNarratives.length > 0 && (
        <div
          style={{
            position: 'absolute',
            left: 20,
            bottom: isMobile ? 'calc(90px + env(safe-area-inset-bottom))' : 140,
            width: isMobile ? 'calc(100vw - 40px)' : 300,
            maxHeight: 220,
            zIndex: 10,
            pointerEvents: 'none',
          }}
        >
          <div
            className="theseus-insight-panel"
            style={{
              padding: '14px 16px',
              borderRadius: 14,
              background: 'rgba(15,16,18,0.72)',
              border: '1px solid rgba(255,255,255,0.08)',
              backdropFilter: 'blur(18px)',
              pointerEvents: 'auto',
              overflowY: 'auto',
              maxHeight: 220,
            }}
          >
            <div style={{ display: 'grid', gap: 10 }}>
              {renderedNarratives.slice(0, 2).map((narrative, index) => (
                <p
                  key={`insight-${index}`}
                  style={{
                    margin: 0,
                    color: 'var(--vie-text)',
                    fontFamily: 'var(--vie-font-body)',
                    fontSize: 13,
                    lineHeight: 1.65,
                  }}
                >
                  {narrative.content}
                </p>
              ))}
            </div>

            {evidencePath && evidencePath.nodes.length >= 2 && (
              <button
                type="button"
                onClick={() => setArgumentView(!argumentView)}
                style={{
                  display: 'block',
                  marginTop: 10,
                  padding: 0,
                  border: 'none',
                  background: 'none',
                  color: 'var(--vie-teal-light)',
                  fontFamily: 'var(--vie-font-mono)',
                  fontSize: 11,
                  letterSpacing: '0.04em',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                {argumentView ? 'Back to answer' : 'Show me why you think that'}
              </button>
            )}
          </div>
        </div>
      )}
      {renderBottomDock()}
    </div>
  );
}

export default function TheseusAskPage() {
  return (
    <Suspense
      fallback={<StaticScreen title="Loading…" subtitle="Preparing Theseus." />}
    >
      <AskContent />
    </Suspense>
  );
}
