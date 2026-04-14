'use client';

import { useState } from 'react';
import { ingestCodebase } from '@/lib/theseus-api';
import type { IngestionStats } from '@/lib/theseus-types';

/**
 * CodeExplorer (minimal).
 *
 * One input. Paste a GitHub URL, ingest it, see the stats. That is the
 * whole screen. The previous build had a toolbar, a canvas, a jump list,
 * a drift panel, a patterns panel, a hover card, and a legend — it was
 * confusing even for the person building it. This reset gives the screen
 * a single job so the next UI iteration can grow from a real need.
 *
 * The richer exploration components (ImpactCanvas, DriftPanel, etc.)
 * still exist on disk and can be reintroduced when there is a confirmed
 * ingested repo and a real user question to answer.
 */
export default function CodeExplorer() {
  type Status = 'idle' | 'ingesting' | 'done' | 'error';

  const [url, setUrl] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [stats, setStats] = useState<IngestionStats | null>(null);
  const [error, setError] = useState<string | null>(null);

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
      <div className="cx-card" data-state={status}>
        {status === 'idle' && (
          <form className="cx-form" onSubmit={handleSubmit}>
            <div className="cx-eyebrow">Code Explorer</div>
            <h1 className="cx-title">Paste a repo.</h1>
            <p className="cx-lede">
              Theseus ingests the codebase and builds a graph you can
              explore. Start with any public GitHub repository.
            </p>

            <label className="cx-field">
              <span className="cx-field-label">Repository URL</span>
              <input
                type="url"
                className="cx-input"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://github.com/owner/repo"
                autoFocus
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
            <div className="cx-spinner" aria-hidden="true" />
            <div className="cx-progress-label">Ingesting</div>
            <div className="cx-progress-url">{url}</div>
            <p className="cx-progress-hint">
              Tree-sitter is parsing files, resolving imports, and detecting
              processes. Usually 30 to 120 seconds.
            </p>
          </div>
        )}

        {status === 'done' && stats && (
          <div className="cx-done">
            <div className="cx-eyebrow">Done</div>
            <h2 className="cx-title cx-title--done">Ingested.</h2>

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
            <div className="cx-eyebrow cx-eyebrow--error">Failed</div>
            <h2 className="cx-title">Could not ingest.</h2>
            <p className="cx-error-body">{error}</p>
            <div className="cx-error-actions">
              <button type="button" className="cx-secondary" onClick={reset}>
                Back
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
