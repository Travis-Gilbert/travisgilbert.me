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
import SourceTrail from '@/components/theseus/SourceTrail';
import { getModel } from '@/lib/theseus-storage';
import { useIsMobile } from '@/hooks/useIsMobile';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { VoiceControls } from '@/components/ask/VoiceControls';
import SpatialPanel from '@/components/ask/SpatialPanel';
import { shouldBePanel, computeAnchor } from '@/lib/galaxy/SpatialConversation';

// 8-dot circular braille frames. These have full octant dot density
// and read as a rotating filled disc — visually unmistakable as a
// spinner, unlike the sparse 6-dot braille characters which look like
// thin vertical lines and disappear at small sizes.
const BRAILLE_FRAMES = ['⣾', '⣽', '⣻', '⢿', '⡿', '⣟', '⣯', '⣷'];

/**
 * Single DOM node that holds the user's query string from the moment
 * they submit until the answer settles. Travels between three positions
 * (hidden / centered above the dock / top-left header) via transform
 * and font-size transitions, never unmounting. This is the perceptual
 * spine of the thinking-to-answer transition.
 */
function TravelingQuery({
  text,
  stage,
  isMobile,
  prefersReducedMotion,
}: {
  text: string;
  stage: 'hidden' | 'centered' | 'header';
  isMobile: boolean;
  prefersReducedMotion: boolean;
}) {
  const isHeader = stage === 'header';
  const isCentered = stage === 'centered';
  const isVisible = stage !== 'hidden';
  const transition = prefersReducedMotion
    ? 'none'
    : [
      'top 700ms cubic-bezier(0.32, 0.72, 0.24, 1.04)',
      'left 700ms cubic-bezier(0.32, 0.72, 0.24, 1.04)',
      'right 700ms cubic-bezier(0.32, 0.72, 0.24, 1.04)',
      'bottom 700ms cubic-bezier(0.32, 0.72, 0.24, 1.04)',
      'transform 700ms cubic-bezier(0.32, 0.72, 0.24, 1.04)',
      'font-size 700ms cubic-bezier(0.32, 0.72, 0.24, 1.04)',
      'max-width 700ms ease',
      'padding 500ms ease',
      'background-color 500ms ease',
      'border-color 500ms ease',
      'opacity 300ms ease',
    ].join(', ');

  return (
    <div
      style={{
        position: 'fixed',
        top: isHeader ? (isMobile ? 60 : 72) : 'auto',
        left: isHeader ? (isMobile ? 20 : 38) : '50%',
        bottom: isHeader ? 'auto' : (isMobile ? 150 : 158),
        transform: isHeader ? 'none' : 'translateX(-50%)',
        maxWidth: isHeader ? (isMobile ? 'calc(100vw - 40px)' : 540) : 'min(560px, calc(100vw - 48px))',
        fontSize: isHeader ? (isMobile ? '1.25rem' : '1.55rem') : '15px',
        color: 'var(--vie-text)',
        fontFamily: isHeader ? 'var(--vie-font-title)' : 'var(--vie-font-body)',
        lineHeight: isHeader ? 1.2 : 1.5,
        textAlign: isHeader ? 'left' : 'center',
        margin: 0,
        // Subtle backdrop card while the query is in its centered
        // (THINKING) stage so the text isn't bare floating against
        // the canvas. In header position the AnswerMetaCard provides
        // the visual anchor, so this element stays transparent.
        padding: isCentered ? '12px 22px' : 0,
        background: isCentered ? 'rgba(15, 16, 18, 0.62)' : 'transparent',
        border: isCentered ? '1px solid rgba(255, 255, 255, 0.06)' : '1px solid transparent',
        borderRadius: 14,
        backdropFilter: isCentered ? 'blur(18px)' : 'none',
        WebkitBackdropFilter: isCentered ? 'blur(18px)' : 'none',
        boxShadow: isCentered ? '0 4px 24px rgba(0, 0, 0, 0.28)' : 'none',
        pointerEvents: 'none',
        zIndex: 12,
        opacity: isVisible ? 1 : 0,
        transition,
      }}
    >
      {text}
    </div>
  );
}

