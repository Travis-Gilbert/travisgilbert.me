'use client';

import { useEffect, useRef, useState } from 'react';
import { ingestCodebase } from '@/lib/theseus-api';
import type { IngestionStats } from '@/lib/theseus-types';
import ChatCanvas from '@/components/theseus/chat/ChatCanvas';

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
export default function CodeExplorer() {
  type Status = 'idle' | 'ingesting' | 'done' | 'error';

  const [url, setUrl] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [stats, setStats] = useState<IngestionStats | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const target = url.trim();
    if (!target) return;

    setStatus('ingesting');
    setError(null);
    const result = await ingestCodebase(
      { repo: target },
      { timeoutMs: 180_000, retryPolicy: 'none' },
    );

    if (result.ok) {
      setStats(result);
      setStatus('done');
    } else {
      setError(result.message);
      setStatus('error');
    }
  }

  function reset() {
    setUrl('');
    setStats(null);
    setError(null);
    setStatus('idle');
  }

  return (
    <div className="cx-root">
      {/* Shared Theseus substrate: warm noir, radial patches, pixel noise. */}
      <div className="cx-substrate" aria-hidden="true">
        <ChatCanvas />
      </div>

      {/* Soft engine-heat wash rising from the bottom, matching the
          VIE Layer-2 language. Stays subtle at idle. */}
      <div className="cx-heat" aria-hidden="true" />

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
              <p className="cx-lede">
                Tree-sitter is parsing files, resolving imports, and detecting
                processes. Usually 30 to 120 seconds.
              </p>
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
                <div className="cx-stat">
                  <dt>Objects</dt>
                  <dd>{stats.objects_created}</dd>
                </div>
                <div className="cx-stat">
                  <dt>Edges</dt>
                  <dd>{stats.edges_created}</dd>
                </div>
                <div className="cx-stat">
                  <dt>Processes</dt>
                  <dd>{stats.processes_detected}</dd>
                </div>
                <div className="cx-stat">
                  <dt>Languages</dt>
                  <dd>{stats.languages.join(', ') || '—'}</dd>
                </div>
                <div className="cx-stat">
                  <dt>Duration</dt>
                  <dd>{(stats.duration_ms / 1000).toFixed(1)}s</dd>
                </div>
              </dl>

              <button type="button" className="cx-secondary" onClick={reset}>
                Ingest another
              </button>
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
