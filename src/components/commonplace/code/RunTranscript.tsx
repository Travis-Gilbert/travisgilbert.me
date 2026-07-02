'use client';

/**
 * RunTranscript (HANDOFF-CODE-SURFACE-UI D4): one virtualized monospace
 * trace block per run, fed by two merged sources:
 *   (a) the run record's events array (real events written by the dispatch
 *       flow in ConversationColumn), and
 *   (b) live SSE via subscribeRunEvents(run.runId) when the desktop runtime
 *       is paired (store.runtimeAvailable) and the run has a backend id.
 * SSE events are appended into the same run record through upsertRun, so
 * both sources land in one ordered stream and survive remounts.
 *
 * Stop semantics: no backend stop seam exists in this deployment (verified:
 * src/lib/theorem-agent.ts and src/app/api expose no cancel endpoint, and
 * the desktop runtime client has no run-stop verb), so stop marks the local
 * record Stopped, ceases SSE, and labels the state "stopped (local)". It
 * never pretends a backend was stopped.
 */

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Square } from 'lucide-react';
import { subscribeRunEvents } from '@/lib/commonplace-runtime';
import { useCodeSurfaceStore } from '@/lib/code-surface-store';
import {
  commonPlaceCodeRunElapsedMs,
  formatCodeElapsed,
  type CommonPlaceCodeDiffCard,
  type CommonPlaceCodeRunRecord,
  type CommonPlaceCodeRunState,
} from '@/lib/commonplace-code';

const LOCAL_STOP_LABEL = 'stopped (local)';

/* ------------------------------------------------------------------ */
/* Module-level SSE subscription manager. One subscription per run for  */
/* the lifetime of the page; events persist in the store, so component  */
/* remounts (active block -> settled assistant turn) never re-subscribe */
/* and never duplicate events.                                          */
/* ------------------------------------------------------------------ */

const subscribedRuns = new Set<string>();
const activeAborts = new Map<string, () => void>();

function ensureRunSubscription(localRunId: string, backendRunId: string): void {
  if (subscribedRuns.has(localRunId)) return;
  subscribedRuns.add(localRunId);
  let counter = 0;

  const abort = subscribeRunEvents(
    backendRunId,
    (event) => {
      const store = useCodeSurfaceStore.getState();
      const run = store.runs.find((item) => item.id === localRunId);
      if (!run) return;
      if (run.state === 'stopped') {
        releaseRunSubscription(localRunId);
        return;
      }
      counter += 1;
      store.upsertRun(applyRuntimeEvent(run, event, `${localRunId}_sse_${counter}`));
    },
    () => {
      activeAborts.delete(localRunId);
    },
  );
  activeAborts.set(localRunId, abort);
}

function releaseRunSubscription(localRunId: string): void {
  const abort = activeAborts.get(localRunId);
  if (abort) abort();
  activeAborts.delete(localRunId);
}

type RuntimeEvent = Parameters<Parameters<typeof subscribeRunEvents>[1]>[0];

function applyRuntimeEvent(
  run: CommonPlaceCodeRunRecord,
  event: RuntimeEvent,
  eventId: string,
): CommonPlaceCodeRunRecord {
  const createdAt = event.at || new Date().toISOString();

  if (event.kind === 'trace') {
    return {
      ...run,
      events: [...run.events, { id: eventId, kind: 'trace', label: event.line, createdAt }],
    };
  }

  if (event.kind === 'obligation') {
    return {
      ...run,
      events: [
        ...run.events,
        { id: eventId, kind: 'trace', label: `obligation: ${event.label}`, createdAt },
      ],
    };
  }

  if (event.kind === 'status') {
    const nextState = runStateFromRuntime(event.state);
    const terminal = nextState === 'done' || nextState === 'failed' || nextState === 'stopped';
    return {
      ...run,
      state: nextState ?? run.state,
      endedAt: terminal ? run.endedAt ?? createdAt : run.endedAt,
      events: [
        ...run.events,
        { id: eventId, kind: 'status', label: event.state, detail: event.detail, createdAt },
      ],
    };
  }

  // diff: append the event line and merge the per-file card by path.
  const card: CommonPlaceCodeDiffCard = {
    path: event.path,
    added: event.added,
    removed: event.removed,
    summary: event.summary,
  };
  const existing = run.diffs.findIndex((item) => item.path === event.path);
  const diffs =
    existing >= 0
      ? run.diffs.map((item, index) => (index === existing ? card : item))
      : [...run.diffs, card];
  return {
    ...run,
    diffs,
    events: [
      ...run.events,
      {
        id: eventId,
        kind: 'diff',
        label: event.path,
        detail: `+${event.added} -${event.removed}${event.summary ? ` ${event.summary}` : ''}`,
        createdAt,
      },
    ],
  };
}