// Visual constants for the search-box-to-spinner morph. These are
// referenced by both AskDock (the morphing element itself) and
// AnswerMetaCard (which blooms from the morph's screen position when
// the answer arrives).
const DOCK_INPUT_WIDTH_DESKTOP = 480;
const DOCK_INPUT_WIDTH_MOBILE = 440;
const DOCK_INPUT_HEIGHT = 56;
const DOCK_INPUT_RADIUS = 18;
const DOCK_SPINNER_SIZE = 88;
const DOCK_BOTTOM_OFFSET = 16;
const MORPH_DURATION_MS = 600;
const MORPH_EASING = 'cubic-bezier(0.32, 0.72, 0.24, 1.04)';

/**
 * Persistent search-and-history dock at the bottom of the viewport.
 * Renders for every state (IDLE / THINKING / MODEL / CONSTRUCTING /
 * EXPLORING / error) instead of being mounted and unmounted.
 *
 * The morph: when a query is in flight (submitting=true), the inner
 * `.theseus-ask-morph` element physically reshapes from a 480x56 pill
 * into an 88x88 circle by animating width, height, and border-radius
 * on a single element. Two children stack inside it via CSS Grid:
 * the input form contents (fade out fast) and the braille spinner
 * (fade in slightly later). The dock wrapper itself is now pure
 * positioning with no chrome — all visual chrome lives on the
 * morph element so the chrome is what reshapes.
 */
