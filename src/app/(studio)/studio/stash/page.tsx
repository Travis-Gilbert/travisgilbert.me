'use client';

/**
 * /studio/stash: Global stash listing page.
 *
 * Aggregates stash items across all content items, grouped by
 * content piece. Each item links to its editor with the stash
 * tab active.
 */

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  fetchAllStash,
  deleteStashItem,
  type AggregatedStashItem,
} from '@/lib/studio-api';
import { getContentTypeIdentity, studioMix } from '@/lib/studio';

/* ── Date formatting ────────────────────────── */

const SHORT_DATE = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

/* ── Component ───────────────────────────────── */

export default function StashPage() {
  const [items, setItems] = useState<AggregatedStashItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const data = await fetchAllStash();
      if (!cancelled) {
        setItems(data);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  /* Group by content piece */
  const grouped = useMemo(() => {
    const map = new Map<string, {
      contentType: string;
      contentSlug: string;
      contentTitle: string;
      items: AggregatedStashItem[];
    }>();

    for (const item of items) {
      const key = `${item.contentType}:${item.contentSlug}`;
      if (!map.has(key)) {
        map.set(key, {
          contentType: item.contentType,
          contentSlug: item.contentSlug,
          contentTitle: item.contentTitle,
          items: [],
        });
      }
      map.get(key)!.items.push(item);
    }

    return Array.from(map.values());
  }, [items]);

  const handleDelete = async (item: AggregatedStashItem) => {
    const ok = await deleteStashItem(
      item.contentType,
      item.contentSlug,
      item.id,
    );
    if (ok) {
      setItems((prev) => prev.filter((s) => s.id !== item.id));
    }
  };

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '32px 16px' }}>
      <h1
        style={{
          fontFamily: 'var(--studio-font-title)',
          fontSize: '28px',
          fontWeight: 700,
          color: 'var(--studio-text-bright)',
          marginBottom: '4px',
        }}
      >
        Stash
      </h1>
      <p
        style={{
          fontFamily: 'var(--studio-font-mono)',
          fontSize: '11px',
          color: 'var(--studio-text-3)',
          letterSpacing: '0.04em',
          marginBottom: '24px',
        }}
      >
        Snippets and scratch notes saved alongside your content.
      </p>

      {loading && (
        <p
          style={{
            fontFamily: 'var(--studio-font-serif)',
            fontSize: '13px',
            color: 'var(--studio-text-3)',
            fontStyle: 'italic',
          }}
        >
          Loading stash items...
        </p>
      )}

      {!loading && items.length === 0 && (
        <p
          style={{
            fontFamily: 'var(--studio-font-serif)',
            fontSize: '13px',
            color: 'var(--studio-text-3)',
            fontStyle: 'italic',
            textAlign: 'center',
            padding: '48px 0',
          }}
        >
          No stash items yet. Open any piece in the editor and use the Stash tab
          to save snippets.
        </p>
      )}

      {!loading && grouped.map((group) => {
        const typeId = getContentTypeIdentity(group.contentType);
        const editorHref = `/studio/${typeId.route}/${group.contentSlug}`;

        return (
          <div key={`${group.contentType}:${group.contentSlug}`} style={{ marginBottom: '24px' }}>
            {/* Group header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: '8px',
                marginBottom: '8px',
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--studio-font-mono)',
                  fontSize: '9px',
                  fontWeight: 600,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase' as const,
                  color: typeId.color,
                }}
              >
                {typeId.label}
              </span>
              <Link
                href={editorHref}
                style={{
                  fontFamily: 'var(--studio-font-serif)',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: 'var(--studio-text-bright)',
                  textDecoration: 'none',
                }}
              >
                {group.contentTitle}
              </Link>
              <span
                style={{
                  fontFamily: 'var(--studio-font-mono)',
                  fontSize: '10px',
                  color: 'var(--studio-text-3)',
                }}
              >
                {group.items.length}
              </span>
            </div>

            {/* Stash items */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {group.items.map((stash) => (
                <div
                  key={stash.id}
                  style={{
                    padding: '8px 10px',
                    backgroundColor: studioMix(typeId.color, 4),
                    borderRadius: '4px',
                    borderLeft: `2px solid ${studioMix(typeId.color, 30)}`,
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '8px',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontFamily: 'var(--studio-font-serif)',
                        fontSize: '12px',
                        color: 'var(--studio-text-1)',
                        lineHeight: 1.5,
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                      }}
                    >
                      {stash.text}
                    </div>
                    <div
                      style={{
                        fontFamily: 'var(--studio-font-mono)',
                        fontSize: '9px',
                        color: 'var(--studio-text-3)',
                        marginTop: '4px',
                      }}
                    >
                      {SHORT_DATE.format(new Date(stash.created_at))}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDelete(stash)}
                    style={{
                      flexShrink: 0,
                      background: 'none',
                      border: 'none',
                      color: 'var(--studio-text-3)',
                      fontFamily: 'var(--studio-font-mono)',
                      fontSize: '10px',
                      cursor: 'pointer',
                      padding: '2px 4px',
                      opacity: 0.6,
                    }}
                    aria-label="Delete stash item"
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {/* Total count */}
      {!loading && items.length > 0 && (
        <div
          style={{
            fontFamily: 'var(--studio-font-mono)',
            fontSize: '10px',
            color: 'var(--studio-text-3)',
            textAlign: 'center',
            paddingTop: '12px',
            borderTop: '1px solid var(--studio-border)',
          }}
        >
          {items.length} item{items.length !== 1 ? 's' : ''} across{' '}
          {grouped.length} piece{grouped.length !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}
