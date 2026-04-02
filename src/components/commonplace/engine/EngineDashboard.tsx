'use client';

/**
 * EngineDashboard: Hero + List control room for the Engine section.
 *
 * Hero slot: training progress card with animated GSAP bar.
 * List slot: four queue rows in a bordered container.
 * Each row navigates to its sub-view via launchView.
 */

import { useMemo, useRef, useEffect } from 'react';
import { ArrowRight } from 'iconoir-react';
import { fetchFeedbackStats, fetchReviewQueue, useApiData } from '@/lib/commonplace-api';
import type { FeedbackStats } from '@/lib/commonplace-api';
import { useLayout } from '@/lib/providers/layout-provider';
import type { ViewType } from '@/lib/commonplace';
import { findPane } from '@/lib/commonplace-layout';
import type { PaneNode } from '@/lib/commonplace-layout';

const PURPLE = '#6B4F80';

interface QueueRow {
  label: string;
  description: string;
  accentColor: string;
  badge: 'WORKSHOP' | 'TRIAGE';
  viewType: ViewType;
}

const QUEUE_ROWS: QueueRow[] = [
  {
    label: 'Connection Review',
    description: 'Rate engine-discovered connections one at a time',
    accentColor: PURPLE,
    badge: 'WORKSHOP',
    viewType: 'connection-review',
  },
  {
    label: 'Review Queue',
    description: 'Fast-scan proposed promotions, accept or reject in batch',
    accentColor: '#B45A2D',
    badge: 'TRIAGE',
    viewType: 'promotion-queue',
  },
  {
    label: 'Entity Promotions',
    description: 'Promote recognized entities into full objects',
    accentColor: '#2D5F6B',
    badge: 'TRIAGE',
    viewType: 'entity-promotions',
  },
  {
    label: 'Emergent Types',
    description: 'Review and customize auto-detected object types',
    accentColor: '#C49A4A',
    badge: 'WORKSHOP',
    viewType: 'emergent-types',
  },
];