function AskDock({
  composerQuery,
  setComposerQuery,
  navigateToQuery,
  submitting,
  isIdle,
  isMobile,
  prefersReducedMotion,
  mouthOpenRef,
  queryHistory,
  followUps,
  activeQuery,
  onLoadHistory,
  spinnerFrame,
}: {
  composerQuery: string;
  setComposerQuery: (value: string) => void;
  navigateToQuery: (value: string) => void;
  submitting: boolean;
  isIdle: boolean;
  isMobile: boolean;
  prefersReducedMotion: boolean;
  mouthOpenRef: React.MutableRefObject<number>;
  queryHistory: QueryHistoryEntry[];
  followUps?: TheseusResponse['follow_ups'];
  activeQuery: string | null;
  onLoadHistory: (query: string) => void;
  spinnerFrame: number;
}) {
  const showHistory = !submitting && queryHistory.length > 0;
  const inputWidth = isMobile ? DOCK_INPUT_WIDTH_MOBILE : DOCK_INPUT_WIDTH_DESKTOP;

  const morphTransition = prefersReducedMotion
    ? 'none'
    : [
      `width ${MORPH_DURATION_MS}ms ${MORPH_EASING}`,
      `height ${MORPH_DURATION_MS}ms ${MORPH_EASING}`,
      `border-radius ${MORPH_DURATION_MS}ms ${MORPH_EASING}`,
      'background 400ms ease',
      'border-color 400ms ease',
      'box-shadow 400ms ease',
    ].join(', ');
  const inputLayerTransition = prefersReducedMotion
    ? 'none'
    : 'opacity 220ms ease';
  // Spinner fades in after the input contents have started fading out
  // and the container has begun its shape change. The 280ms delay is
  // tuned so the spinner appears at roughly 50% of the morph travel,
  // which is when the container is small enough that the spinner
  // glyph fits comfortably inside it.
  const spinnerLayerTransition = prefersReducedMotion
    ? 'none'
    : 'opacity 320ms ease 280ms';

  return (
    <div
      className="theseus-bottom-dock-wrapper"
      style={{
        position: 'fixed',
        left: '50%',
        transform: 'translateX(-50%)',
        bottom: isMobile ? `calc(${DOCK_BOTTOM_OFFSET}px + env(safe-area-inset-bottom))` : DOCK_BOTTOM_OFFSET,
        zIndex: 20,
        pointerEvents: 'auto',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 10,
        // Wrapper has no visual chrome — the morph element below carries
        // the background, border, and blur that used to be on
        // .theseus-bottom-dock. Override the legacy CSS class chrome
        // explicitly so we don't double up.
        background: 'transparent',
        border: 'none',
        backdropFilter: 'none',
        borderRadius: 0,
        padding: 0,
      }}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          navigateToQuery(composerQuery);
        }}
        style={{
          // Override the .theseus-bottom-dock form CSS so the form
          // hugs the morph element instead of stretching to 100% width.
          display: 'block',
          width: 'auto',
          padding: 0,
        }}
      >
        <div
          className="theseus-ask-morph"
          style={{
            position: 'relative',
            display: 'grid',
            gridTemplateAreas: '"stack"',
            placeItems: 'center',
            // The morph: pill (input) ↔ circle (spinner). One element,
            // one transition, three properties moving in sync.
            width: submitting ? DOCK_SPINNER_SIZE : inputWidth,
            height: submitting ? DOCK_SPINNER_SIZE : DOCK_INPUT_HEIGHT,
            borderRadius: submitting ? '50%' : DOCK_INPUT_RADIUS,
            // Submitting background: dark center with a teal-tinted
            // outer ring. The dark center provides contrast for the
            // bright spinner glyph that sits in the middle of the
            // grid stack; the teal ring picks up the morph's border
            // colour for a soft halo.
            background: submitting
              ? 'radial-gradient(circle, rgba(15,16,18,0.92) 0%, rgba(15,16,18,0.78) 55%, rgba(74,138,150,0.18) 100%)'
              : 'rgba(15, 16, 18, 0.76)',
            border: submitting
              ? '1px solid rgba(74,138,150,0.30)'
              : '1px solid rgba(255, 255, 255, 0.08)',
            // Glow on the submitting state intentionally subtle: a
            // single soft outer shadow without a second outline ring.
            boxShadow: submitting
              ? '0 0 14px rgba(74,138,150,0.10)'
              : '0 4px 24px rgba(0,0,0,0.25)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            overflow: 'hidden',
            transition: morphTransition,
          }}
        >
          {/* Layer 1: input contents. Positioned absolutely so its
              fixed inputWidth (440-480px) does NOT enforce a column
              width on the parent grid. Without this, the grid auto-
              sizes to 440px and the spinner layer ends up centered in
              the wrong place when the morph collapses to 88px. With
              absolute positioning, the input keeps its full width
              but is removed from the morph's grid track sizing. */}
          <div
            style={{
              gridArea: 'stack',
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              width: inputWidth,
              height: DOCK_INPUT_HEIGHT,
              padding: '0 16px',
              boxSizing: 'border-box',
              opacity: submitting ? 0 : 1,
              pointerEvents: submitting ? 'none' : 'auto',
              transition: inputLayerTransition,
            }}
          >
            <VoiceControls
              onInterimTranscript={(text: string) => setComposerQuery(text)}
              onFinalTranscript={(text: string) => {
                setComposerQuery(text);
                if (text.trim().length > 0) navigateToQuery(text);
              }}
              onAmplitude={isIdle ? (amp: number) => { mouthOpenRef.current = amp; } : undefined}
            />
            <input
              className="theseus-ask-composer-input"
              type="text"
              name={isIdle ? 'query' : 'follow_up_query'}
              value={composerQuery}
              onChange={(event) => setComposerQuery(event.target.value)}
              placeholder={isIdle ? 'Ask Theseus anything...' : 'Ask a follow-up…'}
              autoComplete="off"
              spellCheck={false}
              aria-label={isIdle ? 'Ask Theseus a question' : 'Ask a follow-up question'}
              autoFocus={isIdle}
            />
            <button
              type="submit"
              className="theseus-ask-composer-submit"
              disabled={composerQuery.trim().length === 0 || submitting}
            >
              Ask
            </button>
          </div>

          {/* Layer 2: spinner contents. Fades in once the morph has
              progressed enough that the container is small enough to
              read as a focal disc. */}
          <div
            aria-hidden={!submitting}
            style={{
              gridArea: 'stack',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: submitting ? 1 : 0,
              pointerEvents: 'none',
              transition: spinnerLayerTransition,
            }}
          >
            <span
              style={{
                fontFamily: 'var(--vie-font-mono)',
                fontSize: 52,
                lineHeight: 1,
                // Brighter than var(--vie-teal-light) #4A8A96 so the
                // glyph reads against the dark center of the morph
                // gradient. The text-shadow gives it the slight glow
                // that used to live on the morph's box-shadow.
                color: '#9FD4DC',
                textShadow: '0 0 12px rgba(74,138,150,0.55), 0 0 4px rgba(159,212,220,0.35)',
              }}
            >
              {BRAILLE_FRAMES[spinnerFrame]}
            </span>
          </div>
        </div>
      </form>

      {(showHistory || (followUps && followUps.length > 0)) && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: 6,
            maxWidth: inputWidth,
            maxHeight: 68,
            overflow: 'hidden',
            opacity: submitting ? 0 : 1,
            transition: prefersReducedMotion ? 'none' : 'opacity 300ms ease',
            pointerEvents: submitting ? 'none' : 'auto',
          }}
        >
          {queryHistory.map((entry) => (
            <button
              key={entry.query}
              type="button"
              className={`theseus-ask-history-chip ${entry.query === activeQuery ? 'is-active' : ''} ${entry.status === 'error' ? 'is-error' : ''} ${entry.status === 'in-progress' ? 'is-in-progress' : ''}`}
              onClick={() => onLoadHistory(entry.query)}
              aria-label={`Load previous query: ${entry.query}`}
            >
              {entry.query.length > 48 ? `${entry.query.slice(0, 48)}…` : entry.query}
            </button>
          ))}
          {followUps?.map((followUp, index) => (
            <button
              key={`fu-${index}`}
              type="button"
              className="theseus-ask-history-chip"
              onClick={() => onLoadHistory(followUp.query)}
            >
              {followUp.query.length > 48 ? `${followUp.query.slice(0, 48)}…` : followUp.query}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

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
const ASK_TIMEOUT_MS = 60_000;
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
  const prefersReducedMotion = usePrefersReducedMotion();
  const { setAskState: pushState, setResponse: pushResponse, setDirective: pushDirective, setDataStatus: pushDataStatus, setVizPrediction: pushVizPrediction, argumentView, setArgumentView, sourceTrail, clearSourceTrail, mouthOpenRef } = useGalaxy();

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
  const [spinnerFrame, setSpinnerFrame] = useState(0);

  // Drive the spinner glyph at 12.5fps while the dock is in submitting
  // mode. Single shared interval so multiple spinners stay in sync.
  const submitting = state !== 'IDLE' && state !== 'EXPLORING' && !error;
  useEffect(() => {
    if (!submitting || prefersReducedMotion) return;
    const id = window.setInterval(() => {
      setSpinnerFrame((prev) => (prev + 1) % BRAILLE_FRAMES.length);
    }, 80);
    return () => window.clearInterval(id);
  }, [submitting, prefersReducedMotion]);

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

  // TODO: re-highlight the dot when a trail card is clicked
  const handleTrailSelect = useCallback((_objectId: string) => {}, []);

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
      clearSourceTrail();

      // Fire viz prediction in parallel: does not block the ask call
      import('@/lib/theseus-viz/vizPlanner').then(({ predictVizType }) => {
        predictVizType(activeQuery).then((prediction) => {
          if (isStale()) return;
          pushVizPrediction(prediction);
        }).catch(() => {});
      }).catch(() => {});

      // Run e4b vision classification in parallel (frontend keyword classifier)
      // This warms vision models speculatively based on query signals
      import('@/lib/galaxy/e4bVision').then(({ classify, needsImageSearch }) => {
        const classification = classify(activeQuery);
        if (isStale()) return;
        if (needsImageSearch(classification.answer_type)) {
          // Pre-warm vision models for image-based answer types
          import('@/lib/galaxy/modelLoader').then(({ getFaceModel }) => {
            getFaceModel().catch(() => {});
          }).catch(() => {});
        }
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

      if (result.answer_type) {
        const answerType = result.answer_type;
        import('@/lib/theseus-viz/vizPlanner').then(({ resolveVizTypeFromBackend }) => {
          if (isStale()) return;
          pushVizPrediction(resolveVizTypeFromBackend(answerType));
        }).catch(() => {});
      }

      setState('MODEL');
      pushState('MODEL');
      setResponse(result);
      pushResponse(result);

      const dataSection = result.sections.find(
        (section): section is DataAcquisitionSection => section.type === 'data_acquisition',
      );

      // Yield one frame so React commits the MODEL render before we
      // flip to CONSTRUCTING. The previous 500ms hard wait was dead air;
      // a single rAF is enough to let the state machine breathe.
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
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
  }, [clearSourceTrail, pushDataStatus, pushDirective, pushResponse, pushState, query, retryNonce, savedId]);

  // When the 2D path is active (no RenderRouter), the dot field's
  // construction is already running by the time we reach EXPLORING.
  // Mark narration ready immediately so the SpatialPanel can bloom in
  // alongside the answer card. The previous 3000ms hard delay made the
  // text appear long after the visual answer had settled.
  useEffect(() => {
    if (state !== 'EXPLORING' || !sceneDirective || !isGraphNativeTarget(sceneDirective)) return;
    setNarrationReady(true);
  }, [state, sceneDirective]);

  const objectLookup = useMemo(
    () => (response ? buildObjectLookup(response) : new Map<string, TheseusObject>()),
    [response],
  );

  const narratives = response ? getNarratives(response) : [];
  const evidencePath = response ? getEvidencePath(response) : null;
  const renderedNarratives = narratives.filter((narrative) => !isRawNarration(narrative.content));

  const activeQuery = response?.query ?? query ?? null;
  const renderBottomDock = () => (
    <AskDock
      composerQuery={composerQuery}
      setComposerQuery={setComposerQuery}
      navigateToQuery={navigateToQuery}
      submitting={submitting}
      isIdle={state === 'IDLE' && !error}
      isMobile={isMobile}
      prefersReducedMotion={prefersReducedMotion}
      mouthOpenRef={mouthOpenRef}
      queryHistory={queryHistory}
      followUps={response?.follow_ups}
      activeQuery={activeQuery}
      onLoadHistory={navigateToQuery}
      spinnerFrame={spinnerFrame}
    />
  );

  // The saved-model legacy view is rare and stands alone with no
  // transition affordances; keep it as an early return.
  if (savedSceneSpec && savedId) {
    return (
      <StaticScreen
        title={savedQuery ?? 'Saved model'}
        subtitle={`Legacy model view: ${savedSceneSpec.nodes.length} nodes · ${Math.round(savedSceneSpec.confidence * 100)}% confidence`}
      />
    );
  }

  // Compute the traveling-query stage from the engine state. The query
  // text lives in a single DOM node that morphs between three positions
  // so the user's eye never loses it during the thinking-to-answer
  // transition.
  const isExploring = state === 'EXPLORING' && Boolean(response) && Boolean(sceneDirective);
  const queryStage: 'hidden' | 'centered' | 'header' = error
    ? 'hidden'
    : state === 'IDLE'
      ? 'hidden'
      : isExploring
        ? 'header'
        : 'centered';
  const travelingQueryText = isExploring && response ? response.query : (query ?? '');

  // The non-graph-native renderer (D3, Vega, Sigma) only mounts once we
  // have a directive. The graph-native path is drawn directly on the
  // galaxy canvas by GalaxyController and needs no React mount here.
  const showRenderRouter = isExploring && sceneDirective && !isGraphNativeTarget(sceneDirective);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {showRenderRouter && sceneDirective && response && (
        <RenderRouter
          directive={sceneDirective}
          response={response}
          onSelectNode={setSelectedNodeId}
          onCrystallizeComplete={() => setNarrationReady(true)}
        />
      )}

      {/* Answer meta card: blooms in from the spinner location when we
          enter EXPLORING. The query string itself is owned by
          TravelingQuery and lands just below this card. */}
      {isExploring && response && sceneDirective && (
        <AnswerMetaCard
          rendererLabel={RENDERER_LABELS[sceneDirective.render_target.primary] ?? sceneDirective.render_target.primary}
          nodeCount={objectLookup.size}
          confidenceColor={getConfidenceColor(response.confidence.combined)}
          confidencePercent={Math.round(response.confidence.combined * 100)}
          isMobile={isMobile}
          prefersReducedMotion={prefersReducedMotion}
        />
      )}

      {/* Persistent traveling query string. One DOM node, three
          positions, no unmount. */}
      <TravelingQuery
        text={travelingQueryText}
        stage={queryStage}
        isMobile={isMobile}
        prefersReducedMotion={prefersReducedMotion}
      />

      {/* Status overlay: simple "thinking…" line below the centered
          query while a request is in flight. ThinkingScreen no longer
          owns the query text or the spinner; it is just a small
          status row. */}
      {submitting && (
        <ThinkingScreen state={state} query={null} dataStatus={dataStatus} />
      )}

      {/* Source trail: accumulated explored sources, visible only when
          exploring and the user has clicked into sources. */}
      {isExploring && sourceTrail.length > 0 && (
        <div
          style={{
            position: 'absolute',
            left: 20,
            top: 130,
            maxWidth: isMobile ? 'calc(100vw - 40px)' : 480,
            zIndex: 10,
            pointerEvents: 'none',
          }}
        >
          <SourceTrail
            items={sourceTrail}
            onSelect={handleTrailSelect}
          />
        </div>
      )}

      {/* Spatial response panel: anchored near the focal node cluster.
          narrationReady is now set the instant we transition to
          EXPLORING (the old 3000ms hard delay was removed). */}
      {isExploring && response && narrationReady && renderedNarratives.length > 0 && (() => {
        const narrativeText = renderedNarratives.slice(0, 2).map((n) => n.content).join('\n\n');
        const usePanel = shouldBePanel(narrativeText) || !isMobile;
        const anchor = isMobile
          ? { x: 20, y: window.innerHeight - 260 }
          : computeAnchor([], window.innerWidth, window.innerHeight);

        if (!usePanel) {
          return (
            <div
              style={{
                position: 'absolute',
                left: 20,
                bottom: 'calc(90px + env(safe-area-inset-bottom))',
                width: 'calc(100vw - 40px)',
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
                  background: 'var(--vie-surface-panel)',
                  border: '1px solid var(--vie-surface-panel-border)',
                  backdropFilter: 'blur(18px)',
                  pointerEvents: 'auto',
                  overflowY: 'auto',
                  maxHeight: 220,
                }}
              >
                <p style={{ margin: 0, color: 'var(--vie-text)', fontFamily: 'var(--vie-font-body)', fontSize: 13, lineHeight: 1.65 }}>
                  {narrativeText}
                </p>
              </div>
            </div>
          );
        }

        return (
          <SpatialPanel
            anchorX={anchor.x}
            anchorY={anchor.y}
            text={narrativeText + (
              evidencePath && evidencePath.nodes.length >= 2
                ? '\n\n' + (argumentView ? '[Back to answer]' : '[Show me why you think that]')
                : ''
            )}
            complete={true}
          />
        );
      })()}

      {/* Error overlay: rendered as a centered modal with the dock
          still visible underneath, instead of replacing the whole UI. */}
      {error && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            placeItems: 'center',
            padding: 24,
            pointerEvents: 'auto',
            zIndex: 15,
          }}
        >
          <div
            style={{
              width: 'min(560px, 100%)',
              borderRadius: 18,
              border: '1px solid var(--vie-surface-panel-border)',
              background: 'var(--vie-surface-panel)',
              backdropFilter: 'blur(18px)',
              padding: '20px 22px',
              display: 'grid',
              gap: 14,
            }}
          >
            <h1 style={{ margin: 0, color: 'var(--vie-text)', fontFamily: 'var(--vie-font-title)', fontSize: '1.45rem' }}>
              Something went wrong
            </h1>
            <p style={{ margin: 0, color: 'var(--vie-text-muted)', fontFamily: 'var(--vie-font-body)', fontSize: 14, lineHeight: 1.55 }}>
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
      )}

      {renderBottomDock()}
    </div>
  );
}

