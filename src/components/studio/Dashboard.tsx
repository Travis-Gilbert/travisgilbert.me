'use client';

import { getMockDashboardStats, getMostRecentItem } from '@/lib/studio-mock-data';
import { getContentTypeIdentity, getStage } from '@/lib/studio';

/**
 * Studio dashboard: landing view at /studio.
 *
 * Shows ContinueCard (last edited piece), pipeline stats,
 * and recent evidence cards. Full implementation in Batch 2.
 *
 * Currently renders a functional summary with mock data
 * so the shell is navigable and demonstrates the data flow.
 */
export default function Dashboard() {
  const stats = getMockDashboardStats();
  const recent = getMostRecentItem();
  const recentType = recent ? getContentTypeIdentity(recent.contentType) : null;
  const recentStage = recent ? getStage(recent.stage) : null;

  return (
    <div style={{ padding: '32px 40px' }}>
      {/* Continue Card */}
      {recent && recentType && recentStage && (
        <div
          className="studio-continue-card"
          style={{
            marginBottom: '32px',
            padding: '24px 28px',
            borderLeft: `3px solid ${recentType.color}`,
          }}
        >
          <div
            style={{
              fontFamily: 'var(--studio-font-mono)',
              fontSize: '9px',
              fontWeight: 600,
              letterSpacing: '0.12em',
              textTransform: 'uppercase' as const,
              color: 'var(--studio-text-3)',
              marginBottom: '8px',
            }}
          >
            Continue where you left off
          </div>
          <div
            style={{
              fontFamily: 'var(--studio-font-title)',
              fontSize: '22px',
              fontWeight: 700,
              color: 'var(--studio-text-bright)',
              marginBottom: '8px',
            }}
          >
            {recent.title}
          </div>
          <div
            style={{
              display: 'flex',
              gap: '16px',
              alignItems: 'center',
              fontFamily: 'var(--studio-font-body)',
              fontSize: '13px',
              color: 'var(--studio-text-2)',
            }}
          >
            <span
              className="studio-stage-badge"
              data-stage={recent.stage}
            >
              {recentStage.label}
            </span>
            <span style={{ fontFamily: 'var(--studio-font-mono)', fontSize: '12px' }}>
              {recent.wordCount.toLocaleString()} words
            </span>
          </div>
        </div>
      )}

      {/* Pipeline Stats */}
      <div className="studio-section-head">
        <span className="studio-section-label">Workbench</span>
        <span className="studio-section-line" />
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: '12px',
          marginTop: '16px',
          marginBottom: '32px',
        }}
      >
        <StatCard label="Total pieces" value={stats.totalPieces} />
        <StatCard label="Total words" value={stats.totalWords} />
        {Object.entries(stats.byStage).map(([stage, count]) => {
          const s = getStage(stage);
          return (
            <StatCard
              key={stage}
              label={s?.label ?? stage}
              value={count}
              color={s?.color}
            />
          );
        })}
      </div>

      {/* Recent Activity */}
      <div className="studio-section-head">
        <span className="studio-section-label">Recent Activity</span>
        <span className="studio-section-line" />
      </div>

      <div style={{ marginTop: '16px' }}>
        {stats.recentActivity.map((entry) => {
          const typeId = getContentTypeIdentity(entry.contentType);
          return (
            <div
              key={entry.id}
              style={{
                display: 'flex',
                gap: '12px',
                alignItems: 'baseline',
                padding: '8px 0',
                borderBottom: '1px solid var(--studio-border)',
                fontFamily: 'var(--studio-font-body)',
                fontSize: '13px',
              }}
            >
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: typeId?.color ?? 'var(--studio-text-3)',
                  flexShrink: 0,
                  marginTop: '6px',
                }}
              />
              <span style={{ color: 'var(--studio-text-2)', flex: 1 }}>
                {entry.detail}
              </span>
              <span
                style={{
                  fontFamily: 'var(--studio-font-mono)',
                  fontSize: '11px',
                  color: 'var(--studio-text-3)',
                  whiteSpace: 'nowrap',
                }}
              >
                {formatRelative(entry.occurredAt)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Stat card ─────────────────────────────────── */

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <div
      style={{
        backgroundColor: 'var(--studio-surface)',
        border: '1px solid var(--studio-border)',
        borderRadius: '6px',
        padding: '14px 16px',
        borderTop: color ? `2px solid ${color}` : undefined,
      }}
    >
      <div
        style={{
          fontFamily: 'var(--studio-font-mono)',
          fontSize: '24px',
          fontWeight: 700,
          color: 'var(--studio-text-bright)',
          lineHeight: 1.1,
        }}
      >
        {value.toLocaleString()}
      </div>
      <div
        style={{
          fontFamily: 'var(--studio-font-body)',
          fontSize: '11px',
          color: 'var(--studio-text-3)',
          marginTop: '4px',
          textTransform: 'uppercase' as const,
          letterSpacing: '0.06em',
        }}
      >
        {label}
      </div>
    </div>
  );
}

/* ── Helpers ───────────────────────────────────── */

function formatRelative(iso: string): string {
  const now = new Date('2026-03-04T14:00:00Z').getTime();
  const then = new Date(iso).getTime();
  const hours = Math.floor((now - then) / 3600000);
  if (hours < 1) return 'just now';
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}
