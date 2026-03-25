'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useVirtualizer } from '@tanstack/react-virtual';
import { fetchContentList, createContentItem } from '@/lib/studio-api';
import {
  getContentTypeIdentity,
  STAGES,
  normalizeStudioContentType,
} from '@/lib/studio';
import type { StudioContentItem } from '@/lib/studio';
import { toast } from 'sonner';
import HeroZone from './HeroZone';
import ContentCardStandard from './ContentCardStandard';
import BoardView from './BoardView';

type ViewMode = 'desk' | 'board';

/**
 * Content list with two view modes: Writing Desk (hero + card grid)
 * and Workbench Board (kanban columns by pipeline stage).
 *
 * View mode persists per content type in localStorage.
 */
export default function ContentList({
  contentType,
}: {
  contentType: string;
}) {
  const normalizedType = normalizeStudioContentType(contentType);
  const typeInfo = getContentTypeIdentity(normalizedType);
  const color = typeInfo?.color ?? 'var(--studio-text-3)';
  const router = useRouter();

  const [items, setItems] = useState<StudioContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [stageFilter, setStageFilter] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'date' | 'title' | 'words'>('date');
  const [viewMode, setViewMode] = useState<ViewMode>('desk');

  /* Restore persisted view mode */
  useEffect(() => {
    try {
      const stored = localStorage.getItem(
        `studio-content-view-${normalizedType}`,
      );
      if (stored === 'desk' || stored === 'board') {
        setViewMode(stored);
      }
    } catch {
      /* localStorage unavailable */
    }
  }, [normalizedType]);

  /* Persist view mode changes */
  const handleViewChange = (mode: ViewMode) => {
    setViewMode(mode);
    try {
      localStorage.setItem(`studio-content-view-${normalizedType}`, mode);
    } catch {
      /* localStorage unavailable */
    }
  };

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

  /* Hero candidate: most recently updated non-published item */
  const heroItem = useMemo(() => {
    const candidates = items
      .filter((i) => i.stage !== 'published')
      .sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      );
    return candidates[0] ?? null;
  }, [items]);

  return (
    <div style={{ padding: '32px 40px' }}>
      {/* Section header with view toggle */}
      <div className="studio-section-head">
        <span className="studio-section-label">
          {typeInfo?.label ?? normalizedType}
        </span>
        <span className="studio-section-line" />
        <div style={{ display: 'flex', gap: '4px', flexShrink: 0, alignItems: 'center' }}>
          <ViewToggleButton
            label="Desk"
            active={viewMode === 'desk'}
            onClick={() => handleViewChange('desk')}
          />
          <ViewToggleButton
            label="Board"
            active={viewMode === 'board'}
            onClick={() => handleViewChange('board')}
          />
          <button
            type="button"
            onClick={async () => {
              try {
                const created = await createContentItem(normalizedType, {});
                router.push(`/studio/${normalizeStudioContentType(created.contentType)}/${created.slug}`);
              } catch {
                toast.error('Could not create');
              }
            }}
            style={{
              fontFamily: 'var(--studio-font-mono)',
              fontSize: '10px',
              fontWeight: 600,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              padding: '3px 10px',
              borderRadius: '3px',
              border: '1px solid var(--studio-border-tc)',
              backgroundColor: 'transparent',
              color: 'var(--studio-tc-bright)',
              cursor: 'pointer',
              marginLeft: '8px',
            }}
          >
            + New
          </button>
        </div>
      </div>

      {/* Filter pills + sort */}
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

      {/* Loading / error states */}
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

      {/* View content */}
      {!loading && viewMode === 'desk' && (
        <>
          {heroItem && <HeroZone item={heroItem} />}
          {filtered.length > 0 ? (
            <VirtualizedCardList items={filtered} color={color} />
          ) : (
            <EmptyState
              typeLabel={typeInfo?.label ?? normalizedType}
              onNew={async () => {
                try {
                  const created = await createContentItem(normalizedType, {});
                  router.push(`/studio/${normalizeStudioContentType(created.contentType)}/${created.slug}`);
                } catch {
                  toast.error('Could not create');
                }
              }}
            />
          )}
        </>
      )}

      {!loading && viewMode === 'board' && (
        <>
          {filtered.length > 0 ? (
            <BoardView items={filtered} color={color} />
          ) : (
            <EmptyState
              typeLabel={typeInfo?.label ?? normalizedType}
              onNew={async () => {
                try {
                  const created = await createContentItem(normalizedType, {});
                  router.push(`/studio/${normalizeStudioContentType(created.contentType)}/${created.slug}`);
                } catch {
                  toast.error('Could not create');
                }
              }}
            />
          )}
        </>
      )}
    </div>
  );
}

/* ── Virtualized card list ────────────────────── */

function VirtualizedCardList({
  items,
  color,
}: {
  items: StudioContentItem[];
  color: string;
}) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 72,
    overscan: 8,
  });

  return (
    <div
      ref={parentRef}
      className="studio-virtual-list-container"
    >
      <div
        style={{
          height: virtualizer.getTotalSize(),
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const item = items[virtualRow.index];
          return (
            <div
              key={item.id}
              data-index={virtualRow.index}
              ref={virtualizer.measureElement}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <ContentCardStandard item={item} color={color} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Internal helpers ─────────────────────────── */

function ViewToggleButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        fontFamily: 'var(--studio-font-mono)',
        fontSize: '10px',
        fontWeight: 600,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        padding: '3px 10px',
        borderRadius: '3px',
        border: '1px solid var(--studio-border)',
        backgroundColor: active ? 'var(--studio-surface)' : 'transparent',
        color: active ? 'var(--studio-text-bright)' : 'var(--studio-text-3)',
        opacity: active ? 1 : 0.6,
        cursor: 'pointer',
        transition: 'opacity 0.15s ease, background-color 0.15s ease',
      }}
    >
      {label}
    </button>
  );
}

function EmptyState({
  typeLabel,
  onNew,
}: {
  typeLabel: string;
  onNew: () => void;
}) {
  return (
    <div style={{
      padding: '48px 24px',
      textAlign: 'center',
      borderRadius: '6px',
      border: '1px dashed var(--studio-border-strong)',
    }}>
      <p style={{
        fontFamily: 'var(--studio-font-body)',
        fontSize: '14px',
        color: 'var(--studio-text-3)',
        marginBottom: '12px',
      }}>
        No {typeLabel.toLowerCase()} yet.
      </p>
      <button type="button" onClick={onNew} style={{
        fontFamily: 'var(--studio-font-mono)',
        fontSize: '10px',
        fontWeight: 600,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        padding: '8px 16px',
        borderRadius: '4px',
        border: '1px solid var(--studio-border-tc)',
        backgroundColor: 'rgba(180, 90, 45, 0.08)',
        color: 'var(--studio-tc-bright)',
        cursor: 'pointer',
      }}>
        Create your first {typeLabel.toLowerCase()}
      </button>
    </div>
  );
}
