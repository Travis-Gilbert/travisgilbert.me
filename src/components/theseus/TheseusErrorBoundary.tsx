'use client';

import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** Optional label surfaced in the fallback card for debugging. */
  label?: string;
  /** Optional callback when an error is caught. */
  onError?: (err: unknown) => void;
}

interface State {
  error: unknown | null;
}

/**
 * Shared error boundary for Theseus surfaces. Renders a parchment card
 * with a warm-red border when something inside throws. Used by panel-
 * level wrappers (PanelManager) and canvas-level wrappers (Cosmograph,
 * Mosaic widgets) so a single failure doesn't break neighbouring work.
 */
export default class TheseusErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: unknown): State {
    return { error };
  }

  componentDidCatch(error: unknown) {
    this.props.onError?.(error);
    // eslint-disable-next-line no-console
    console.error('[TheseusErrorBoundary]', this.props.label ?? '', error);
  }

  private reset = () => this.setState({ error: null });

  render() {
    if (this.state.error === null) return this.props.children;
    const message =
      this.state.error instanceof Error
        ? this.state.error.message
        : String(this.state.error);
    return (
      <div
        role="alert"
        style={{
          background: 'var(--color-surface)',
          border: '1px solid color-mix(in srgb, var(--color-error) 40%, var(--color-border))',
          borderRadius: 6,
          padding: '20px 22px',
          margin: 12,
          boxShadow: 'var(--shadow-warm)',
          fontFamily: 'var(--font-body)',
          color: 'var(--color-ink)',
        }}
      >
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'var(--color-error)',
            marginBottom: 8,
          }}
        >
          {this.props.label ? `${this.props.label} · error` : 'Error'}
        </div>
        <p style={{ fontSize: 14, lineHeight: 1.5, margin: '0 0 12px' }}>
          Something here stopped working. The rest of Theseus is still running.
        </p>
        <pre
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--color-ink-muted)',
            background: 'var(--color-bg-alt)',
            padding: '8px 10px',
            borderRadius: 4,
            margin: '0 0 12px',
            overflowX: 'auto',
            whiteSpace: 'pre-wrap',
          }}
        >
          {message}
        </pre>
        <button
          type="button"
          onClick={this.reset}
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            padding: '6px 12px',
            border: '1px solid var(--color-terracotta)',
            background: 'var(--color-terracotta)',
            color: '#FBF0E2',
            borderRadius: 3,
            cursor: 'pointer',
          }}
        >
          Retry
        </button>
      </div>
    );
  }
}
