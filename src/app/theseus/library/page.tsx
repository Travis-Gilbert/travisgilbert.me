'use client';

import { useEffect, useState } from 'react';
import { getHypotheses } from '../../../lib/theseus-api';
import type { Hypothesis } from '../../../lib/theseus-types';

export default function TheseusLibrary() {
  const [hypotheses, setHypotheses] = useState<Hypothesis[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const result = await getHypotheses();
      if (result.ok) {
        setHypotheses(result.hypotheses);
      } else {
        setError(result.message);
      }
      setLoading(false);
    }
    load();
  }, []);

  return (
    <div
      style={{
        height: '100%',
        padding: '48px 24px',
        fontFamily: 'var(--vie-font-body)',
        overflowY: 'auto',
      }}
    >
      <h1
        style={{
          fontFamily: 'var(--vie-font-title)',
          fontSize: '2rem',
          fontWeight: 500,
          color: 'var(--vie-text)',
          marginBottom: '32px',
          textAlign: 'center',
        }}
      >
        Saved Models
      </h1>

      {loading && (
        <p style={{ color: 'var(--vie-text-dim)', textAlign: 'center' }}>Loading...</p>
      )}

      {error && (
        <p style={{ color: 'var(--vie-terra-light)', textAlign: 'center' }}>{error}</p>
      )}

      {!loading && !error && hypotheses.length === 0 && (
        <p style={{ color: 'var(--vie-text-muted)', textAlign: 'center' }}>
          No saved models yet. Ask a question to get started.
        </p>
      )}

      {hypotheses.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: '16px',
            maxWidth: '960px',
            margin: '0 auto',
          }}
        >
          {hypotheses.map((h) => (
            <div
              key={h.id}
              style={{
                background: 'var(--vie-card)',
                border: '1px solid var(--vie-border)',
                borderRadius: '12px',
                padding: '20px',
              }}
            >
              <h2
                style={{
                  fontFamily: 'var(--vie-font-title)',
                  fontSize: '1.125rem',
                  color: 'var(--vie-text)',
                  marginBottom: '8px',
                }}
              >
                {h.title}
              </h2>
              <p
                style={{
                  color: 'var(--vie-text-muted)',
                  fontSize: '0.875rem',
                  lineHeight: 1.5,
                  marginBottom: '12px',
                }}
              >
                {h.description}
              </p>
              <p
                style={{
                  color: 'var(--vie-text-dim)',
                  fontFamily: 'var(--vie-font-mono)',
                  fontSize: '0.75rem',
                }}
              >
                Confidence: {Math.round(h.confidence * 100)}%
                {' · '}{h.supporting_objects.length} objects
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