function runStateFromRuntime(state: string): CommonPlaceCodeRunState | null {
  const normalized = state.trim().toLowerCase();
  if (
    normalized === 'queued' ||
    normalized === 'running' ||
    normalized === 'done' ||
    normalized === 'failed' ||
    normalized === 'stopped'
  ) {
    return normalized;
  }
  return null;
}

/**
 * Stop a run locally: cease SSE and mark the record Stopped with an honest
 * "stopped (local)" status event. Exported so the conversation composer's
 * cancel control shares the exact same semantics.
 */
export function stopRunLocally(localRunId: string): void {
  releaseRunSubscription(localRunId);
  const store = useCodeSurfaceStore.getState();
  const run = store.runs.find((item) => item.id === localRunId);
  if (!run) return;
  if (run.state === 'done' || run.state === 'failed' || run.state === 'stopped') return;
  const endedAt = new Date().toISOString();
  store.upsertRun({
    ...run,
    state: 'stopped',
    endedAt,
    events: [
      ...run.events,
      {
        id: `${localRunId}_stop_local`,
        kind: 'status',
        label: LOCAL_STOP_LABEL,
        detail:
          'No backend stop endpoint is reachable from this deployment; the local record stopped and event listening ceased.',
        createdAt: endedAt,
      },
    ],
  });
}

/* ------------------------------------------------------------------ */
/* Component                                                            */
/* ------------------------------------------------------------------ */

const FIXTURE_LINE_COUNT = 1_000;

