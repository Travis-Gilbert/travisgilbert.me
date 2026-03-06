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
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '16px',
        background: studioMix(color, 6),
        borderLeft: `2.5px solid ${color}`,
        borderRadius: '6px',
        padding: '16px 20px',
        marginBottom: '20px',
        textDecoration: 'none',
        color: 'inherit',
        transition: 'background 0.15s ease',
      }}
    >
      {/* Left: content info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '6px',
          }}
        >
          <span
            style={{
              fontFamily: 'var(--studio-font-mono)',
              fontSize: '9px',
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

        <div
          style={{
            fontFamily: 'var(--studio-font-title)',
            fontSize: '18px',
            fontWeight: 600,
            color: 'var(--studio-text-bright)',
            marginBottom: '4px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {item.title}
        </div>

        {item.excerpt && (
          <div
            style={{
              fontFamily: 'var(--studio-font-body)',
              fontSize: '13px',
              color: 'var(--studio-text-2)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {item.excerpt}
          </div>
        )}
      </div>

      {/* Right: metadata + CTA */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: '6px',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontFamily: 'var(--studio-font-mono)',
            fontSize: '10px',
            color: 'var(--studio-text-3)',
          }}
        >
          {relativeTime(item.updatedAt)} · {item.wordCount.toLocaleString()}w
        </span>
        <span
          style={{
            fontFamily: 'var(--studio-font-mono)',
            fontSize: '11px',
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
