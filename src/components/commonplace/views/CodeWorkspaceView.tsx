'use client';

import type { CSSProperties } from 'react';
import AgentThreadView from './AgentThreadView';

const trackedScopes = [
  { label: 'CommonPlace app', path: 'apps/web', state: 'active' },
  { label: 'Agent route', path: '/api/theorem/agent', state: 'wired' },
  { label: 'ACP dock', path: '/api/commonplace/acp/ws', state: 'available' },
  { label: 'Rust substrate', path: 'crates/commonplace-*', state: 'indexed' },
];

const workQueue = [
  { label: 'Plan', value: 'CommonPlace sink' },
  { label: 'Patch', value: 'product shell' },
  { label: 'Verify', value: 'local app' },
];

export default function CodeWorkspaceView() {
  return (
    <section style={styles.shell} aria-label="CommonPlace code workspace">
      <header style={styles.header}>
        <div>
          <p style={styles.eyebrow}>WORKSPACE</p>
          <h1 style={styles.title}>Code</h1>
        </div>
        <div style={styles.badgeRow}>
          <span style={styles.badge}>CommonPlace Chat</span>
          <span style={styles.badge}>ACP</span>
        </div>
      </header>

      <div style={styles.grid}>
        <aside style={styles.scopePanel} aria-label="Repository scopes">
          <div style={styles.panelHeader}>Scopes</div>
          <div style={styles.scopeList}>
            {trackedScopes.map((scope) => (
              <article key={scope.path} style={styles.scopeItem}>
                <div>
                  <div style={styles.scopeLabel}>{scope.label}</div>
                  <code style={styles.scopePath}>{scope.path}</code>
                </div>
                <span style={styles.statePill}>{scope.state}</span>
              </article>
            ))}
          </div>
        </aside>

        <main style={styles.agentPanel} aria-label="Code agent">
          <AgentThreadView agentId="theorem" agentMode="api" />
        </main>

        <aside style={styles.runPanel} aria-label="Run state">
          <div style={styles.panelHeader}>Run</div>
          <div style={styles.queueList}>
            {workQueue.map((item) => (
              <div key={item.label} style={styles.queueItem}>
                <span style={styles.queueLabel}>{item.label}</span>
                <span style={styles.queueValue}>{item.value}</span>
              </div>
            ))}
          </div>

          <div style={styles.divider} />

          <div style={styles.panelHeader}>Diffs</div>
          <div style={styles.diffBox}>
            <span style={styles.diffLine}>+ CommonPlace-native code surface</span>
            <span style={styles.diffLine}>+ Account-scoped agent controls</span>
            <span style={styles.diffLine}>+ Harness route absorption map</span>
          </div>
        </aside>
      </div>
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
    padding: '16px 18px 12px',
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
    fontSize: 26,
    fontWeight: 600,
    letterSpacing: 0,
    color: 'var(--cp-text)',
  },
  badgeRow: {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 8,
  },
  badge: {
    border: '1px solid var(--cp-border)',
    borderRadius: 6,
    padding: '6px 8px',
    fontFamily: 'var(--cp-font-mono)',
    fontSize: 11,
    color: 'var(--cp-text-muted)',
    background: 'var(--cp-card)',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 0.65fr) minmax(0, 1.8fr) minmax(0, 0.8fr)',
    minHeight: 0,
    flex: 1,
  },
  scopePanel: {
    minWidth: 0,
    padding: 14,
    borderRight: '1px solid var(--cp-border)',
    background: 'var(--cp-card)',
    overflowY: 'auto',
  },
  agentPanel: {
    minWidth: 0,
    minHeight: 0,
    overflow: 'hidden',
    background: 'var(--cp-surface)',
  },
  runPanel: {
    minWidth: 0,
    padding: 14,
    borderLeft: '1px solid var(--cp-border)',
    background: 'var(--cp-card)',
    overflowY: 'auto',
  },
  panelHeader: {
    marginBottom: 10,
    fontFamily: 'var(--cp-font-mono)',
    fontSize: 11,
    letterSpacing: 0,
    color: 'var(--cp-text-muted)',
  },
  scopeList: {
    display: 'grid',
    gap: 8,
  },
  scopeItem: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
    padding: 10,
    border: '1px solid var(--cp-border)',
    borderRadius: 8,
    background: 'var(--cp-surface)',
  },
  scopeLabel: {
    marginBottom: 4,
    fontFamily: 'var(--cp-font-title)',
    fontSize: 14,
    color: 'var(--cp-text)',
  },
  scopePath: {
    display: 'block',
    fontFamily: 'var(--cp-font-mono)',
    fontSize: 11,
    color: 'var(--cp-text-faint)',
    overflowWrap: 'anywhere',
  },
  statePill: {
    flexShrink: 0,
    border: '1px solid var(--cp-border)',
    borderRadius: 6,
    padding: '3px 6px',
    fontFamily: 'var(--cp-font-mono)',
    fontSize: 10,
    color: 'var(--cp-teal-light)',
    background: 'var(--cp-bg)',
  },
  queueList: {
    display: 'grid',
    gap: 8,
  },
  queueItem: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    padding: '9px 0',
    borderBottom: '1px solid var(--cp-border)',
  },
  queueLabel: {
    fontFamily: 'var(--cp-font-mono)',
    fontSize: 11,
    color: 'var(--cp-text-faint)',
  },
  queueValue: {
    fontFamily: 'var(--cp-font-body)',
    fontSize: 13,
    color: 'var(--cp-text)',
    textAlign: 'right',
    overflowWrap: 'anywhere',
  },
  divider: {
    height: 1,
    margin: '18px 0 14px',
    background: 'var(--cp-border)',
  },
  diffBox: {
    display: 'grid',
    gap: 7,
    border: '1px solid var(--cp-border)',
    borderRadius: 8,
    padding: 10,
    background: 'var(--cp-bg)',
  },
  diffLine: {
    fontFamily: 'var(--cp-font-mono)',
    fontSize: 11,
    color: 'var(--cp-green)',
    overflowWrap: 'anywhere',
  },
};
