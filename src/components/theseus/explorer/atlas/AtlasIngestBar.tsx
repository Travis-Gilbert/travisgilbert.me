'use client';

import { useState } from 'react';
import { dispatchTheseusEvent } from '@/lib/theseus/events';

/**
 * Top-right ingest bar on the Explorer canvas.
 *
 * Accepts a URL / repo / doc reference. On submit, dispatches the
 * existing global `theseus:capture-open` event with a synthetic File
 * payload representing the URL; the Capture modal picks it up from
 * there. This reuses the existing drop-in capture flow — no fake
 * status theatre.
 */
export default function AtlasIngestBar() {
  const [value, setValue] = useState('');
  const [lastSubmitted, setLastSubmitted] = useState<string | null>(null);

  function submit() {
    const v = value.trim();
    if (!v) return;
    // Hand off to the capture pipeline via the shared event. Downstream
    // listeners (CaptureModal) report real progress; we surface only
    // "submitted" and leave actual ingest status to the capture surface.
    dispatchTheseusEvent('theseus:capture-open', {
      url: v,
      source: 'atlas-ingest',
    });
    setLastSubmitted(v);
    setValue('');
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
            if (e.key === 'Enter') submit();
          }}
          placeholder="paste a repo, link, or doc to ingest…"
          aria-label="Ingest URL or file reference"
        />
        <button type="button" onClick={submit}>
          Ingest
        </button>
      </div>
      {lastSubmitted && (
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
        >
          <span
            aria-hidden
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: 'var(--paper-pencil)',
            }}
          />
          <span style={{ color: 'var(--paper-ink)' }}>submitted</span>
          <span
            style={{
              color: 'var(--paper-ink-3)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: 220,
            }}
          >
            {lastSubmitted.replace(/^https?:\/\//, '')}
          </span>
        </div>
      )}
    </div>
  );
}
