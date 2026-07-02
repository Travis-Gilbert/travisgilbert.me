'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import AgentThreadView from './AgentThreadView';
import HarnessLivePanel from './HarnessLivePanel';

const accountSections = [
  {
    id: 'accounts-providers',
    title: 'Providers',
    rows: ['OpenAI', 'Anthropic', 'DeepSeek', 'Gemini', 'Ollama'],
  },
  {
    id: 'accounts-connections',
    title: 'Connections',
    rows: ['Hosted Theorem', 'Local node', 'ACP bridge', 'CommonPlace API'],
  },
  {
    id: 'accounts-keys',
    title: 'Keys',
    rows: ['Bearer token', 'Provider secrets', 'Desktop keychain'],
  },
  {
    id: 'accounts-usage',
    title: 'Usage',
    rows: ['Agent runs', 'Substrate reads', 'Model calls'],
  },
];

const agentLaunches = [
  { label: 'CommonPlace Chat', mode: 'api' },
  { label: 'Claude Code', mode: 'acp' },
  { label: 'Codex', mode: 'acp' },
  { label: 'Gemini CLI', mode: 'acp' },
];

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

export default function AccountsView() {
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
    <section style={styles.shell} aria-label="CommonPlace accounts">
      <header style={styles.header}>
        <div>
          <p style={styles.eyebrow}>SYSTEM</p>
          <h1 style={styles.title}>Accounts</h1>
        </div>
        <div style={styles.statusRow}>
          <span style={styles.status}>CommonPlace account</span>
          <span style={styles.status}>ready</span>
        </div>
      </header>

      <div style={styles.body}>
        <main style={styles.agentColumn}>
          <div style={styles.columnHeader}>
            <span>CommonPlace Chat</span>
            <code style={styles.endpoint}>/api/theorem/agent</code>
          </div>
          <div style={styles.agentFrame}>
            <AgentThreadView agentId="theorem" agentMode="api" />
          </div>
        </main>

        <aside style={styles.controlColumn}>
          <section style={styles.panel}>
            <div style={styles.panelTitle}>Agents</div>
            <div style={styles.agentGrid}>
              {agentLaunches.map((agent) => (
                <div key={agent.label} style={styles.agentTile}>
                  <span style={styles.agentName}>{agent.label}</span>
                  <span style={styles.agentMode}>{agent.mode}</span>
                </div>
              ))}
            </div>
          </section>

          <GithubAppPanel state={githubState} />
          <HarnessLivePanel />

          <section style={styles.sectionGrid}>
            {accountSections.map((section) => (
              <article id={section.id} key={section.title} style={styles.panel}>
                <div style={styles.panelTitle}>{section.title}</div>
                <div style={styles.rowList}>
                  {section.rows.map((row) => (
                    <div key={row} style={styles.controlRow}>
                      <span>{row}</span>
                      <span style={styles.dot} aria-hidden="true" />
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </section>
        </aside>
      </div>
    </section>
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
    <section style={styles.githubPanel} aria-label="GitHub App ingestion">
      <div style={styles.panelTitle}>GitHub App</div>
      <div style={styles.githubStatusRow}>
        <span style={styles.githubLabel}>Ingestion</span>
        <span style={upstreamReady ? styles.readyStatus : styles.warningStatus}>{statusLabel}</span>
      </div>

      {state.kind === 'loading' ? (
        <p style={styles.helperText}>Checking Theorem ingestion.</p>
      ) : state.kind === 'error' ? (
        <p style={styles.helperText}>{state.message}</p>
      ) : (
        <>
          <div style={styles.webhookBlock}>
            <span style={styles.webhookCaption}>Webhook URL</span>
            <code style={styles.webhookCode}>{webhookUrl}</code>
          </div>

          {!upstreamReady ? (
            <p style={styles.helperText}>Theorem webhook upstream is not configured.</p>
          ) : null}

          {installUrl ? (
            <a href={installUrl} target="_blank" rel="noreferrer" style={styles.installLink}>
              Install GitHub App
            </a>
          ) : (
            <p style={styles.helperText}>Install URL is not configured.</p>
          )}
        </>
      )}
    </section>
  );
}

const styles: Record<string, CSSProperties> = {
  shell: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
    height: '100%',
    background: 'var(--cp-bg)',
    color: 'var(--cp-text)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    padding: '18px 20px 14px',
    borderBottom: '1px solid var(--cp-border)',
    background: 'var(--cp-surface)',
  },
  eyebrow: {
    margin: '0 0 4px',
    fontFamily: 'var(--cp-font-mono)',
    fontSize: 10,
    letterSpacing: 0,
    color: 'var(--cp-text-faint)',
  },
  title: {
    margin: 0,
    fontFamily: 'var(--cp-font-title)',
    fontSize: 28,
    fontWeight: 600,
    letterSpacing: 0,
    color: 'var(--cp-text)',
  },
  statusRow: {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 8,
  },
  status: {
    border: '1px solid var(--cp-border)',
    borderRadius: 6,
    padding: '6px 8px',
    fontFamily: 'var(--cp-font-mono)',
    fontSize: 11,
    color: 'var(--cp-text-muted)',
    background: 'var(--cp-card)',
    overflowWrap: 'anywhere',
  },
  body: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 0.9fr)',
    minHeight: 0,
    flex: 1,
  },
  agentColumn: {
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
    minHeight: 0,
    borderRight: '1px solid var(--cp-border)',
    background: 'var(--cp-surface)',
  },
  columnHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: '12px 14px',
    borderBottom: '1px solid var(--cp-border)',
    fontFamily: 'var(--cp-font-title)',
    fontSize: 15,
    color: 'var(--cp-text)',
  },
  endpoint: {
    fontFamily: 'var(--cp-font-mono)',
    fontSize: 11,
    color: 'var(--cp-text-faint)',
    overflowWrap: 'anywhere',
  },
  agentFrame: {
    minHeight: 0,
    flex: 1,
    overflow: 'hidden',
  },
  controlColumn: {
    minWidth: 0,
    overflowY: 'auto',
    padding: 14,
    background: 'var(--cp-card)',
  },
  panel: {
    border: '1px solid var(--cp-border)',
    borderRadius: 8,
    padding: 12,
    background: 'var(--cp-surface)',
  },
  panelTitle: {
    marginBottom: 10,
    fontFamily: 'var(--cp-font-mono)',
    fontSize: 11,
    letterSpacing: 0,
    color: 'var(--cp-text-muted)',
  },
  agentGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: 8,
  },
  agentTile: {
    minWidth: 0,
    border: '1px solid var(--cp-border)',
    borderRadius: 8,
    padding: 10,
    background: 'var(--cp-bg)',
  },
  agentName: {
    display: 'block',
    marginBottom: 5,
    fontFamily: 'var(--cp-font-title)',
    fontSize: 14,
    color: 'var(--cp-text)',
    overflowWrap: 'anywhere',
  },
  agentMode: {
    fontFamily: 'var(--cp-font-mono)',
    fontSize: 10,
    color: 'var(--cp-teal-light)',
  },
  sectionGrid: {
    display: 'grid',
    gap: 10,
    marginTop: 10,
  },
  githubPanel: {
    display: 'grid',
    gap: 10,
    marginTop: 10,
    border: '1px solid var(--cp-border)',
    borderRadius: 8,
    padding: 12,
    background: 'var(--cp-surface)',
  },
  githubStatusRow: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  githubLabel: {
    fontFamily: 'var(--cp-font-title)',
    fontSize: 14,
    color: 'var(--cp-text)',
  },
  readyStatus: {
    border: '1px solid var(--cp-border)',
    borderRadius: 6,
    padding: '3px 6px',
    fontFamily: 'var(--cp-font-mono)',
    fontSize: 10,
    color: 'var(--cp-teal-light)',
    background: 'var(--cp-bg)',
  },
  warningStatus: {
    border: '1px solid var(--cp-border)',
    borderRadius: 6,
    padding: '3px 6px',
    fontFamily: 'var(--cp-font-mono)',
    fontSize: 10,
    color: 'var(--cp-text-muted)',
    background: 'var(--cp-bg)',
  },
  webhookBlock: {
    display: 'grid',
    gap: 5,
    minWidth: 0,
    padding: '8px 0',
  },
  webhookCaption: {
    fontFamily: 'var(--cp-font-mono)',
    fontSize: 10,
    color: 'var(--cp-text-faint)',
  },
  webhookCode: {
    display: 'block',
    fontFamily: 'var(--cp-font-mono)',
    fontSize: 11,
    color: 'var(--cp-text)',
    overflowWrap: 'anywhere',
  },
  helperText: {
    margin: 0,
    fontFamily: 'var(--cp-font-body)',
    fontSize: 12,
    lineHeight: 1.45,
    color: 'var(--cp-text-muted)',
  },
  installLink: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 32,
    border: '1px solid var(--cp-border)',
    borderRadius: 6,
    padding: '6px 10px',
    fontFamily: 'var(--cp-font-mono)',
    fontSize: 11,
    color: 'var(--cp-text)',
    background: 'var(--cp-bg)',
    textDecoration: 'none',
  },
  rowList: {
    display: 'grid',
    gap: 6,
  },
  controlRow: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    minWidth: 0,
    padding: '7px 0',
    borderBottom: '1px solid var(--cp-border)',
    fontFamily: 'var(--cp-font-body)',
    fontSize: 13,
    color: 'var(--cp-text-muted)',
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    flexShrink: 0,
    background: 'var(--cp-green)',
  },
};
