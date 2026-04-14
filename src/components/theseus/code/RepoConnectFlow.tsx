'use client';

import { useEffect, useState } from 'react';
import type { IngestRequest, IngestionStats } from '@/lib/theseus-types';

interface Props {
  open: boolean;
  onClose: () => void;
  onIngest: (payload: IngestRequest) => Promise<IngestionStats | null>;
}

type Step = 'form' | 'ingesting' | 'done' | 'error';

export default function RepoConnectFlow({ open, onClose, onIngest }: Props) {
  const [step, setStep] = useState<Step>('form');
  const [repo, setRepo] = useState('');
  const [paths, setPaths] = useState('');
  const [language, setLanguage] = useState('');
  const [notebookId, setNotebookId] = useState('');
  const [stats, setStats] = useState<IngestionStats | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  // Reset state when opened
  useEffect(() => {
    if (open) {
      setStep('form');
      setStats(null);
      setErrorMessage('');
    }
  }, [open]);

  // Esc key closes if not in-flight
  useEffect(() => {
    if (!open) return;
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape' && step !== 'ingesting') {
        onClose();
      }
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, step, onClose]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStep('ingesting');
    const payload: IngestRequest = {
      repo: repo.trim() || undefined,
      paths: paths
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean),
      language: language.trim() || undefined,
      notebook_id: notebookId.trim() || undefined,
    };
    try {
      const result = await onIngest(payload);
      if (result) {
        setStats(result);
        setStep('done');
      } else {
        setErrorMessage('Ingestion failed. Check the repo URL and try again.');
        setStep('error');
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Unknown error');
      setStep('error');
    }
  }

  if (!open) return null;

  return (
    <div
      className="ce-connect-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget && step !== 'ingesting') onClose();
      }}
    >
      <div className="ce-connect-modal" role="dialog" aria-label="Connect repository">
        <div className="ce-connect-head">
          <h2 className="ce-connect-title">Connect a repository</h2>
          <button
            type="button"
            className="ce-connect-close"
            onClick={onClose}
            disabled={step === 'ingesting'}
            aria-label="Close"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {step === 'form' && (
          <form className="ce-connect-form" onSubmit={handleSubmit}>
            <label className="ce-connect-field">
              <span className="ce-connect-field-label">Repository</span>
              <input
                type="text"
                className="ce-connect-input"
                placeholder="owner/repo or https://github.com/owner/repo"
                value={repo}
                onChange={(e) => setRepo(e.target.value)}
                autoFocus
                required
              />
            </label>

            <label className="ce-connect-field">
              <span className="ce-connect-field-label">
                Paths (optional, comma-separated)
              </span>
              <input
                type="text"
                className="ce-connect-input"
                placeholder="apps/notebook/, apps/api/"
                value={paths}
                onChange={(e) => setPaths(e.target.value)}
              />
            </label>

            <div className="ce-connect-row">
              <label className="ce-connect-field">
                <span className="ce-connect-field-label">Language (optional)</span>
                <select
                  className="ce-connect-select"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                >
                  <option value="">Auto-detect</option>
                  <option value="python">Python</option>
                  <option value="typescript">TypeScript</option>
                  <option value="javascript">JavaScript</option>
                  <option value="go">Go</option>
                  <option value="rust">Rust</option>
                  <option value="java">Java</option>
                </select>
              </label>

              <label className="ce-connect-field">
                <span className="ce-connect-field-label">Notebook (optional)</span>
                <input
                  type="text"
                  className="ce-connect-input"
                  placeholder="Notebook id"
                  value={notebookId}
                  onChange={(e) => setNotebookId(e.target.value)}
                />
              </label>
            </div>

            <p className="ce-connect-note">
              For private repositories, configure a GitHub token on the backend.
              Theseus clones the repository once; it is not stored server-side.
            </p>

            <div className="ce-connect-actions">
              <button type="button" className="ce-connect-cancel" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="ce-connect-submit">
                Ingest
              </button>
            </div>
          </form>
        )}

        {step === 'ingesting' && (
          <div className="ce-connect-progress">
            <div className="ce-connect-progress-spinner" />
            <div className="ce-connect-progress-label">
              Parsing {repo || 'repository'}...
            </div>
            <div className="ce-connect-progress-hint">
              Tree-sitter is extracting entities, resolving imports, and
              detecting processes. This takes 30 to 120 seconds for a typical repo.
            </div>
          </div>
        )}

        {step === 'done' && stats && (
          <div className="ce-connect-done">
            <div className="ce-connect-done-head">Done.</div>
            <dl className="ce-connect-stats">
              <div className="ce-connect-stat">
                <dt className="ce-connect-stat-label">Objects created</dt>
                <dd className="ce-connect-stat-value">{stats.objects_created}</dd>
              </div>
              <div className="ce-connect-stat">
                <dt className="ce-connect-stat-label">Edges created</dt>
                <dd className="ce-connect-stat-value">{stats.edges_created}</dd>
              </div>
              <div className="ce-connect-stat">
                <dt className="ce-connect-stat-label">Processes detected</dt>
                <dd className="ce-connect-stat-value">{stats.processes_detected}</dd>
              </div>
              <div className="ce-connect-stat">
                <dt className="ce-connect-stat-label">Languages</dt>
                <dd className="ce-connect-stat-value">
                  {stats.languages.join(', ') || 'none'}
                </dd>
              </div>
              <div className="ce-connect-stat">
                <dt className="ce-connect-stat-label">Duration</dt>
                <dd className="ce-connect-stat-value">
                  {(stats.duration_ms / 1000).toFixed(1)}s
                </dd>
              </div>
            </dl>
            <div className="ce-connect-actions">
              <button
                type="button"
                className="ce-connect-submit"
                onClick={onClose}
              >
                Explore
              </button>
            </div>
          </div>
        )}

        {step === 'error' && (
          <div className="ce-connect-error">
            <div className="ce-connect-error-head">Ingestion failed</div>
            <p className="ce-connect-error-body">{errorMessage}</p>
            <div className="ce-connect-actions">
              <button type="button" className="ce-connect-cancel" onClick={onClose}>
                Cancel
              </button>
              <button
                type="button"
                className="ce-connect-submit"
                onClick={() => setStep('form')}
              >
                Try again
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
