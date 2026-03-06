'use client';

import Link from 'next/link';
import StudioCard from './StudioCard';
import {
  getStage,
  getContentTypeIdentity,
  normalizeStudioContentType,
} from '@/lib/studio';
import type { StudioContentItem } from '@/lib/studio';
import { relativeTime } from '@/lib/studio-time';

/**
 * Full-width hero card showing the most recently edited active item.
 *
 * Mirrors the ActiveProjectCard layout from the dashboard:
 * title + stage badge, metric chips, next move (read-only),
 * and a "Continue writing" CTA button.
 */
export default function HeroZone({ item }: { item: StudioContentItem }) {
  const typeInfo = getContentTypeIdentity(item.contentType);
  const stage = getStage(item.stage);
  const color = typeInfo.color;
  const href = `/studio/${normalizeStudioContentType(item.contentType)}/${item.slug}`;
  const lastTouched = relativeTime(item.updatedAt);

  return (
    <StudioCard typeColor={color} style={{ padding: '20px 22px', marginBottom: '24px' }}>
      {/* Row 1: Title + stage badge */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: '12px',
          marginBottom: '10px',
        }}
      >
        <h2
          style={{
            margin: 0,
            fontFamily: 'var(--studio-font-title)',
            fontSize: '26px',
            lineHeight: 1.2,
            color: 'var(--studio-text-bright)',
            fontWeight: 700,
          }}
        >
          {item.title}
        </h2>
        <span className="studio-stage-badge" data-stage={item.stage}>
          {stage.label}
        </span>
      </div>

      {/* Row 2: Metric chips */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          flexWrap: 'wrap',
          marginBottom: '12px',
        }}
      >
        <MetricChip label="Words" value={item.wordCount.toLocaleString()} />
        <MetricChip label="Last touched" value={lastTouched} />
        {item.tags.length > 0 && (
          <MetricChip label="Tags" value={String(item.tags.length)} />
        )}
      </div>

      {/* Row 3: Next move (read-only) */}
      {item.nextMove && (
        <div style={{ marginBottom: '14px' }}>
          <div
            style={{
              fontFamily: 'var(--studio-font-mono)',
              fontSize: '9px',
              fontWeight: 700,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: color,
              marginBottom: '6px',
            }}
          >
            Next move
          </div>
          <div
            style={{
              fontFamily: 'var(--studio-font-body)',
              fontSize: '14px',
              lineHeight: 1.45,
              color: 'var(--studio-text-1)',
              background:
                'linear-gradient(165deg, rgba(255,255,255,0.055) 0%, rgba(255,255,255,0.012) 100%)',
              border: '1px solid rgba(237,231,220,0.14)',
              borderRadius: '9px',
              padding: '10px 12px',
            }}
          >
            {item.nextMove}
          </div>
        </div>
      )}

      {/* Row 3b: Excerpt fallback when no nextMove */}
      {!item.nextMove && item.excerpt && (
        <div
          style={{
            fontFamily: 'var(--studio-font-body)',
            fontSize: '14px',
            lineHeight: 1.55,
            color: 'var(--studio-text-2)',
            marginBottom: '14px',
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical' as const,
            overflow: 'hidden',
          }}
        >
          {item.excerpt}
        </div>
      )}

      {/* Row 4: Action button */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <Link
          href={href}
          className="studio-dashboard-action studio-dashboard-action--primary"
        >
          Continue writing
        </Link>
      </div>
    </StudioCard>
  );
}

/* ── Local helper ────────────────────────────── */

function MetricChip({ label, value }: { label: string; value: string }) {
  return (
    <span
      style={{
        fontFamily: 'var(--studio-font-mono)',
        fontSize: '9px',
        fontWeight: 600,
        letterSpacing: '0.06em',
        color: 'var(--studio-text-2)',
        textTransform: 'uppercase',
        padding: '5px 8px',
        borderRadius: '5px',
        border: '1px solid var(--studio-border)',
        backgroundColor: 'var(--studio-surface)',
      }}
    >
      {label}: <span style={{ color: 'var(--studio-text-bright)' }}>{value}</span>
    </span>
  );
}
