'use client';

import Link from 'next/link';
import {
  getStage,
  getContentTypeIdentity,
  normalizeStudioContentType,
  studioMix,
} from '@/lib/studio';
import type { StudioContentItem } from '@/lib/studio';
import { relativeTime } from '@/lib/studio-time';

/**
 * Full-width hero strip showing the most recently edited active item.
 *
 * Appears at the top of the Writing Desk view. Styled with the
 * content type color and a "Continue" link to the editor.
 */
export default function HeroZone({ item }: { item: StudioContentItem }) {
  const typeInfo = getContentTypeIdentity(item.contentType);
  const stage = getStage(item.stage);
  const color = typeInfo.color;
  const href = `/studio/${normalizeStudioContentType(item.contentType)}/${item.slug}`;

  return (
    <Link
      href={href}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        background: studioMix(color, 6),
        borderLeft: `2.5px solid ${color}`,
        borderRadius: '6px',
        padding: '32px 28px',
        marginBottom: '24px',
        textDecoration: 'none',
        color: 'inherit',
        transition: 'background 0.15s ease',
      }}
    >
      {/* Top row: label + stage + metadata */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span
            style={{
              fontFamily: 'var(--studio-font-mono)',
              fontSize: '10px',
              fontWeight: 700,
              letterSpacing: '0.12em',
              textTransform: 'uppercase' as const,
              color: color,
            }}
          >
            CONTINUE WRITING
          </span>
          <span className="studio-stage-badge" data-stage={item.stage}>
            {stage.label}
          </span>
        </div>

        <span
          style={{
            fontFamily: 'var(--studio-font-mono)',
            fontSize: '10px',
            color: 'var(--studio-text-3)',
          }}
        >
          {relativeTime(item.updatedAt)} · {item.wordCount.toLocaleString()}w
        </span>
      </div>

      {/* Title */}
      <div
        style={{
          fontFamily: 'var(--studio-font-title)',
          fontSize: '24px',
          fontWeight: 600,
          lineHeight: 1.3,
          color: 'var(--studio-text-bright)',
        }}
      >
        {item.title}
      </div>

      {/* Excerpt: multi-line with clamp */}
      {item.excerpt && (
        <div
          style={{
            fontFamily: 'var(--studio-font-body)',
            fontSize: '14px',
            lineHeight: 1.6,
            color: 'var(--studio-text-2)',
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical' as const,
            overflow: 'hidden',
          }}
        >
          {item.excerpt}
        </div>
      )}

      {/* Bottom: CTA */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <span
          style={{
            fontFamily: 'var(--studio-font-mono)',
            fontSize: '12px',
            fontWeight: 600,
            color: color,
            letterSpacing: '0.05em',
          }}
        >
          Continue →
        </span>
      </div>
    </Link>
  );
}
