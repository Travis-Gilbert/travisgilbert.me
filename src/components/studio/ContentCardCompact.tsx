'use client';

import { normalizeStudioContentType } from '@/lib/studio';
import type { StudioContentItem } from '@/lib/studio';
import { relativeTime } from '@/lib/studio-time';
import StudioCard from './StudioCard';

/**
 * Compact card for the Board (kanban) view.
 *
 * Stage context comes from the column header, so
 * the card only shows title, excerpt, time, and word count.
 */
export default function ContentCardCompact({
  item,
  color,
}: {
  item: StudioContentItem;
  color: string;
}) {
  return (
    <StudioCard
      typeColor={color}
      href={`/studio/${normalizeStudioContentType(item.contentType)}/${item.slug}`}
      style={{ padding: '10px 12px' }}
    >
      {/* Title: single line */}
      <div
        style={{
          fontFamily: 'var(--studio-font-title)',
          fontSize: '14px',
          fontWeight: 600,
          color: 'var(--studio-text-bright)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          marginBottom: '3px',
        }}
      >
        {item.title}
      </div>

      {/* Excerpt: single line */}
      {item.excerpt && (
        <div
          style={{
            fontFamily: 'var(--studio-font-body)',
            fontSize: '12px',
            color: 'var(--studio-text-2)',
            lineHeight: 1.4,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            marginBottom: '6px',
          }}
        >
          {item.excerpt}
        </div>
      )}

      {/* Bottom: time + word count */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--studio-font-mono)',
            fontSize: '10px',
            color: 'var(--studio-text-3)',
          }}
        >
          {relativeTime(item.updatedAt)}
        </span>
        <span
          style={{
            fontFamily: 'var(--studio-font-mono)',
            fontSize: '10px',
            color: 'var(--studio-text-3)',
          }}
        >
          {item.wordCount.toLocaleString()}w
        </span>
      </div>
    </StudioCard>
  );
}
