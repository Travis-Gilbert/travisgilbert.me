'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getStage, normalizeStudioContentType } from '@/lib/studio';
import type { StudioContentItem } from '@/lib/studio';
import { deleteContentItem } from '@/lib/studio-api';
import { relativeTime } from '@/lib/studio-time';
import { toast } from 'sonner';
import StudioCard from './StudioCard';
import DeleteConfirmModal from './DeleteConfirmModal';

/**
 * Rich card for the Writing Desk grid view.
 *
 * Shows title (2 lines), excerpt (2 lines), stage badge,
 * tags (max 3), word count, and relative time. Built on
 * StudioCard for consistent glow tinting and left border.
 */
export default function ContentCardStandard({
  item,
  color,
}: {
  item: StudioContentItem;
  color: string;
}) {
  const stage = getStage(item.stage);
  const router = useRouter();
  const [deleteTarget, setDeleteTarget] = useState(false);

  return (
    <StudioCard
      typeColor={color}
      href={`/studio/${normalizeStudioContentType(item.contentType)}/${item.slug}`}
    >
      {/* Top row: stage + relative time */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '8px',
        }}
      >
        <span className="studio-stage-badge" data-stage={item.stage}>
          {stage.label}
        </span>
        <span
          style={{
            fontFamily: 'var(--studio-font-mono)',
            fontSize: '10px',
            color: 'var(--studio-text-3)',
          }}
        >
          {relativeTime(item.updatedAt)}
        </span>
      </div>

      {/* Title: 2 lines max */}
      <div
        style={{
          fontFamily: 'var(--studio-font-title)',
          fontSize: '16px',
          fontWeight: 600,
          color: 'var(--studio-text-bright)',
          lineHeight: 1.3,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical' as const,
          overflow: 'hidden',
          marginBottom: '6px',
        }}
      >
        {item.title}
      </div>

      {/* Excerpt: 2 lines max */}
      {item.excerpt && (
        <div
          style={{
            fontFamily: 'var(--studio-font-body)',
            fontSize: '13px',
            color: 'var(--studio-text-2)',
            lineHeight: 1.5,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical' as const,
            overflow: 'hidden',
            marginBottom: '10px',
          }}
        >
          {item.excerpt}
        </div>
      )}

      {/* Bottom row: tags + word count */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '8px',
          marginTop: 'auto',
        }}
      >
        <div style={{ display: 'flex', gap: '4px', minWidth: 0, overflow: 'hidden' }}>
          {item.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              style={{
                fontFamily: 'var(--studio-font-mono)',
                fontSize: '10px',
                color: 'var(--studio-text-3)',
                backgroundColor: 'var(--studio-surface)',
                padding: '1px 6px',
                borderRadius: '3px',
                whiteSpace: 'nowrap',
              }}
            >
              {tag}
            </span>
          ))}
        </div>
        <span
          style={{
            fontFamily: 'var(--studio-font-mono)',
            fontSize: '11px',
            color: 'var(--studio-text-3)',
            flexShrink: 0,
          }}
        >
          {item.wordCount.toLocaleString()}w
        </span>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDeleteTarget(true);
          }}
          className="studio-card-delete-btn"
          aria-label={`Delete ${item.title}`}
          title="Delete"
        >
          &times;
        </button>
      </div>

      {deleteTarget && (
        <DeleteConfirmModal
          title={item.title}
          onConfirm={async () => {
            try {
              await deleteContentItem(
                normalizeStudioContentType(item.contentType),
                item.slug,
              );
              setDeleteTarget(false);
              router.refresh();
            } catch {
              toast.error('Could not delete');
              setDeleteTarget(false);
            }
          }}
          onCancel={() => setDeleteTarget(false)}
        />
      )}
    </StudioCard>
  );
}
