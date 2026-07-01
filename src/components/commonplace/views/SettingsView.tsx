'use client';

import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { panel } from './desktopPanel';

type GithubStatus = {
  ok: true;
  webhook: {
    proxyPath: string;
    publicUrl: string;
    upstreamConfigured: boolean;
  };
  installation: {
    configured: boolean;
    installUrl: string | null;
  };
};

type GithubPanelState =
  | { kind: 'loading' }
  | { kind: 'ready'; status: GithubStatus }
  | { kind: 'error'; message: string };

export default function SettingsView() {
  const [githubState, setGithubState] = useState<GithubPanelState>({ kind: 'loading' });

  useEffect(() => {
    let active = true;

    async function loadStatus() {
      try {
        const response = await fetch('/api/theorem/github/status', { cache: 'no-store' });
        if (!response.ok) {
          throw new Error(`GitHub status returned ${response.status}.`);
        }
        const status = (await response.json()) as GithubStatus;
        if (!status.webhook?.publicUrl) {
          throw new Error('GitHub status response was incomplete.');
        }
        if (active) setGithubState({ kind: 'ready', status });
      } catch (err) {
        if (active) {
          setGithubState({
            kind: 'error',
            message: err instanceof Error ? err.message : 'GitHub status unavailable.',
          });
        }
      }
    }

    void loadStatus();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div style={panel.wrap}>
      <div style={panel.title}>Settings</div>
      <div style={panel.sub}>
        Web integrations and product level connection status.
      </div>
      <GithubAppPanel state={githubState} />
    </div>
  );
}

function GithubAppPanel({ state }: { state: GithubPanelState }) {
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
