'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';
import { askTheseus } from '../../../lib/theseus-api';
import type { TheseusResponse } from '../../../lib/theseus-types';

type AskState = 'IDLE' | 'THINKING' | 'MODEL' | 'CONSTRUCTING' | 'EXPLORING';

function AskContent() {
  const searchParams = useSearchParams();
  const q = searchParams.get('q');
  const [state, setState] = useState<AskState>(q ? 'THINKING' : 'IDLE');
  const [response, setResponse] = useState<TheseusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!q) return;

    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];

    async function run() {
      setState('THINKING');
      const result = await askTheseus(q!);
      if (cancelled) return;

      if (!result.ok) {
        setError(result.message);
        setState('IDLE');
        return;
      }

      setState('MODEL');
      setResponse(result);

      timers.push(setTimeout(() => {
        if (!cancelled) setState('CONSTRUCTING');
      }, 800));

      timers.push(setTimeout(() => {
        if (!cancelled) setState('EXPLORING');
      }, 1600));
    }

    run();
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [q]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        padding: '0 24px',
        fontFamily: 'var(--vie-font-body)',
      }}
    >
      {state === 'IDLE' && !error && (
        <p style={{ color: 'var(--vie-text-muted)' }}>
          No query provided. Go back to search.
        </p>
      )}

      {error && (
        <div style={{ color: 'var(--vie-terra-light)', textAlign: 'center' }}>
          <p style={{ fontSize: '1.125rem', marginBottom: '8px' }}>Something went wrong</p>
          <p style={{ color: 'var(--vie-text-dim)', fontSize: '0.875rem' }}>{error}</p>
        </div>
      )}

      {state === 'THINKING' && (
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: 'var(--vie-teal-light)', fontSize: '1.25rem', marginBottom: '8px' }}>
            Thinking...
          </p>
          <p style={{ color: 'var(--vie-text-dim)', fontFamily: 'var(--vie-font-mono)', fontSize: '0.875rem' }}>
            {q}
          </p>
        </div>
      )}

      {state === 'MODEL' && (
        <p style={{ color: 'var(--vie-amber-light)', fontSize: '1.25rem' }}>
          Building model...
        </p>
      )}

      {state === 'CONSTRUCTING' && (
        <p style={{ color: 'var(--vie-amber)', fontSize: '1.25rem' }}>
          Constructing scene...
        </p>
      )}

      {state === 'EXPLORING' && response && (
        <div style={{ textAlign: 'center', maxWidth: '640px' }}>
          <p style={{
            fontFamily: 'var(--vie-font-title)',
            fontSize: '1.5rem',
            color: 'var(--vie-text)',
            marginBottom: '16px',
          }}>
            {response.query}
          </p>
          <p style={{
            color: 'var(--vie-text-muted)',
            fontFamily: 'var(--vie-font-mono)',
            fontSize: '0.875rem',
            marginBottom: '24px',
          }}>
            Confidence: {Math.round(response.confidence.combined * 100)}%
            {' · '}{response.sections.length} sections
          </p>
          {response.sections
            .filter((s): s is Extract<typeof s, { type: 'narrative' }> => s.type === 'narrative')
            .map((s, i) => (
              <p key={i} style={{ color: 'var(--vie-text)', lineHeight: 1.7, marginBottom: '16px' }}>
                {s.content}
              </p>
            ))}
        </div>
      )}
    </div>
  );
}

export default function TheseusAskPage() {
  return (
    <Suspense
      fallback={
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: 'var(--vie-text-dim)',
          fontFamily: 'var(--vie-font-body)',
        }}>
          Loading...
        </div>
      }
    >
      <AskContent />
    </Suspense>
  );
}
