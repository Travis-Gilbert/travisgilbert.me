'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ingestCodebaseStream } from '@/lib/theseus-api';
import type { IngestionStats } from '@/lib/theseus-types';
// V2 Batch 4 retired ChatCanvas; the shared DotGrid in TheseusShell
// provides the material backdrop for every non-Explorer panel.
// V2 Batch 7 retired AmbientGraphActivity. CodeExplorer keeps its status
// affordances but no longer renders the ambient layer.
import CodeStreamCanvas from './CodeIngestAnimation';

/**
 * Streaming ingest telemetry. Each phase boundary from ingest_codebase
 * lands here as a transmission line, newest-first. The operator reads
 * the backend working in real time, not a fabricated spinner.
 */
interface IngestLogLine {
  id: number;
  phase: string;
  text: string;
  dimmed: boolean;
}

// Phase slug → short, transmission-toned verb for the live log. Keys
// mirror `phase` values emitted by apps/notebook/management/commands/
// ingest_codebase.py._emit(). If backend adds phases, missing keys fall
// through to the slug-as-label behaviour.
const PHASE_LABEL: Record<string, string> = {
  parsing: 'parsing AST',
  creating_files: 'writing file objects',
  creating_structures: 'wiring classes + interfaces',
  creating_members: 'wiring functions + methods',
  resolving_imports: 'resolving cross-file imports',
  detecting_processes: 'tracing execution flows',
  ingesting_commits: 'reading git history',
  embedding: 'computing embeddings',
};

function formatPhaseDone(phase: string, data: Record<string, unknown>): string {
  // One compact stat line per phase, all real fields from the callback.
  switch (phase) {
    case 'parsing': {
      const { files, structures, members, imports } = data as Record<string, number>;
      return `parsed ${files ?? 0} files · ${structures ?? 0} classes · ${members ?? 0} functions · ${imports ?? 0} imports`;
    }
    case 'creating_files':
      return `${(data.files_total as number) ?? 0} files indexed`;
    case 'creating_structures':
      return `${(data.structures_total as number) ?? 0} structures indexed`;
    case 'creating_members':
      return `${(data.members_total as number) ?? 0} members indexed`;
    case 'resolving_imports':
      return `${(data.import_edges as number) ?? 0} import edges wired`;
    case 'detecting_processes':
      return `${(data.processes as number) ?? 0} processes traced · ${(data.process_edges as number) ?? 0} edges`;
    case 'ingesting_commits':
      return `${(data.commits as number) ?? 0} commits`;
    case 'embedding':
      return `embedded ${(data.embedded as number) ?? 0} objects`;
    default:
      return phase;
  }
}

/**
 * CodeExplorer (minimal).
 *
 * One input. Paste a GitHub URL, ingest it, see the stats. The richer
 * exploration surface (impact canvas, drift, patterns) is deliberately
 * dormant on this screen until there is a confirmed user need for it.
 *
 * Visual substrate uses ChatCanvas — the same warm-noir texture that
 * sits behind the Ask panel — so the Code Explorer feels like part of
 * Theseus rather than a standalone utility. Typography, tokens, and
 * panel glass follow the VIE design language.
 */
// Total phase_done events the ingest pipeline can emit. Mirrors the
// _emit('phase_done', ...) sites in ingest_codebase.py. Used to derive
// a 0..1 ingest progress value that drives animation speed-up (cursor
// pulse, heat breath, entry motion) — the machine reads as more
// energetic as it closes in on completion.
const TOTAL_PHASES = 8;

const NUMBER_FORMAT = new Intl.NumberFormat();

/**
 * Stat row on the Done screen. Shows both "added this run" and the
 * running total in graph, so a re-ingest of an already-ingested repo
 * does not read as "0 objects created" without context.
 *
 * If the backend did not emit totals (older response), we fall back
 * to showing just the delta.
 */
function StatRow({
  label,
  added,
  total,
}: {
  label: string;
  added: number;
  total?: number;
}) {
  return (
    <div className="cx-stat">
      <dt>{label}</dt>
      <dd>
        <span className="cx-stat-added">
          {added > 0 ? `+${NUMBER_FORMAT.format(added)}` : '0'}
        </span>
        {typeof total === 'number' && (
          <span className="cx-stat-total"> · {NUMBER_FORMAT.format(total)} in graph</span>
        )}
      </dd>
    </div>
  );
}

