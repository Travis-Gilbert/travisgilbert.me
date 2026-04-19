'use client';

import type { FC, ReactNode } from 'react';

interface WidgetShellProps {
  title: string;
  subtitle?: string;
  state: 'loading' | 'empty' | 'error' | 'ready';
  error?: string;
  children: ReactNode;
}

/**
 * Parchment card chrome for Mosaic-backed widgets. Consumers pass their
 * own loading/empty/error/ready state; the shell renders an honest
 * placeholder in every non-ready case.
 */
const WidgetShell: FC<WidgetShellProps> = ({ title, subtitle, state, error, children }) => {
  return (
    <section
      className="vie-intel-widget"
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 6,
        boxShadow: 'var(--shadow-warm-sm)',
        padding: 16,
        minHeight: 200,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <header>
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'var(--color-ink-muted)',
          }}
        >
          {title}
        </div>
        {subtitle && (
          <div
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 12,
              color: 'var(--color-ink-light)',
              marginTop: 2,
            }}
          >
            {subtitle}
          </div>
        )}
      </header>

      <div style={{ flex: 1, minHeight: 140, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {state === 'loading' && (
          <span style={{ color: 'var(--color-ink-light)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
            Loading…
          </span>
        )}
        {state === 'empty' && (
          <span
            style={{
              color: 'var(--color-ink-muted)',
              fontFamily: 'var(--font-body)',
              fontSize: 13,
              textAlign: 'center',
              padding: '0 12px',
            }}
          >
            Telemetry arrives after the next overnight run.
          </span>
        )}
        {state === 'error' && (
          <span
            role="alert"
            style={{
              color: 'var(--color-error)',
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              padding: '0 12px',
              textAlign: 'center',
            }}
          >
            Unavailable: {error ?? 'unknown error'}
          </span>
        )}
        {state === 'ready' && (
          <div style={{ width: '100%', height: '100%' }}>{children}</div>
        )}
      </div>
    </section>
  );
};

export default WidgetShell;
