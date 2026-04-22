'use client';

import { useState } from 'react';
import { captureText } from '@/components/theseus/capture/captureApi';
import { dispatchTheseusEvent } from '@/lib/theseus/events';

type Status = 'idle' | 'pending' | 'ingested' | 'error';

interface Entry {
  label: string;
  status: Status;
  error?: string;
}

/**
 * Top-right ingest bar on the Explorer canvas.
 *
 * Submits a URL / repo / doc reference directly to the `/capture/`
 * backend via `captureText`. The status pill reflects the real state:
 * `pending` while the POST is in flight, `ingested` once the backend
 * confirms, `error` on failure. No timers, no fake-ready theatre.
 *
 * Also emits the shared `theseus:capture-complete` event so other
 * surfaces (the Explorer ingest-complete listener, the Plugins panel)
 * can react to a successful capture.
 */
export default function AtlasIngestBar() {
  const [value, setValue] = useState('');
  const [entry, setEntry] = useState<Entry | null>(null);

  async function submit() {
    const v = value.trim();
    if (!v) return;
    setValue('');
    setEntry({ label: v, status: 'pending' });
    const result = await captureText(v);
    if (result.ok) {
      setEntry({ label: v, status: 'ingested' });
      dispatchTheseusEvent('theseus:capture-complete', {
        status: 'ok',
        source: 'atlas-ingest',
        label: v,
      });
    } else {
      setEntry({ label: v, status: 'error', error: result.error });
      dispatchTheseusEvent('theseus:capture-complete', {
        status: 'error',
        source: 'atlas-ingest',
        label: v,
        error: result.error,
      });
    }
  }

  return (
    <div
      style={{
        position: 'absolute',
        top: 14,
        right: 14,
        zIndex: 5,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: 6,
      }}
    >
      <div className="atlas-ingest">
        <svg
          aria-hidden
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          style={{ flex: 'none', color: 'var(--paper-ink-3)' }}
        >
          <path d="M10 13a5 5 0 0 0 7.07 0l2.83-2.83a5 5 0 0 0-7.07-7.07l-1.41 1.42" />
          <path d="M14 11a5 5 0 0 0-7.07 0l-2.83 2.83a5 5 0 0 0 7.07 7.07l1.41-1.42" />
        </svg>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void submit();
          }}
          placeholder="paste a repo, link, or doc to ingest…"
          aria-label="Ingest URL or file reference"
          disabled={entry?.status === 'pending'}
        />
        <button
          type="button"
          onClick={() => void submit()}
          disabled={entry?.status === 'pending'}
        >
          {entry?.status === 'pending' ? 'Ingesting…' : 'Ingest'}
        </button>
      </div>
      {entry && <StatusPill entry={entry} />}
    </div>
  );
}

function StatusPill({ entry }: { entry: Entry }) {
  const tone = entry.status === 'error'
    ? 'var(--vie-error, #c65c3a)'
    : entry.status === 'ingested'
      ? 'var(--sage, #6e7f54)'
      : 'var(--paper-pencil)';
  const label = entry.status === 'error'
    ? 'error'
    : entry.status === 'ingested'
      ? 'ingested'
      : 'submitting';
  return (
    <div
      style={{
        padding: '6px 10px',
        background: 'rgba(243, 239, 230, 0.82)',
        backdropFilter: 'blur(6px)',
        border: '1px solid var(--paper-rule)',
        borderRadius: 3,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        font: '500 10px/1.3 var(--font-mono)',
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        color: 'var(--paper-ink-2)',
        maxWidth: 360,
        boxShadow: '0 6px 16px -6px rgba(0, 0, 0, 0.18)',
      }}
      role={entry.status === 'error' ? 'alert' : 'status'}
    >
      <span
        aria-hidden
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: tone,
        }}
      />
      <span style={{ color: 'var(--paper-ink)' }}>{label}</span>
      <span
        style={{
          color: 'var(--paper-ink-3)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          maxWidth: 220,
        }}
        title={entry.error ?? entry.label}
      >
        {entry.error ?? entry.label.replace(/^https?:\/\//, '')}
      </span>
    </div>
  );
}