export default function CodeExplorer() {
  type Status = 'idle' | 'ingesting' | 'done' | 'error';

  const [url, setUrl] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [stats, setStats] = useState<IngestionStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [log, setLog] = useState<IngestLogLine[]>([]);
  const [phasesCompleted, setPhasesCompleted] = useState(0);
  const logIdRef = useRef(1);
  const abortRef = useRef<AbortController | null>(null);

  const ingestProgress = Math.min(1, phasesCompleted / TOTAL_PHASES);

  // Autofocus the input only on fine-pointer devices. On touch devices
  // autoFocus pops the soft keyboard before the user has seen the page,
  // which the web interface guidelines explicitly warn against.
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (status !== 'idle') return;
    if (window.matchMedia('(pointer: fine)').matches) {
      inputRef.current?.focus();
    }
  }, [status]);

  function pushLog(phase: string, text: string) {
    setLog((prev) => {
      // Dim all previous lines so the newest reads as the live cursor.
      const dimmed = prev.map((line) => ({ ...line, dimmed: true }));
      const id = logIdRef.current++;
      const next = [...dimmed, { id, phase, text, dimmed: false }];
      // Keep the transmission log bounded.
      return next.length > 10 ? next.slice(-10) : next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const target = url.trim();
    if (!target) return;

    setStatus('ingesting');
    setError(null);
    setStats(null);
    setLog([]);
    setPhasesCompleted(0);
    logIdRef.current = 1;

    const controller = new AbortController();
    abortRef.current = controller;

    const result = await ingestCodebaseStream(
      { repo: target },
      {
        onReady: () => pushLog('ready', 'stream open · cloning complete'),
        onPhaseStart: (data) => {
          const label =
            typeof data.label === 'string' && data.label
              ? data.label
              : PHASE_LABEL[data.phase] ?? data.phase;
          pushLog(data.phase, label);
        },
        onPhaseDone: (data) => {
          pushLog(data.phase, formatPhaseDone(data.phase, data));
          // Each phase_done marks real progress. The CSS layer reads
          // --ingest-progress to accelerate cursor pulse + heat breath.
          setPhasesCompleted((n) => n + 1);
        },
      },
      controller.signal,
    );

    abortRef.current = null;

    if (result.ok) {
      setStats(result);
      setStatus('done');
    } else {
      setError(result.message);
      setStatus('error');
    }
  }

  function reset() {
    abortRef.current?.abort();
    abortRef.current = null;
    setUrl('');
    setStats(null);
    setError(null);
    setStatus('idle');
    setLog([]);
    setPhasesCompleted(0);
    logIdRef.current = 1;
  }

  // Cancel inflight stream if the component unmounts mid-ingest.
  useEffect(() => () => {
    abortRef.current?.abort();
  }, []);

  return (
    <div
      className="cx-root"
      data-machine-warm={status === 'ingesting' ? 'true' : 'false'}
      // --ingest-speed feeds CSS calc() for cursor pulse, heat breath,
      // and log-line entry animation. 1.0 = baseline tempo; drops toward
      // ~0.35 as phases complete, so the machine visibly quickens as it
      // nears done. Reduced-motion CSS rules still override to `animation:
      // none`, which also ignores this variable.
      style={{ '--ingest-speed': 1 - 0.65 * ingestProgress } as React.CSSProperties}
    >
      {/* V2 Batch 4: the DotGrid in TheseusShell is the shared substrate.
          The .cx-substrate wrapper is kept so CodeExplorer-specific layers
          (heat wash, ingest affordances) still compose above it. */}
      <div className="cx-substrate" aria-hidden="true" />

      {/* Soft engine-heat wash rising from the bottom, matching the
          VIE Layer-2 language. Breathes while ingesting (see
          vie-heat-breath keyframe). Stays subtle at idle. */}
      <div className="cx-heat" aria-hidden="true" />

      {/* Ambient hypothesis whispers + edge formations during the
          ingest wait. Reinforces the "graph is growing as you watch"
          feel so the surface reads alive even before the stream starts
          emitting phase events (the git clone + initial parse phase
          can run for several seconds without frontend updates). */}
      {/* V2 Batch 7 retired the AmbientGraphActivity layer. */}

      {/* Layer 1.5: atmospheric glyph stream. Full-viewport backdrop
          that sits between the heat wash and the foreground card.
          The card's blur + 0.72 alpha background occludes the stream
          directly behind it, so the glyphs are visible around the card
          without competing with the text inside it. */}
      {status === 'ingesting' && (
        <CodeStreamCanvas active progress={ingestProgress} />
      )}

      <main className="cx-foreground">
        <div
          className="cx-card"
          data-state={status}
          aria-live="polite"
          aria-atomic="true"
        >
          {status === 'idle' && (
            <form className="cx-form" onSubmit={handleSubmit}>
              <div className="cx-eyebrow">
                <span className="cx-eyebrow-dot" aria-hidden="true" />
                Code Explorer
              </div>

              <h1 className="cx-title">Paste a repo.</h1>

              <p className="cx-lede">
                Theseus ingests the codebase and grows the graph. Start with any
                public GitHub repository.
              </p>

              <label className="cx-field">
                <span className="cx-field-label">Repository URL</span>
                <input
                  ref={inputRef}
                  type="url"
                  className="cx-input"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://github.com/owner/repo"
                  required
                  spellCheck={false}
                  autoComplete="off"
                />
              </label>

              <button
                type="submit"
                className="cx-submit"
                disabled={!url.trim()}
              >
                Ingest
              </button>
            </form>
          )}

          {status === 'ingesting' && (
            <div className="cx-progress">
              <div className="cx-eyebrow cx-eyebrow--live">
                <span className="cx-eyebrow-dot cx-eyebrow-dot--pulse" aria-hidden="true" />
                Ingesting{'\u2026'}
              </div>
              <h1 className="cx-title cx-title--progress">Working on it.</h1>
              <p className="cx-progress-url">{url}</p>

              {/* Live transmission log: one line per phase boundary
                  from ingest_codebase. Newest at bottom, previous
                  lines dim to a whisper. Real data only — if the
                  backend hasn't emitted a phase yet, no line shows. */}
              {log.length > 0 ? (
                <ol
                  className="cx-transmission-log"
                  aria-live="polite"
                  aria-label="Ingestion progress"
                >
                  {log.map((line) => (
                    <li
                      key={line.id}
                      className={line.dimmed ? 'cx-log-line cx-log-line--dim' : 'cx-log-line cx-log-line--live'}
                    >
                      {/* Live cursor: amber pulse next to the active line.
                          Dimmed lines render an empty cursor column so the
                          phase/text columns stay aligned. */}
                      <span className="cx-log-cursor" aria-hidden="true" />
                      <span className="cx-log-phase">{line.phase.replace(/_/g, ' ')}</span>
                      <span className="cx-log-text">{line.text}</span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="cx-lede">
                  Tree-sitter is parsing files, resolving imports, and detecting
                  processes. Usually 30 to 120 seconds.
                </p>
              )}
            </div>
          )}

          {status === 'done' && stats && (
            <div className="cx-done">
              <div className="cx-eyebrow cx-eyebrow--done">
                <span className="cx-eyebrow-dot" aria-hidden="true" />
                Done
              </div>

              <h1 className="cx-title">Ingested.</h1>

              <dl className="cx-stats">
                <StatRow
                  label="Objects"
                  added={stats.objects_created}
                  total={stats.objects_total}
                />
                <StatRow
                  label="Edges"
                  added={stats.edges_created}
                  total={stats.edges_total}
                />
                <StatRow
                  label="Processes"
                  added={stats.processes_detected}
                  total={stats.processes_total}
                />
                <div className="cx-stat">
                  <dt>Languages</dt>
                  <dd>{stats.languages.join(', ') || '—'}</dd>
                </div>
                <div className="cx-stat">
                  <dt>Duration</dt>
                  <dd>{(stats.duration_ms / 1000).toFixed(1)}s</dd>
                </div>
              </dl>

              <div className="cx-done-actions">
                <Link
                  href="/theseus?view=ask"
                  className="cx-submit cx-submit--link"
                >
                  Ask Theseus
                </Link>
                <button
                  type="button"
                  className="cx-secondary"
                  onClick={reset}
                >
                  Ingest another
                </button>
              </div>
            </div>
          )}

          {status === 'error' && (
            <div className="cx-error">
              <div className="cx-eyebrow cx-eyebrow--error">
                <span className="cx-eyebrow-dot cx-eyebrow-dot--error" aria-hidden="true" />
                Failed
              </div>
              <h1 className="cx-title">Could not ingest.</h1>
              <p className="cx-error-body">{error}</p>
              <div className="cx-error-actions">
                <button type="button" className="cx-secondary" onClick={reset}>
                  Back
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
