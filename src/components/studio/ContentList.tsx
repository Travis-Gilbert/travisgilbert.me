'use client';

import { useState, useMemo, useEffect } from 'react';
import { fetchContentList } from '@/lib/studio-api';
import {
  getContentTypeIdentity,
  getStage,
  STAGES,
  normalizeStudioContentType,
} from '@/lib/studio';
import type { StudioContentItem } from '@/lib/studio';
import StudioCard from './StudioCard';

/**
 * Reusable content list for type-specific pages.
 */
export default function ContentList({
  contentType,
}: {
  contentType: string;
}) {
  const normalizedType = normalizeStudioContentType(contentType);
  const typeInfo = getContentTypeIdentity(normalizedType);

  const [items, setItems] = useState<StudioContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [stageFilter, setStageFilter] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'date' | 'title' | 'words'>('date');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);

    fetchContentList({ content_type: normalizedType })
      .then((data) => {
        if (cancelled) return;
        setItems(data);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setItems([]);
        setLoadError('Could not load content from Studio API.');
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [normalizedType]);

  const filtered = useMemo(() => {
    let result = stageFilter
      ? items.filter((i) => i.stage === stageFilter)
      : items;

    if (sortBy === 'title') {
      result = [...result].sort((a, b) => a.title.localeCompare(b.title));
    } else if (sortBy === 'words') {
      result = [...result].sort((a, b) => b.wordCount - a.wordCount);
    } else {
      result = [...result].sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      );
    }

    return result;
  }, [items, stageFilter, sortBy]);

  return (
    <div style={{ padding: '32px 40px' }}>
      <div className="studio-section-head">
        <span className="studio-section-label">
          {typeInfo?.label ?? normalizedType}
        </span>
        <span className="studio-section-line" />
      </div>

      <div
        style={{
          display: 'flex',
          gap: '8px',
          flexWrap: 'wrap',
          alignItems: 'center',
          marginTop: '16px',
          marginBottom: '20px',
        }}
      >
        <button
          type="button"
          onClick={() => setStageFilter(null)}
          className="studio-stage-badge"
          style={{
            cursor: 'pointer',
            opacity: stageFilter === null ? 1 : 0.5,
          }}
        >
          All ({items.length})
        </button>
        {STAGES.map((s) => {
          const count = items.filter((i) => i.stage === s.slug).length;
          if (count === 0) return null;
          return (
            <button
              key={s.slug}
              type="button"
              onClick={() =>
                setStageFilter(stageFilter === s.slug ? null : s.slug)
              }
              className="studio-stage-badge"
              data-stage={s.slug}
              style={{
                cursor: 'pointer',
                opacity: stageFilter === s.slug ? 1 : 0.5,
              }}
            >
              {s.label} ({count})
            </button>
          );
        })}

        <div style={{ marginLeft: 'auto' }}>
          <select
            value={sortBy}
            onChange={(e) =>
              setSortBy(e.target.value as 'date' | 'title' | 'words')
            }
            style={{
              backgroundColor: 'var(--studio-surface)',
              border: '1px solid var(--studio-border)',
              borderRadius: '4px',
              color: 'var(--studio-text-2)',
              fontFamily: 'var(--studio-font-body)',
              fontSize: '12px',
              padding: '4px 8px',
            }}
          >
            <option value="date">Newest</option>
            <option value="title">A to Z</option>
            <option value="words">Word count</option>
          </select>
        </div>
      </div>

      {loading && (
        <p
          style={{
            fontFamily: 'var(--studio-font-body)',
            fontSize: '14px',
            color: 'var(--studio-text-3)',
            padding: '6px 0 16px',
          }}
        >
          Loading...
        </p>
      )}

      {loadError && (
        <p
          style={{
            fontFamily: 'var(--studio-font-body)',
            fontSize: '13px',
            color: '#A44A3A',
            marginTop: 0,
            marginBottom: '16px',
          }}
        >
          {loadError}
        </p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {filtered.map((item) => (
          <ContentCard
            key={item.id}
            item={item}
            color={typeInfo?.color ?? 'var(--studio-text-3)'}
          />
        ))}
        {!loading && filtered.length === 0 && (
          <p
            style={{
              fontFamily: 'var(--studio-font-body)',
              fontSize: '14px',
              color: 'var(--studio-text-3)',
              padding: '24px 0',
            }}
          >
            No items match the current filter.
          </p>
        )}
      </div>
    </div>
  );
}

function ContentCard({
  item,
  color,
}: {
  item: StudioContentItem;
  color: string;
}) {
  const stage = getStage(item.stage);

  return (
    <StudioCard
      typeColor={color}
      href={`/studio/${normalizeStudioContentType(item.contentType)}/${item.slug}`}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: '12px',
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontFamily: 'var(--studio-font-title)',
              fontSize: '16px',
              fontWeight: 600,
              color: 'var(--studio-text-bright)',
              marginBottom: '4px',
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
                lineHeight: 1.5,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {item.excerpt}
            </div>
          )}
        </div>
        <div
          style={{
            display: 'flex',
            gap: '10px',
            alignItems: 'center',
            flexShrink: 0,
          }}
        >
          {stage && (
            <span className="studio-stage-badge" data-stage={item.stage}>
              {stage.label}
            </span>
          )}
          <span
            style={{
              fontFamily: 'var(--studio-font-mono)',
              fontSize: '12px',
              color: 'var(--studio-text-3)',
            }}
          >
            {item.wordCount.toLocaleString()}w
          </span>
        </div>
      </div>
    </StudioCard>
  );
}
