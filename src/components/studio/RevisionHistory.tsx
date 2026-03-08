'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  fetchRevisions,
  fetchRevisionDiff,
  restoreRevision,
  type ContentRevisionSummary,
  type ContentRevisionDiff,
  type RevisionSource,
} from '@/lib/studio-api';

const SOURCE_LABELS: Record<RevisionSource, string> = {
  autosave: 'Auto',
  manual: 'Save',
  stage: 'Stage',
  restore: 'Checkpoint',
};

const SOURCE_COLORS: Record<RevisionSource, string> = {
  autosave: 'var(--studio-text-3)',
  manual: 'var(--studio-tc)',
  stage: '#6A9A5A',
  restore: '#C49A4A',
};

function formatRevisionTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60_000);

  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * Revision history panel for the workbench.
 * Shows a scrollable list of revisions with diff view and restore.
 */
export default function RevisionHistory({
  contentType,
  slug,
}: {
  contentType: string;
  slug: string;
}) {
  const [revisions, setRevisions] = useState<ContentRevisionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* Diff state */
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [diff, setDiff] = useState<ContentRevisionDiff | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);

  /* Compare mode: select two revisions */
  const [compareMode, setCompareMode] = useState(false);
  const [compareA, setCompareA] = useState<number | null>(null);
  const [compareB, setCompareB] = useState<number | null>(null);

  /* Restore state */
  const [restoring, setRestoring] = useState(false);
  const [confirmRestore, setConfirmRestore] = useState<number | null>(null);

  const loadRevisions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchRevisions(contentType, slug);
      setRevisions(data);
    } catch {
      setError('Could not load revision history');
    } finally {
      setLoading(false);
    }
  }, [contentType, slug]);

  useEffect(() => {
    void loadRevisions();
  }, [loadRevisions]);

  /* Load diff when a revision is selected */
  const handleSelectRevision = useCallback(
    async (id: number) => {
      if (compareMode) {
        /* In compare mode, collect two selections */
        if (compareA === null) {
          setCompareA(id);
          return;
        }
        if (compareB === null && id !== compareA) {
          setCompareB(id);
          /* Fetch diff between A and B */
          setDiffLoading(true);
          try {
            const d = await fetchRevisionDiff(contentType, slug, id, compareA);
            setDiff(d);
            setSelectedId(id);
          } catch {
            setError('Could not load diff');
          } finally {
            setDiffLoading(false);
          }
          return;
        }
        /* Reset compare if clicking a third time */
        setCompareA(id);
        setCompareB(null);
        setDiff(null);
        return;
      }

      /* Normal mode: toggle selection, diff against previous */
      if (selectedId === id) {
        setSelectedId(null);
        setDiff(null);
        return;
      }

      setSelectedId(id);
      setDiffLoading(true);
      try {
        const d = await fetchRevisionDiff(contentType, slug, id);
        setDiff(d);
      } catch {
        setError('Could not load diff');
      } finally {
        setDiffLoading(false);
      }
    },
    [contentType, slug, selectedId, compareMode, compareA, compareB],
  );

  const handleRestore = useCallback(
    async (revisionId: number) => {
      setRestoring(true);
      try {
        await restoreRevision(contentType, slug, revisionId);
        setConfirmRestore(null);
        setSelectedId(null);
        setDiff(null);
        /* Reload revisions (new checkpoint will appear) and reload page for content */
        await loadRevisions();
        window.location.reload();
      } catch {
        setError('Restore failed');
      } finally {
        setRestoring(false);
      }
    },
    [contentType, slug, loadRevisions],
  );

  const toggleCompareMode = useCallback(() => {
    setCompareMode((prev) => !prev);
    setCompareA(null);
    setCompareB(null);
    setDiff(null);
    setSelectedId(null);
  }, []);

  if (loading) {
    return (
      <div style={styles.emptyState}>
        <span style={styles.spinner} />
        Loading history...
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.emptyState}>
        <span style={{ color: 'var(--studio-error, #D4644A)' }}>{error}</span>
        <button type="button" onClick={loadRevisions} style={styles.retryBtn}>
          Retry
        </button>
      </div>
    );
  }

  if (revisions.length === 0) {
    return (
      <div style={styles.emptyState}>
        No revisions yet. Revisions are created when you save, change stages, or periodically during editing.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* Header with compare toggle */}
      <div style={styles.header}>
        <span style={styles.headerLabel}>
          {revisions.length} revision{revisions.length !== 1 ? 's' : ''}
        </span>
        <button
          type="button"
          onClick={toggleCompareMode}
          style={{
            ...styles.compareBtn,
            backgroundColor: compareMode ? 'var(--studio-tc)' : 'transparent',
            color: compareMode ? '#fff' : 'var(--studio-text-3)',
          }}
        >
          {compareMode ? 'Exit Compare' : 'Compare'}
        </button>
      </div>

      {compareMode && (
        <div style={styles.compareTip}>
          {!compareA
            ? 'Select first revision...'
            : !compareB
              ? 'Now select second revision...'
              : 'Showing diff between selected revisions'}
        </div>
      )}

      {/* Revision list */}
      <div style={styles.list}>
        {revisions.map((rev) => {
          const isSelected = selectedId === rev.id;
          const isCompareA = compareA === rev.id;
          const isCompareB = compareB === rev.id;
          const isHighlighted = isSelected || isCompareA || isCompareB;

          return (
            <button
              key={rev.id}
              type="button"
              onClick={() => handleSelectRevision(rev.id)}
              style={{
                ...styles.revisionItem,
                backgroundColor: isHighlighted
                  ? 'var(--studio-surface-elevated, rgba(237,231,220,0.06))'
                  : 'transparent',
                borderLeft: isHighlighted
                  ? '2px solid var(--studio-tc)'
                  : '2px solid transparent',
              }}
            >
              <div style={styles.revisionTop}>
                <span
                  style={{
                    ...styles.sourceTag,
                    color: SOURCE_COLORS[rev.source],
                    borderColor: SOURCE_COLORS[rev.source],
                  }}
                >
                  {SOURCE_LABELS[rev.source]}
                </span>
                <span style={styles.revisionTime}>
                  {formatRevisionTime(rev.createdAt)}
                </span>
              </div>
              <div style={styles.revisionMeta}>
                <span style={styles.revisionTitle}>
                  {rev.title || 'Untitled'}
                </span>
                <span style={styles.wordCount}>
                  {rev.wordCount.toLocaleString()} words
                </span>
              </div>
              {rev.label && (
                <div style={styles.revisionLabel}>{rev.label}</div>
              )}
              {(isCompareA || isCompareB) && (
                <span style={styles.compareMarker}>
                  {isCompareA ? 'A' : 'B'}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Diff view */}
      {diffLoading && (
        <div style={styles.emptyState}>
          <span style={styles.spinner} />
          Loading diff...
        </div>
      )}

      {diff && !diffLoading && (
        <div style={styles.diffContainer}>
          <div style={styles.diffHeader}>
            <span style={styles.headerLabel}>
              Changes {diff.compareTo ? `(rev ${diff.compareTo} \u2192 rev ${diff.revision})` : `(rev ${diff.revision})`}
            </span>
            <span
              style={{
                ...styles.wordDelta,
                color:
                  diff.wordCountDelta > 0
                    ? '#6A9A5A'
                    : diff.wordCountDelta < 0
                      ? '#D4644A'
                      : 'var(--studio-text-3)',
              }}
            >
              {diff.wordCountDelta > 0 ? '+' : ''}
              {diff.wordCountDelta} words
            </span>
          </div>
          <div style={styles.diffBody}>
            {diff.diff.length === 0 ? (
              <div style={{ ...styles.emptyState, padding: '12px' }}>
                No differences found
              </div>
            ) : (
              diff.diff.map((line, i) => {
                let lineStyle = styles.diffLine;
                if (line.startsWith('+') && !line.startsWith('+++')) {
                  lineStyle = { ...lineStyle, ...styles.diffAdded };
                } else if (line.startsWith('-') && !line.startsWith('---')) {
                  lineStyle = { ...lineStyle, ...styles.diffRemoved };
                } else if (line.startsWith('@@')) {
                  lineStyle = { ...lineStyle, ...styles.diffHunk };
                }
                return (
                  <div key={`${i}-${line.slice(0, 20)}`} style={lineStyle}>
                    {line}
                  </div>
                );
              })
            )}
          </div>

          {/* Restore button */}
          {!compareMode && selectedId && (
            <div style={styles.restoreArea}>
              {confirmRestore === selectedId ? (
                <div style={styles.confirmRow}>
                  <span style={styles.confirmText}>
                    Restore this revision? Your current content will be checkpointed first.
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRestore(selectedId)}
                    disabled={restoring}
                    style={styles.confirmYes}
                  >
                    {restoring ? 'Restoring...' : 'Yes, restore'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmRestore(null)}
                    style={styles.confirmNo}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmRestore(selectedId)}
                  style={styles.restoreBtn}
                >
                  Restore this revision
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Inline styles ─────────────────────────────── */

const styles: Record<string, React.CSSProperties> = {
  emptyState: {
    fontFamily: 'var(--studio-font-serif)',
    fontSize: '12px',
    color: 'var(--studio-text-3)',
    fontStyle: 'italic',
    textAlign: 'center',
    padding: '24px 12px',
    lineHeight: 1.5,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
  },
  spinner: {
    display: 'inline-block',
    width: '14px',
    height: '14px',
    border: '2px solid var(--studio-border)',
    borderTopColor: 'var(--studio-tc)',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLabel: {
    fontFamily: 'var(--studio-font-mono)',
    fontSize: '8.5px',
    fontWeight: 700,
    letterSpacing: '0.12em',
    textTransform: 'uppercase' as const,
    color: 'var(--studio-text-3)',
  },
  compareBtn: {
    fontFamily: 'var(--studio-font-mono)',
    fontSize: '8.5px',
    fontWeight: 600,
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
    border: '1px solid var(--studio-border)',
    borderRadius: '3px',
    padding: '3px 8px',
    cursor: 'pointer',
    transition: 'all 0.12s ease',
  },
  compareTip: {
    fontFamily: 'var(--studio-font-mono)',
    fontSize: '9px',
    color: 'var(--studio-tc)',
    padding: '4px 8px',
    backgroundColor: 'rgba(180, 90, 45, 0.08)',
    borderRadius: '3px',
    textAlign: 'center',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1px',
    maxHeight: '260px',
    overflowY: 'auto',
    borderRadius: '4px',
    border: '1px solid var(--studio-border)',
  },
  revisionItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '3px',
    padding: '8px 10px',
    border: 'none',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'background-color 0.1s ease',
    position: 'relative',
  },
  revisionTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sourceTag: {
    fontFamily: 'var(--studio-font-mono)',
    fontSize: '8px',
    fontWeight: 700,
    letterSpacing: '0.1em',
    textTransform: 'uppercase' as const,
    padding: '1px 5px',
    border: '1px solid',
    borderRadius: '2px',
  },
  revisionTime: {
    fontFamily: 'var(--studio-font-mono)',
    fontSize: '9px',
    color: 'var(--studio-text-3)',
  },
  revisionMeta: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  revisionTitle: {
    fontFamily: 'var(--studio-font-serif)',
    fontSize: '11px',
    color: 'var(--studio-text-2)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: '65%',
  },
  wordCount: {
    fontFamily: 'var(--studio-font-mono)',
    fontSize: '9px',
    color: 'var(--studio-text-3)',
  },
  revisionLabel: {
    fontFamily: 'var(--studio-font-serif)',
    fontSize: '9.5px',
    fontStyle: 'italic',
    color: 'var(--studio-tc)',
  },
  compareMarker: {
    position: 'absolute',
    top: '4px',
    right: '6px',
    fontFamily: 'var(--studio-font-mono)',
    fontSize: '8px',
    fontWeight: 700,
    width: '14px',
    height: '14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '50%',
    backgroundColor: 'var(--studio-tc)',
    color: '#fff',
  },
  diffContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  diffHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  wordDelta: {
    fontFamily: 'var(--studio-font-mono)',
    fontSize: '9px',
    fontWeight: 600,
  },
  diffBody: {
    fontFamily: 'var(--studio-font-mono)',
    fontSize: '10px',
    lineHeight: 1.5,
    maxHeight: '300px',
    overflowY: 'auto',
    border: '1px solid var(--studio-border)',
    borderRadius: '4px',
    padding: '6px',
  },
  diffLine: {
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    padding: '1px 4px',
    borderRadius: '2px',
  },
  diffAdded: {
    backgroundColor: 'rgba(106, 154, 90, 0.15)',
    color: '#6A9A5A',
  },
  diffRemoved: {
    backgroundColor: 'rgba(212, 100, 74, 0.15)',
    color: '#D4644A',
  },
  diffHunk: {
    color: 'var(--studio-text-3)',
    fontStyle: 'italic',
    margin: '4px 0 2px',
  },
  restoreArea: {
    paddingTop: '8px',
    borderTop: '1px solid var(--studio-border)',
  },
  restoreBtn: {
    width: '100%',
    fontFamily: 'var(--studio-font-mono)',
    fontSize: '9.5px',
    fontWeight: 600,
    letterSpacing: '0.06em',
    textTransform: 'uppercase' as const,
    color: 'var(--studio-text-2)',
    backgroundColor: 'transparent',
    border: '1px solid var(--studio-border)',
    borderRadius: '4px',
    padding: '6px 12px',
    cursor: 'pointer',
    transition: 'all 0.12s ease',
  },
  confirmRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    alignItems: 'stretch',
  },
  confirmText: {
    fontFamily: 'var(--studio-font-serif)',
    fontSize: '11px',
    color: 'var(--studio-text-2)',
    lineHeight: 1.4,
  },
  confirmYes: {
    fontFamily: 'var(--studio-font-mono)',
    fontSize: '9.5px',
    fontWeight: 700,
    letterSpacing: '0.06em',
    textTransform: 'uppercase' as const,
    color: '#fff',
    backgroundColor: 'var(--studio-tc)',
    border: 'none',
    borderRadius: '4px',
    padding: '6px 12px',
    cursor: 'pointer',
  },
  confirmNo: {
    fontFamily: 'var(--studio-font-mono)',
    fontSize: '9.5px',
    fontWeight: 600,
    letterSpacing: '0.06em',
    textTransform: 'uppercase' as const,
    color: 'var(--studio-text-3)',
    backgroundColor: 'transparent',
    border: '1px solid var(--studio-border)',
    borderRadius: '4px',
    padding: '6px 12px',
    cursor: 'pointer',
  },
  retryBtn: {
    fontFamily: 'var(--studio-font-mono)',
    fontSize: '9px',
    fontWeight: 600,
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
    color: 'var(--studio-tc)',
    backgroundColor: 'transparent',
    border: '1px solid var(--studio-tc)',
    borderRadius: '3px',
    padding: '4px 10px',
    cursor: 'pointer',
  },
};
