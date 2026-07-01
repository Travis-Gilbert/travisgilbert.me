'use client';

import type { CSSProperties } from 'react';
import type { GithubPanelState } from '@/lib/commonplace-github-status';
import { panel } from './desktopPanel';

export function GithubAppPanel({ state }: { state: GithubPanelState }) {
  const ready = state.kind === 'ready';
  const upstreamReady = ready && state.status.webhook.upstreamConfigured;
  const installUrl = ready ? state.status.installation.installUrl : null;
  const webhookUrl = ready ? state.status.webhook.publicUrl : '';
  const statusLabel = state.kind === 'loading'
    ? 'checking'
    : upstreamReady
      ? 'ready'
      : state.kind === 'error'
        ? 'status unavailable'
        : 'needs setup';

  return (
    <section style={panel.card} aria-label="GitHub App ingestion">
      <div style={{ fontWeight: 600, marginBottom: 8 }}>GitHub App</div>
      <div style={panel.row}>
        <span>Repository ingestion</span>
        <span style={statusPill(upstreamReady)}>{statusLabel}</span>
      </div>

      {state.kind === 'loading' ? (
        <p style={panel.dim}>Checking Theorem ingestion.</p>
      ) : state.kind === 'error' ? (
        <p style={panel.dim}>{state.message}</p>
      ) : (
        <>
          <div style={{ ...panel.card, marginBottom: 12 }}>
            <div style={panel.dim}>Webhook URL</div>
            <code style={codeBlock}>{webhookUrl}</code>
          </div>

          {!upstreamReady ? (
            <p style={panel.dim}>Theorem webhook upstream is not configured.</p>
          ) : null}

          {installUrl ? (
            <a href={installUrl} target="_blank" rel="noreferrer" style={linkButton}>
              Install GitHub App
            </a>
          ) : (
            <p style={panel.dim}>Install URL is not configured.</p>
          )}
        </>
      )}
    </section>
  );
}

function statusPill(ok: boolean): CSSProperties {
  return {
    border: '1px solid var(--cp-border, rgba(0,0,0,.15))',
    borderRadius: 8,
    padding: '4px 8px',
    color: ok ? 'var(--cp-accent, #d9a65d)' : 'var(--cp-text-dim)',
    fontSize: 12,
  };
}

const codeBlock: CSSProperties = {
  display: 'block',
  marginTop: 6,
  overflowWrap: 'anywhere',
  fontSize: 12,
};

const linkButton: CSSProperties = {
  ...panel.button,
  display: 'inline-flex',
  textDecoration: 'none',
};