export default function EngineDashboard() {
  const { launchView, layout, focusedPaneId } = useLayout();
  const activeNotebookSlug = useMemo(
    () => resolveActiveNotebookSlug(layout, focusedPaneId),
    [layout, focusedPaneId],
  );
  const { data: stats } = useApiData(
    () => fetchFeedbackStats(activeNotebookSlug ? { notebook: activeNotebookSlug } : undefined),
    [activeNotebookSlug],
  );
  const { data: queueSnapshot } = useApiData(
    () => fetchReviewQueue({ limit: 1, notebook: activeNotebookSlug }),
    [activeNotebookSlug],
  );

  return (
    <div className="ed-root">
      <style>{`
        .ed-root {
          display: flex;
          flex-direction: column;
          height: 100%;
          overflow-y: auto;
          padding: 28px 32px;
          max-width: 820px;
          margin: 0 auto;
          width: 100%;
          font-family: var(--cp-font-body);
        }
        .ed-hero {
          border-radius: 10px;
          background: rgba(139,111,160,0.06);
          border: 1px solid rgba(139,111,160,0.12);
          padding: 24px 28px;
          margin-bottom: 20px;
          /* Parchment-context: hero sits on the warm page background */
          color: #2A2520;
        }
        .ed-hero-headline {
          font-family: var(--cp-font-title, var(--font-title));
          font-size: 22px;
          font-weight: 600;
          color: #2A2520;
          margin: 0 0 6px;
        }
        .ed-hero-sub {
          font-size: 13px;
          color: #5C554D;
          margin-bottom: 16px;
        }
        .ed-progress-wrap {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .ed-progress-bar {
          flex: 1;
          height: 6px;
          border-radius: 3px;
          background: rgba(139,111,160,0.12);
          overflow: hidden;
        }
        .ed-progress-fill {
          height: 100%;
          border-radius: 3px;
          background: ${PURPLE};
        }
        .ed-progress-label {
          font-family: var(--cp-font-mono);
          font-size: 12px;
          color: ${PURPLE};
          font-weight: 600;
          font-variant-numeric: tabular-nums;
          white-space: nowrap;
        }
        .ed-tier-badge {
          font-family: var(--cp-font-mono);
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.06em;
          padding: 2px 8px;
          border-radius: 4px;
          background: rgba(139,111,160,0.10);
          color: ${PURPLE};
        }
        .ed-hero-badges {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 14px;
        }
        .ed-list {
          border-radius: 10px;
          background: var(--cp-card, #242118);
          border: 1px solid rgba(42,36,32,0.10);
          overflow: hidden;
        }
        .ed-row {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px 18px;
          background: transparent;
          border: none;
          border-bottom: 1px solid rgba(42,36,32,0.06);
          cursor: pointer;
          width: 100%;
          text-align: left;
          transition: background 120ms ease;
        }
        .ed-row:last-child {
          border-bottom: none;
        }
        .ed-row-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .ed-row-content {
          flex: 1;
          min-width: 0;
        }
        .ed-row-label {
          font-size: 14px;
          font-weight: 500;
          color: #2A2520;
        }
        .ed-row-desc {
          font-size: 12px;
          color: #6A5E52;
          margin-top: 1px;
        }
        .ed-row-badge {
          font-family: var(--cp-font-mono);
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.06em;
          padding: 2px 8px;
          border-radius: 4px;
          flex-shrink: 0;
        }
        .ed-row-badge--workshop {
          background: rgba(139,111,160,0.18);
          color: #6B4F80;
        }
        .ed-row-badge--triage {
          background: rgba(180,90,45,0.15);
          color: #B45A2D;
        }
        .ed-row-arrow {
          flex-shrink: 0;
          color: #8A8279;
        }
      `}</style>

      {/* Hero: training progress */}
      <div className="ed-hero">
        <h2 className="ed-hero-headline">
          {stats ? `${stats.total} feedback records` : 'Engine Intelligence'}
        </h2>
        <div className="ed-hero-sub">
          {stats
            ? stats.training_ready
              ? 'Adaptive scoring is active. Keep rating to improve accuracy.'
              : `${stats.needed_for_training} more ratings needed to unlock learned scoring.`
            : 'Loading training stats...'}
          {activeNotebookSlug ? ` Scoped to ${activeNotebookSlug}.` : ''}
        </div>
        <div className="ed-hero-badges">
          {activeNotebookSlug && (
            <span className="ed-tier-badge">
              Notebook {activeNotebookSlug}
            </span>
          )}
          <span className="ed-tier-badge">
            Strategy {(queueSnapshot?.strategy ?? 'auto').toUpperCase()}
          </span>
          <span className="ed-tier-badge">
            Mode {(stats?.scorer_mode ?? 'fixed').toUpperCase()}
          </span>
        </div>
        {stats && <TrainingProgressBar stats={stats} />}
      </div>

      {/* List: four queue rows */}
      <div className="ed-list">
        {QUEUE_ROWS.map((row) => (
          <button
            key={row.viewType}
            className="ed-row"
            onClick={() => launchView(
              row.viewType,
              row.viewType === 'connection-review' && activeNotebookSlug
                ? { slug: activeNotebookSlug }
                : undefined,
            )}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = `${row.accentColor}18`;
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'transparent';
            }}
          >
            <span className="ed-row-dot" style={{ background: row.accentColor }} />
            <div className="ed-row-content">
              <div className="ed-row-label">{row.label}</div>
              <div className="ed-row-desc">{row.description}</div>
            </div>
            <span
              className={`ed-row-badge ${row.badge === 'WORKSHOP' ? 'ed-row-badge--workshop' : 'ed-row-badge--triage'}`}
            >
              {row.badge}
            </span>
            <ArrowRight width={14} height={14} className="ed-row-arrow" />
          </button>
        ))}
      </div>
    </div>
  );
}

function resolveActiveNotebookSlug(layout: PaneNode, focusedPaneId: string | null): string | undefined {
  if (focusedPaneId) {
    const focusedPane = findPane(layout, focusedPaneId);
    if (
      focusedPane?.type === 'leaf'
      && focusedPane.viewId === 'notebook'
      && typeof focusedPane.context?.slug === 'string'
    ) {
      return focusedPane.context.slug;
    }
  }

  return findNotebookSlug(layout);
}

function findNotebookSlug(node: PaneNode): string | undefined {
  if (node.type === 'leaf') {
    if (node.viewId === 'notebook' && typeof node.context?.slug === 'string') {
      return node.context.slug;
    }
    return undefined;
  }

  return findNotebookSlug(node.first) ?? findNotebookSlug(node.second);
}

/* ── Training progress bar with GSAP animation ── */

function TrainingProgressBar({ stats }: { stats: FeedbackStats }) {
  const barRef = useRef<HTMLDivElement>(null);
  const target = stats.training_tier === 'full' ? 200 : 50;
  const pct = Math.min(100, (stats.total / target) * 100);
  const tierLabel = stats.training_tier === 'full'
    ? 'LEARNED'
    : stats.training_tier === 'blended'
      ? 'BLENDED'
      : 'FIXED';

  useEffect(() => {
    const bar = barRef.current;
    if (!bar) return;
    bar.style.width = '0%';
    import('gsap').then(({ gsap }) => {
      gsap.to(bar, {
        width: `${pct}%`,
        duration: 1.2,
        ease: 'power2.out',
      });
    });
  }, [pct]);

  return (
    <div className="ed-progress-wrap">
      <div className="ed-progress-bar">
        <div className="ed-progress-fill" ref={barRef} />
      </div>
      <span className="ed-progress-label">
        {stats.total}/{target}
      </span>
      <span className="ed-tier-badge">{tierLabel}</span>
    </div>
  );
}
