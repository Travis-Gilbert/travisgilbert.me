'use client';

/**
 * DiffCards (HANDOFF-CODE-SURFACE-UI D5): per-file cards for a run's diff
 * entries (dispatch-result diffs plus live SSE diff events merged into the
 * run record by RunTranscript). Review opens the DiffReview dialog; Undo
 * posts to /api/commonplace/code/revert and only marks the card reverted on
 * a confirmed 2xx (the working tree change itself re-triggers notify
 * ingestion; no extra call). Absent data collapses to nothing.
 */

import { useState, type CSSProperties } from 'react';
import { toast } from 'sonner';
import { useCodeSurfaceStore } from '@/lib/code-surface-store';
import { DiffReview } from './DiffReview';

export function DiffCards({ runId }: { runId: string }) {
  const run = useCodeSurfaceStore((s) => s.runs.find((item) => item.id === runId) ?? null);
  const [revertedPaths, setRevertedPaths] = useState<ReadonlySet<string>>(new Set());
  const [busyPath, setBusyPath] = useState<string | null>(null);
  const [reviewPath, setReviewPath] = useState<string | null>(null);

  const diffs = run?.diffs ?? [];
  if (!run || diffs.length === 0) return null;

  const undo = async (path: string) => {
    setBusyPath(path);
    try {
      const res = await fetch('/api/commonplace/code/revert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path }),
        cache: 'no-store',
      });
      const payload = (await res.json().catch(() => null)) as
        | { ok?: boolean; action?: string; error?: string }
        | null;
      if (!res.ok || !payload?.ok) {
        throw new Error(payload?.error ?? `Revert failed with ${res.status}`);
      }
      setRevertedPaths((prev) => new Set(prev).add(path));
      toast(`Reverted ${path}${payload.action === 'deleted' ? ' (untracked file deleted)' : ''}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Revert failed.');
    } finally {
      setBusyPath(null);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-2)',
        marginTop: 'var(--space-2)',
      }}
    >
      {diffs.map((diff) => {
        const reverted = revertedPaths.has(diff.path);
        return (
          <div
            key={diff.path}
            title={diff.summary || undefined}
            style={{
              background: 'var(--surface-2)',
              border: 'var(--hairline)',
              borderRadius: 'var(--radius-sm)',
              padding: 'var(--space-2) var(--space-3)',
              display: 'flex',
              alignItems: 'baseline',
              gap: 'var(--space-3)',
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--text--1)',
            }}
          >
            <span
              style={{
                flex: 1,
                minWidth: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                color: reverted ? 'var(--text-faint)' : 'var(--text)',
              }}
            >
              {diff.path}
            </span>
            <span style={{ color: 'var(--accent-memory)', flexShrink: 0 }}>+{diff.added}</span>
            <span style={{ color: 'var(--danger, var(--accent))', flexShrink: 0 }}>
              -{diff.removed}
            </span>
            {reverted ? (
              <span style={{ color: 'var(--text-faint)', flexShrink: 0 }}>reverted</span>
            ) : (
              <span style={{ display: 'inline-flex', gap: 'var(--space-2)', flexShrink: 0 }}>
                <button
                  type="button"
                  style={quietTextButtonStyle}
                  onClick={() => setReviewPath(diff.path)}
                >
                  Review
                </button>
                <button
                  type="button"
                  style={quietTextButtonStyle}
                  disabled={busyPath === diff.path}
                  onClick={() => void undo(diff.path)}
                >
                  {busyPath === diff.path ? 'Reverting' : 'Undo'}
                </button>
              </span>
            )}
          </div>
        );
      })}

      <DiffReview
        path={reviewPath}
        open={reviewPath !== null}
        onOpenChange={(open) => {
          if (!open) setReviewPath(null);
        }}
      />
    </div>
  );
}

const quietTextButtonStyle: CSSProperties = {
  background: 'none',
  border: 'none',
  padding: 0,
  cursor: 'pointer',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--text--1)',
  color: 'var(--text-dim)',
  textDecorationLine: 'underline',
  textDecorationColor: 'var(--border)',
  textUnderlineOffset: 'var(--space-1)',
};
