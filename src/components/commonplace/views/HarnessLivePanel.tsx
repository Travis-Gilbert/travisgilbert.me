'use client';

import { RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import {
  fetchHarnessLiveSummary,
  type HarnessLiveActivity,
  type HarnessLiveMemoryDoc,
  type HarnessLiveSummary,
} from '@/lib/theorem-harness-live';

type HarnessPanelState =
  | { kind: 'loading' }
  | { kind: 'ready'; summary: HarnessLiveSummary }
  | { kind: 'error'; message: string };

export default function HarnessLivePanel() {
  const [state, setState] = useState<HarnessPanelState>({ kind: 'loading' });

  const refreshSummary = useCallback(async () => {
    try {
      const summary = await fetchHarnessLiveSummary();
      setState({ kind: 'ready', summary });
    } catch (err) {
      setState({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Harness summary unavailable.',
      });
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void fetchHarnessLiveSummary(controller.signal)
      .then((summary) => {
        setState({ kind: 'ready', summary });
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setState({
          kind: 'error',
          message: err instanceof Error ? err.message : 'Harness summary unavailable.',
        });
      });
    return () => controller.abort();
  }, []);

  const summary = state.kind === 'ready' ? state.summary : null;

  return (
    <section style={styles.panel} aria-label="Live Theorem substrate">
      <div style={styles.header}>
        <div>
          <div style={styles.panelTitle}>Live substrate</div>
          <div style={styles.roomLine}>{summary?.roomId ?? 'commonplace'}</div>
        </div>
        <button
          type="button"
          style={styles.iconButton}
          title="Refresh live substrate"
          aria-label="Refresh live substrate"
          onClick={() => void refreshSummary()}
        >
          <RefreshCw size={14} strokeWidth={1.8} aria-hidden="true" />
        </button>
      </div>

      {state.kind === 'loading' ? (
        <p style={styles.helperText}>Checking harness.</p>
      ) : state.kind === 'error' ? (
        <p style={styles.helperText}>{state.message}</p>
      ) : (
        <HarnessLiveContent summary={state.summary} />
      )}
    </section>
  );
}

function HarnessLiveContent({ summary }: { summary: HarnessLiveSummary }) {
  const live = summary.source === 'live';

  return (
    <>
      <div style={styles.statusRow}>
        <span style={live ? styles.liveStatus : styles.warningStatus}>
          {live ? 'live' : 'unavailable'}
        </span>
        <span style={styles.sourceLabel}>{summary.sourceLabel}</span>
      </div>

      <div style={styles.countGrid} aria-label="Harness counts">
        <CountCell label="Memory" value={summary.counts.memory} />
        <CountCell label="Records" value={summary.counts.records} />
        <CountCell label="Messages" value={summary.counts.messages} />
        <CountCell label="Presence" value={summary.counts.presence} />
      </div>

      <div style={styles.section}>
        <div style={styles.sectionTitle}>Memory</div>
        {summary.memory.length ? (
          <div style={styles.list}>
            {summary.memory.slice(0, 3).map((doc) => (
              <MemoryRow key={doc.id} doc={doc} />
            ))}
          </div>
        ) : (
          <p style={styles.helperText}>No recalled memories.</p>
        )}
      </div>

      <div style={styles.section}>
        <div style={styles.sectionTitle}>Room log</div>
        {summary.activity.length ? (
          <div style={styles.list}>
            {summary.activity.slice(0, 4).map((item) => (
              <ActivityRow key={`${item.kind}:${item.id}`} item={item} />
            ))}
          </div>
        ) : (
          <p style={styles.helperText}>No recent room records.</p>
        )}
      </div>
    </>
  );
}

function CountCell({ label, value }: { label: string; value: number }) {
  return (
    <div style={styles.countCell}>
      <span style={styles.countValue}>{value}</span>
      <span style={styles.countLabel}>{label}</span>
    </div>
  );
}

function MemoryRow({ doc }: { doc: HarnessLiveMemoryDoc }) {
  return (
    <article style={styles.row}>
      <div style={styles.rowTop}>
        <span style={styles.rowTitle}>{doc.title}</span>
        <span style={styles.meta}>{doc.servedTier ?? doc.kind}</span>
      </div>
      {doc.excerpt ? <p style={styles.rowText}>{doc.excerpt}</p> : null}
      <div style={styles.metaLine}>
        <span>{doc.kind}</span>
        {doc.updatedAt ? <span>{formatHarnessTime(doc.updatedAt)}</span> : null}
      </div>
    </article>
  );
}

function ActivityRow({ item }: { item: HarnessLiveActivity }) {
  return (
    <article style={styles.row}>
      <div style={styles.rowTop}>
        <span style={styles.rowTitle}>{item.title}</span>
        <span style={styles.meta}>{item.kind}</span>
      </div>
      {item.summary ? <p style={styles.rowText}>{item.summary}</p> : null}
      <div style={styles.metaLine}>
        {item.actor ? <span>{item.actor}</span> : <span>harness</span>}
        {item.updatedAt ? <span>{formatHarnessTime(item.updatedAt)}</span> : null}
      </div>
    </article>
  );
}

function formatHarnessTime(value: string): string {
  const unixPrefix = 'unix_ms:';
  const raw = value.startsWith(unixPrefix) ? value.slice(unixPrefix.length) : value;
  const numeric = Number(raw);
  const date = Number.isFinite(numeric) ? new Date(numeric) : new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

const styles: Record<string, CSSProperties> = {
  panel: {
    display: 'grid',
    gap: 12,
    marginTop: 10,
    border: '1px solid var(--cp-border)',
    borderRadius: 8,
    padding: 12,
    background: 'var(--cp-surface)',
  },
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  panelTitle: {
    marginBottom: 5,
    fontFamily: 'var(--cp-font-mono)',
    fontSize: 11,
    letterSpacing: 0,
    color: 'var(--cp-text-muted)',
  },
  roomLine: {
    fontFamily: 'var(--cp-font-title)',
    fontSize: 15,
    color: 'var(--cp-text)',
    overflowWrap: 'anywhere',
  },
  iconButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 30,
    height: 30,
    border: '1px solid var(--cp-border)',
    borderRadius: 6,
    color: 'var(--cp-text-muted)',
    background: 'var(--cp-bg)',
    cursor: 'pointer',
    flexShrink: 0,
  },
  statusRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    minWidth: 0,
  },
  liveStatus: {
    border: '1px solid var(--cp-border)',
    borderRadius: 6,
    padding: '3px 6px',
    fontFamily: 'var(--cp-font-mono)',
    fontSize: 10,
    color: 'var(--cp-green)',
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
  sourceLabel: {
    minWidth: 0,
    fontFamily: 'var(--cp-font-mono)',
    fontSize: 10,
    color: 'var(--cp-text-faint)',
    overflowWrap: 'anywhere',
  },
  countGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    borderTop: '1px solid var(--cp-border)',
    borderBottom: '1px solid var(--cp-border)',
  },
  countCell: {
    display: 'grid',
    gap: 2,
    minWidth: 0,
    padding: '8px 6px',
    borderRight: '1px solid var(--cp-border)',
  },
  countValue: {
    fontFamily: 'var(--cp-font-title)',
    fontSize: 16,
    color: 'var(--cp-text)',
  },
  countLabel: {
    fontFamily: 'var(--cp-font-mono)',
    fontSize: 9,
    color: 'var(--cp-text-faint)',
    overflowWrap: 'anywhere',
  },
  section: {
    display: 'grid',
    gap: 6,
    minWidth: 0,
  },
  sectionTitle: {
    fontFamily: 'var(--cp-font-mono)',
    fontSize: 10,
    color: 'var(--cp-text-faint)',
  },
  list: {
    display: 'grid',
    gap: 0,
  },
  row: {
    display: 'grid',
    gap: 5,
    minWidth: 0,
    padding: '8px 0',
    borderTop: '1px solid var(--cp-border)',
  },
  rowTop: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 8,
    minWidth: 0,
  },
  rowTitle: {
    minWidth: 0,
    fontFamily: 'var(--cp-font-title)',
    fontSize: 13,
    color: 'var(--cp-text)',
    overflowWrap: 'anywhere',
  },
  rowText: {
    margin: 0,
    fontFamily: 'var(--cp-font-body)',
    fontSize: 12,
    lineHeight: 1.45,
    color: 'var(--cp-text-muted)',
    overflowWrap: 'anywhere',
  },
  meta: {
    flexShrink: 0,
    fontFamily: 'var(--cp-font-mono)',
    fontSize: 9,
    color: 'var(--cp-green)',
  },
  metaLine: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    fontFamily: 'var(--cp-font-mono)',
    fontSize: 9,
    color: 'var(--cp-text-faint)',
  },
  helperText: {
    margin: 0,
    fontFamily: 'var(--cp-font-body)',
    fontSize: 12,
    lineHeight: 1.45,
    color: 'var(--cp-text-muted)',
  },
};
