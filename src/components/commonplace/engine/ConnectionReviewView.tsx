'use client';

/**
 * ConnectionReviewView: rate engine-discovered connections as useful or not.
 *
 * Each rating creates a ConnectionFeedback record with a snapshotted feature
 * vector. Once 50+ records exist, `train_scorer` can train the Level 2
 * learned scorer. Self-contained styles using --cp-* tokens.
 */

import { useState, useCallback } from 'react';
import { CheckCircle, Xmark, FlashOff } from 'iconoir-react';
import {
  fetchReviewQueue,
  submitConnectionFeedback,
  useApiData,
} from '@/lib/commonplace-api';
import type { ReviewQueueEdge, FeedbackStats } from '@/lib/commonplace-api';
import { useDrawer } from '@/lib/providers/drawer-provider';
import { getObjectTypeIdentity } from '@/lib/commonplace';

export default function ConnectionReviewView() {
  const { openDrawer } = useDrawer();
  const { data, loading, error, refetch } = useApiData(
    () => fetchReviewQueue({ limit: 40 }),
    [],
  );

  const [dismissed, setDismissed] = useState<Set<number>>(new Set());
  const [animatingOut, setAnimatingOut] = useState<number | null>(null);
  const [localStats, setLocalStats] = useState<FeedbackStats | null>(null);

  const stats = localStats ?? data?.feedback_stats ?? null;
  const edges = (data?.results ?? []).filter((e) => !dismissed.has(e.edge_id));

  const handleFeedback = useCallback(
    async (edge: ReviewQueueEdge, label: 'engaged' | 'dismissed') => {
      setAnimatingOut(edge.edge_id);

      try {
        await submitConnectionFeedback({
          from_object: edge.from_object,
          to_object: edge.to_object,
          label,
          feature_vector: edge.feature_vector,
          edge: edge.edge_id,
        });
      } catch {
        // Optimistic: still dismiss the card even if the POST fails
      }

      setTimeout(() => {
        setDismissed((prev) => new Set(prev).add(edge.edge_id));
        setAnimatingOut(null);
        setLocalStats((prev) => {
          const total = (prev?.total ?? stats?.total ?? 0) + 1;
          return {
            total,
            training_ready: total >= 50,
            training_tier:
              total >= 200 ? 'full' : total >= 50 ? 'blended' : 'fixed_weights',
            needed_for_training: Math.max(0, 50 - total),
          };
        });
      }, 220);
    },
    [stats],
  );

  /* ── Progress bar ── */
  const progressTotal = stats?.total ?? 0;
  const progressTarget = 50;
  const progressPct = Math.min(100, (progressTotal / progressTarget) * 100);
  const isTrainingReady = stats?.training_ready ?? false;

  return (
    <div className="cr-view">
      <style>{`
        .cr-view {
          display: flex;
          flex-direction: column;
          height: 100%;
          overflow-y: auto;
          padding: 24px 16px;
          font-family: var(--cp-font-body);

          /* Parchment-context token overrides (not inside cp-pane-content) */
          --cp-text: #2A2520;
          --cp-text-muted: #5C554D;
          --cp-text-faint: #8A8279;
          --cp-text-ghost: #AEA89F;
          --cp-color-text: var(--cp-text);
          --cp-color-text-muted: var(--cp-text-muted);
          --cp-border: rgba(42, 37, 32, 0.12);
          --cp-border-faint: rgba(42, 37, 32, 0.07);
          --cp-surface: rgba(237, 228, 214, 0.65);
          --cp-red-soft: rgba(184, 98, 61, 0.08);
          --cp-red-line: rgba(184, 98, 61, 0.20);
          color: var(--cp-text);
        }
        .cr-header {
          max-width: 640px;
          margin: 0 auto 20px;
          width: 100%;
        }
        .cr-title {
          font-family: var(--cp-font-title);
          font-size: 20px;
          font-weight: 600;
          margin-bottom: 4px;
          color: var(--cp-text);
        }
        .cr-subtitle {
          font-size: 13px;
          color: var(--cp-text-muted);
          margin-bottom: 12px;
        }
        .cr-progress-wrap {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .cr-progress-bar {
          flex: 1;
          height: 4px;
          border-radius: 2px;
          background: var(--cp-border);
          overflow: hidden;
        }
        .cr-progress-fill {
          height: 100%;
          border-radius: 2px;
          transition: width 0.3s ease, background 0.3s ease;
        }
        .cr-progress-label {
          font-size: 12px;
          font-family: var(--cp-font-mono);
          color: var(--cp-text-faint);
          white-space: nowrap;
        }
        .cr-training-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 11px;
          font-weight: 600;
          padding: 2px 8px;
          border-radius: 10px;
          background: rgba(90, 160, 90, 0.15);
          color: #7ac47a;
          margin-left: 8px;
        }
        .cr-cards {
          max-width: 640px;
          margin: 0 auto;
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .cr-card {
          background: rgba(242, 236, 224, 0.20);
          backdrop-filter: blur(4px);
          -webkit-backdrop-filter: blur(4px);
          border: 1px solid var(--cp-border);
          border-radius: 8px;
          padding: 14px 16px;
          transition: opacity 0.2s ease, transform 0.2s ease;
        }
        .cr-card--exiting {
          opacity: 0;
          transform: translateX(-40px);
        }
        .cr-card-top {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 8px;
        }
        .cr-connection {
          display: flex;
          align-items: center;
          gap: 6px;
          flex: 1;
          min-width: 0;
        }
        .cr-type-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .cr-obj-title {
          font-size: 13px;
          font-weight: 500;
          color: var(--cp-text);
          cursor: pointer;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .cr-obj-title:hover {
          text-decoration: underline;
          color: var(--cp-red);
        }
        .cr-arrow {
          font-size: 11px;
          color: var(--cp-text-faint);
          flex-shrink: 0;
        }
        .cr-strength-wrap {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-shrink: 0;
        }
        .cr-strength-bar {
          width: 48px;
          height: 3px;
          border-radius: 2px;
          background: var(--cp-border);
          overflow: hidden;
        }
        .cr-strength-fill {
          height: 100%;
          border-radius: 2px;
        }
        .cr-strength-val {
          font-size: 11px;
          font-family: var(--cp-font-mono);
          color: var(--cp-text-faint);
          min-width: 28px;
          text-align: right;
        }
        .cr-reason {
          font-size: 12px;
          color: var(--cp-text-muted);
          margin-bottom: 8px;
          line-height: 1.4;
        }
        .cr-meta {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }
        .cr-engine {
          font-size: 11px;
          font-family: var(--cp-font-mono);
          color: var(--cp-text-faint);
        }
        .cr-actions {
          display: flex;
          gap: 6px;
        }
        .cr-btn {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 12px;
          font-weight: 500;
          padding: 4px 12px;
          border-radius: 6px;
          border: 1px solid var(--cp-border);
          background: transparent;
          color: var(--cp-text-muted);
          cursor: pointer;
          transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
        }
        .cr-btn--useful:hover {
          background: rgba(90, 160, 90, 0.12);
          border-color: rgba(61, 122, 61, 0.4);
          color: #3D7A3D;
        }
        .cr-btn--not-useful:hover {
          background: rgba(180, 90, 90, 0.12);
          border-color: rgba(154, 64, 64, 0.4);
          color: #9A4040;
        }
        .cr-empty {
          max-width: 640px;
          margin: 60px auto;
          text-align: center;
          color: var(--cp-text-muted);
        }
        .cr-empty-icon {
          margin-bottom: 12px;
          opacity: 0.4;
        }
        .cr-empty-title {
          font-family: var(--cp-font-title);
          font-size: 18px;
          font-weight: 600;
          margin-bottom: 6px;
          color: var(--cp-text);
        }
        .cr-empty-detail {
          font-size: 13px;
        }
        .cr-loading {
          max-width: 640px;
          margin: 60px auto;
          text-align: center;
          color: var(--cp-text-muted);
          font-size: 13px;
        }
        .cr-error {
          max-width: 640px;
          margin: 40px auto;
          text-align: center;
          color: var(--cp-red);
          font-size: 13px;
        }
        .cr-refetch {
          font-size: 12px;
          color: var(--cp-red);
          background: none;
          border: none;
          cursor: pointer;
          text-decoration: underline;
          margin-top: 8px;
        }
      `}</style>

      {/* Header with progress */}
      <div className="cr-header">
        <div className="cr-title">
          Connection Review
          {isTrainingReady && (
            <span className="cr-training-badge">
              <CheckCircle width={12} height={12} /> Training Ready
            </span>
          )}
        </div>
        <div className="cr-subtitle">
          Rate connections to teach the engine which discoveries are useful.
        </div>
        <div className="cr-progress-wrap">
          <div className="cr-progress-bar">
            <div
              className="cr-progress-fill"
              style={{
                width: `${progressPct}%`,
                background: isTrainingReady
                  ? 'rgba(90, 160, 90, 0.7)'
                  : 'var(--cp-accent, #c49a4a)',
              }}
            />
          </div>
          <span className="cr-progress-label">
            {progressTotal}/{progressTarget} for training
          </span>
        </div>
      </div>

      {/* Loading */}
      {loading && <div className="cr-loading">Loading review queue...</div>}

      {/* Error */}
      {error && (
        <div className="cr-error">
          Failed to load review queue.
          <br />
          <button className="cr-refetch" onClick={refetch}>
            Try again
          </button>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && edges.length === 0 && (
        <div className="cr-empty">
          <div className="cr-empty-icon">
            <FlashOff width={40} height={40} />
          </div>
          <div className="cr-empty-title">All caught up</div>
          <div className="cr-empty-detail">
            {progressTotal > 0
              ? `${progressTotal} connections reviewed so far.`
              : 'No auto-discovered connections to review yet.'}
          </div>
          <button className="cr-refetch" onClick={refetch}>
            Check for new connections
          </button>
        </div>
      )}

      {/* Cards */}
      {!loading && !error && edges.length > 0 && (
        <div className="cr-cards">
          {edges.map((edge) => {
            const fromType = getObjectTypeIdentity(edge.from_type);
            const toType = getObjectTypeIdentity(edge.to_type);
            const strengthColor =
              edge.strength >= 0.7
                ? 'rgba(90, 160, 90, 0.8)'
                : edge.strength >= 0.4
                  ? 'var(--cp-accent, #c49a4a)'
                  : 'var(--cp-text-faint, #6a6258)';

            return (
              <div
                key={edge.edge_id}
                className={`cr-card${animatingOut === edge.edge_id ? ' cr-card--exiting' : ''}`}
              >
                {/* Top row: connection pair + strength */}
                <div className="cr-card-top">
                  <div className="cr-connection">
                    <span
                      className="cr-type-dot"
                      style={{ background: fromType.color }}
                      title={fromType.label}
                    />
                    <span
                      className="cr-obj-title"
                      onClick={() => openDrawer(edge.from_slug)}
                      title={edge.from_title}
                    >
                      {edge.from_title}
                    </span>
                    <span className="cr-arrow">&harr;</span>
                    <span
                      className="cr-type-dot"
                      style={{ background: toType.color }}
                      title={toType.label}
                    />
                    <span
                      className="cr-obj-title"
                      onClick={() => openDrawer(edge.to_slug)}
                      title={edge.to_title}
                    >
                      {edge.to_title}
                    </span>
                  </div>
                  <div className="cr-strength-wrap">
                    <div className="cr-strength-bar">
                      <div
                        className="cr-strength-fill"
                        style={{
                          width: `${Math.round(edge.strength * 100)}%`,
                          background: strengthColor,
                        }}
                      />
                    </div>
                    <span className="cr-strength-val">
                      {edge.strength.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Reason */}
                {edge.reason && (
                  <div className="cr-reason">{edge.reason}</div>
                )}

                {/* Bottom: engine label + action buttons */}
                <div className="cr-meta">
                  <span className="cr-engine">{edge.engine}</span>
                  <div className="cr-actions">
                    <button
                      className="cr-btn cr-btn--useful"
                      onClick={() => handleFeedback(edge, 'engaged')}
                    >
                      <CheckCircle width={14} height={14} />
                      Useful
                    </button>
                    <button
                      className="cr-btn cr-btn--not-useful"
                      onClick={() => handleFeedback(edge, 'dismissed')}
                    >
                      <Xmark width={14} height={14} />
                      Not Useful
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