export function RunTranscript({ runId }: { runId: string }) {
  const run = useCodeSurfaceStore((s) => s.runs.find((item) => item.id === runId) ?? null);
  const runtimeAvailable = useCodeSurfaceStore((s) => s.runtimeAvailable);
  const [now, setNow] = useState(() => Date.now());
  const [fixtureLines, setFixtureLines] = useState<string[] | null>(null);
  const parentRef = useRef<HTMLDivElement | null>(null);

  const isLive = run?.state === 'queued' || run?.state === 'running';

  // Elapsed timer ticks each second while the run is live.
  useEffect(() => {
    if (!isLive) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [isLive]);

  // Live SSE merge: only when the runtime is paired and a backend id exists.
  const backendRunId = run?.runId;
  useEffect(() => {
    if (!isLive || !runtimeAvailable || !backendRunId) return;
    ensureRunSubscription(runId, backendRunId);
  }, [runId, backendRunId, runtimeAvailable, isLive]);

  // Terminal states release the subscription (events already persisted).
  useEffect(() => {
    if (run && !isLive) releaseRunSubscription(runId);
  }, [run, isLive, runId]);

  // Dev-only fixture driver: 1000 synthetic lines, always announced as
  // fixture data in the status line (the never-fake rule).
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    if (typeof window === 'undefined') return;
    if (new URLSearchParams(window.location.search).get('cpCodeFixture') !== '1') return;
    setFixtureLines(
      Array.from(
        { length: FIXTURE_LINE_COUNT },
        (_, index) =>
          `fixture ${String(index + 1).padStart(4, '0')} synthetic trace line for virtualization smoke`,
      ),
    );
  }, []);

  const traceLines =
    fixtureLines ??
    (run
      ? run.events
          .filter((event) => event.kind === 'trace' || event.kind === 'status')
          .map((event) => formatEventLine(event.createdAt, event.label, event.detail))
      : []);

  const virtualizer = useVirtualizer({
    count: traceLines.length,
    getScrollElement: () => parentRef.current,
    // Single mono line estimate; measureElement corrects per row. A raw
    // number is unavoidable here: it is virtualizer math, not a style.
    estimateSize: () => 18,
    overscan: 12,
  });

  if (!run) return null;

  const elapsed = formatCodeElapsed(commonPlaceCodeRunElapsedMs(run, now));
  const stateText = describeRunState(run);

  return (
    <div style={{ marginTop: 'var(--space-2)' }}>
      <style precedence="default" href="cp-code-run-transcript">{PULSE_CSS}</style>

      {/* Inline status line: not a box. */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
          fontFamily: 'var(--font-mono)',
          fontSize: 'var(--text--1)',
          color: 'var(--text-dim)',
          minHeight: 'var(--space-6)',
        }}
      >
        <span
          aria-hidden
          className={isLive ? 'cp-code-run-dot cp-code-run-dot--live' : 'cp-code-run-dot'}
          style={{
            width: 'var(--space-2)',
            height: 'var(--space-2)',
            borderRadius: '50%',
            flexShrink: 0,
            background: isLive ? 'var(--accent-memory)' : 'var(--text-faint)',
          }}
        />
        <span>{stateText}</span>
        <span style={{ color: 'var(--text-faint)' }}>{elapsed}</span>
        {fixtureLines && (
          <span style={{ color: 'var(--text-faint)' }}>
            fixture: {FIXTURE_LINE_COUNT} synthesized lines
          </span>
        )}
        {isLive && (
          <button
            type="button"
            onClick={() => stopRunLocally(runId)}
            aria-label="Stop run (local record only)"
            style={quietButtonStyle}
          >
            <Square
              aria-hidden
              style={{ width: 'var(--space-2)', height: 'var(--space-2)' }}
              fill="currentColor"
            />
            stop
          </button>
        )}
      </div>

      {/* The trace is one block, not a stack of boxes. Absent data collapses. */}
      {traceLines.length > 0 && (
        <div
          ref={parentRef}
          role="log"
          aria-label="Run trace"
          tabIndex={0}
          style={{
            background: 'var(--surface-0)',
            border: 'var(--hairline)',
            borderRadius: 'var(--radius-sm)',
            maxHeight: 'calc(var(--space-13) * 4)',
            overflow: 'auto',
            padding: 'var(--space-2) var(--space-3)',
          }}
        >
          <div
            style={{
              height: virtualizer.getTotalSize(),
              width: '100%',
              position: 'relative',
            }}
          >
            {virtualizer.getVirtualItems().map((item) => (
              <div
                key={item.key}
                data-index={item.index}
                ref={virtualizer.measureElement}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${item.start}px)`,
                  fontFamily: 'var(--font-mono)',
                  fontSize: 'var(--text--2)',
                  lineHeight: 1.35,
                  color: 'var(--text-dim)',
                  whiteSpace: 'pre',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {traceLines[item.index]}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const quietButtonStyle: CSSProperties = {
  marginLeft: 'auto',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 'var(--space-1)',
  background: 'none',
  border: 'none',
  padding: 'var(--space-1)',
  cursor: 'pointer',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--text--1)',
  color: 'var(--text-dim)',
};

function describeRunState(run: CommonPlaceCodeRunRecord): string {
  if (run.state === 'stopped') {
    const stoppedLocally = run.events.some(
      (event) => event.kind === 'status' && event.label === LOCAL_STOP_LABEL,
    );
    return stoppedLocally ? LOCAL_STOP_LABEL : 'stopped';
  }
  if (run.state === 'failed') return run.error ? `failed: ${run.error}` : 'failed';
  if (run.state === 'queued' || run.state === 'running') return 'running';
  return run.state;
}

function formatEventLine(createdAt: string, label: string, detail?: string): string {
  const date = new Date(createdAt);
  const clock = Number.isNaN(date.getTime())
    ? '--:--:--'
    : date.toLocaleTimeString([], { hour12: false });
  return `${clock}  ${label}${detail ? `  ${detail}` : ''}`;
}

// Pulse resolves to zero motion under prefers-reduced-motion; durations are
// token-derived, never raw milliseconds.
const PULSE_CSS = `
@keyframes cpCodeRunPulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.35; }
}
.cp-code-run-dot--live {
  animation: cpCodeRunPulse calc(var(--motion-slow) * 4) var(--ease) infinite;
}
@media (prefers-reduced-motion: reduce) {
  .cp-code-run-dot--live { animation: none; }
}
`;