/**
 * Top-left meta card that holds the renderer label, node count, and
 * confidence. Blooms from a point near the bottom-center spinner
 * location when EXPLORING is first reached so the answer feels like
 * it's emerging from the spinner rather than popping into existence.
 */
function AnswerMetaCard({
  rendererLabel,
  nodeCount,
  confidenceColor,
  confidencePercent,
  isMobile,
  prefersReducedMotion,
}: {
  rendererLabel: string;
  nodeCount: number;
  confidenceColor: string;
  confidencePercent: number;
  isMobile: boolean;
  prefersReducedMotion: boolean;
}) {
  const [bloomed, setBloomed] = useState(false);

  // Always go through requestAnimationFrame so the initial paint shows
  // the start state and the next frame triggers the transition.
  // Reduced-motion is handled by gating the transition itself below
  // (transition: none), not by skipping rAF — that would call setState
  // synchronously inside an effect, which is now a lint error.
  useEffect(() => {
    const id = window.requestAnimationFrame(() => setBloomed(true));
    return () => window.cancelAnimationFrame(id);
  }, []);

  // Bloom from the morph circle at the bottom of the dock. The circle
  // is DOCK_SPINNER_SIZE wide (88px), centered horizontally at 50vw,
  // with its bottom edge at DOCK_BOTTOM_OFFSET above the viewport
  // bottom. The card resting position is top:20 / left:20 with
  // transformOrigin: center center, so the start transform is the
  // delta needed to put the card's center at the morph circle's
  // center, scaled down to roughly the morph circle's size.
  const restingTransform = 'translate(0px, 0px) scale(1)';
  // Card width at rest: ~540 desktop, ~calc(100vw - 40px) mobile.
  // Card height at rest: ~50px after padding.
  // Card center at rest: (20 + cardWidth/2, 20 + 25)
  // Morph circle center: (50vw, 100vh - DOCK_BOTTOM_OFFSET - 44 - 1)
  // Translation reads in screen coordinates (translate before scale).
  const startTransform = isMobile
    ? `translate(calc(50vw - 50vw), calc(100vh - 95px)) scale(0.18)`
    : `translate(calc(50vw - 290px), calc(100vh - 105px)) scale(0.16)`;

  return (
    <div
      style={{
        position: 'absolute',
        left: 20,
        top: 20,
        maxWidth: isMobile ? 'calc(100vw - 40px)' : 540,
        padding: '14px 18px',
        borderRadius: 18,
        background: 'var(--vie-surface-panel)',
        border: '1px solid var(--vie-surface-panel-border)',
        backdropFilter: 'blur(18px)',
        zIndex: 10,
        pointerEvents: 'auto' as const,
        transformOrigin: 'center center',
        transform: bloomed ? restingTransform : startTransform,
        opacity: bloomed ? 1 : 0,
        transition: prefersReducedMotion
          ? 'none'
          : 'transform 700ms cubic-bezier(0.32, 0.72, 0.24, 1.04), opacity 500ms ease',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
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
          {rendererLabel}
        </span>
        <span
          style={{
            color: 'var(--vie-text-dim)',
            fontFamily: 'var(--vie-font-mono)',
            fontSize: 11,
          }}
        >
          {nodeCount} nodes
        </span>
        <span style={{ color: 'var(--vie-text-dim)', fontFamily: 'var(--vie-font-mono)', fontSize: 11 }}>·</span>
        <span
          style={{
            color: confidenceColor,
            fontFamily: 'var(--vie-font-mono)',
            fontSize: 11,
          }}
        >
          {confidencePercent}% confidence
        </span>
      </div>
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
