'use client';

/**
 * EngineShell: shared wrapper for all Engine sub-views.
 *
 * Provides page header (title + subtitle), training progress pill,
 * and back button to the Engine dashboard. Consistent padding and max-width.
 */

import { useRef, useEffect } from 'react';
import { ArrowLeft } from 'iconoir-react';
import type { FeedbackStats } from '@/lib/commonplace-api';

interface EngineShellProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  feedbackStats?: FeedbackStats | null;
  onBack?: () => void;
}

const PURPLE = '#8B6FA0';
const PURPLE_BG = 'rgba(139,111,160,0.08)';

export default function EngineShell({
  title,
  subtitle,
  children,
  feedbackStats,
  onBack,
}: EngineShellProps) {
  return (
    <div className="engine-shell">
      <style>{`
        .engine-shell {
          display: flex;
          flex-direction: column;
          height: 100%;
          overflow-y: auto;
          padding: 48px 40px 28px;
          max-width: 820px;
          margin: 0;
          width: 100%;
          font-family: var(--cp-font-body);

          /* Parchment-context token overrides */
          --cp-text: #2A2520;
          --cp-text-muted: #5C554D;
          --cp-text-faint: #8A8279;
          --cp-text-ghost: #AEA89F;
          --cp-color-text: var(--cp-text);
          --cp-color-text-muted: var(--cp-text-muted);
          --cp-border: rgba(42, 37, 32, 0.12);
          --cp-border-faint: rgba(42, 37, 32, 0.07);
          --cp-surface: rgba(237, 228, 214, 0.65);
          color: var(--cp-text);
        }
        .es-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 24px;
        }
        .es-header-left {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          min-width: 0;
        }
        .es-back {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          border-radius: 6px;
          border: 1px solid var(--cp-border, rgba(42,37,32,0.12));
          background: transparent;
          cursor: pointer;
          flex-shrink: 0;
          margin-top: 2px;
          transition: background 120ms ease, border-color 120ms ease;
        }
        .es-back:hover {
          background: ${PURPLE_BG};
          border-color: rgba(139,111,160,0.25);
        }
        .es-title {
          font-family: var(--cp-font-title, var(--font-title));
          font-size: 20px;
          font-weight: 600;
          color: var(--cp-text, #2A2520);
          margin: 0;
          line-height: 1.3;
        }
        .es-subtitle {
          font-size: 13px;
          color: var(--cp-text-muted, #5C554D);
          margin-top: 2px;
        }
        .es-content {
          flex: 1;
        }
      `}</style>

      <div className="es-header">
        <div className="es-header-left">
          {onBack && (
            <button className="es-back" onClick={onBack} title="Back to Engine">
              <ArrowLeft width={14} height={14} color="var(--cp-text-muted, #5C554D)" />
            </button>
          )}
          <div>
            <h2 className="es-title">{title}</h2>
            {subtitle && <div className="es-subtitle">{subtitle}</div>}
          </div>
        </div>

        {feedbackStats && (
          <TrainingPill stats={feedbackStats} />
        )}
      </div>

      <div className="es-content">
        {children}
      </div>
    </div>
  );
}

/* ── Training Progress Pill ── */

function TrainingPill({ stats }: { stats: FeedbackStats }) {
  const barRef = useRef<HTMLDivElement>(null);
  const target = 200;
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
    <div className="es-pill">
      <style>{`
        .es-pill {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 12px;
          border-radius: 8px;
          background: ${PURPLE_BG};
          border: 1px solid rgba(139,111,160,0.15);
          flex-shrink: 0;
        }
        .es-pill-bar-wrap {
          width: 64px;
          height: 4px;
          border-radius: 2px;
          background: rgba(139,111,160,0.15);
          overflow: hidden;
        }
        .es-pill-bar-fill {
          height: 100%;
          border-radius: 2px;
          background: ${PURPLE};
        }
        .es-pill-count {
          font-family: var(--cp-font-mono);
          font-size: 11px;
          color: ${PURPLE};
          font-weight: 600;
          font-variant-numeric: tabular-nums;
        }
        .es-pill-tier {
          font-family: var(--cp-font-mono);
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.06em;
          padding: 1px 6px;
          border-radius: 4px;
          background: rgba(139,111,160,0.10);
          color: ${PURPLE};
        }
      `}</style>
      <div className="es-pill-bar-wrap">
        <div className="es-pill-bar-fill" ref={barRef} />
      </div>
      <span className="es-pill-count">{stats.total}</span>
      <span className="es-pill-tier">{tierLabel}</span>
    </div>
  );
}
