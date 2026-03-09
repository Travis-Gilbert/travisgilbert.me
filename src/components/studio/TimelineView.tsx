'use client';

/**
 * TimelineView: editorial sparse list for the Studio timeline.
 *
 * Receives pre-computed TimelineItem[] from the Server Component page.
 * Groups by month, renders a dot-and-spine layout, no expand/collapse.
 * Connection pills sourced from the JS connection engine (resolved in page.tsx).
 *
 * CSS: studio.css (.studio-timeline-view, .studio-timeline-*)
 */

import { useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { Connection } from '@/lib/connectionEngine';
import { getContentTypeIdentity, CONTENT_TYPES } from '@/lib/studio';

/* ── Exported type (consumed by page.tsx) ───── */

export interface TimelineItem {
  id: string;
  slug: string;
  title: string;
  contentType: 'essay' | 'field-note' | 'shelf' | 'project' | 'video';
  stage?: string;
  date: string; /* ISO string */
  tags: string[];
  summary?: string;
  connections: Connection[];
}

/* ── Date formatting ────────────────────────── */

const MONTH_FORMAT = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

const DAY_FORMAT = new Intl.DateTimeFormat('en-US', {
  day: '2-digit',
  month: 'short',
  timeZone: 'UTC',
});

function monthKey(iso: string) {
  const d = new Date(iso);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function formatMonth(key: string) {
  const [y, m] = key.split('-').map(Number);
  return MONTH_FORMAT.format(new Date(Date.UTC(y, m - 1, 1)));
}

function formatDay(iso: string) {
  return DAY_FORMAT.format(new Date(iso));
}

/* ── Stage labels ───────────────────────────── */

const STAGE_DISPLAY: Record<string, string> = {
  research: 'Research',
  drafting: 'Drafting',
  production: 'Production',
  published: 'Published',
  observation: 'Observation',
  developing: 'Developing',
  connected: 'Connected',
};

/* ── Studio editor link ─────────────────────── */

const STUDIO_BASE =
  typeof process !== 'undefined'
    ? (process.env.NEXT_PUBLIC_STUDIO_URL ?? 'http://localhost:8000')
    : 'http://localhost:8000';

const EDITOR_ROUTES: Record<string, string> = {
  essay: 'essays',
  'field-note': 'field-notes',
  shelf: 'shelf',
  video: 'videos',
  project: 'projects',
};

function editorHref(contentType: string, slug: string) {
  const route = EDITOR_ROUTES[contentType] ?? contentType;
  return `${STUDIO_BASE}/editor/${route}/${slug}/`;
}

/* ── Date range options ─────────────────────── */

const DATE_RANGES = [
  { key: 'week', label: '7 days' },
  { key: 'month', label: '30 days' },
  { key: 'all', label: 'All' },
] as const;

type DateRange = 'week' | 'month' | 'all';

/* ── Component ───────────────────────────────── */

interface TimelineViewProps {
  items: TimelineItem[];
}

export default function TimelineView({ items }: TimelineViewProps) {
  const [typeFilters, setTypeFilters] = useState<Set<string>>(
    () => new Set(CONTENT_TYPES.map((t) => t.slug)),
  );
  const [dateRange, setDateRange] = useState<DateRange>('all');

  /* Only show pills for types present in the data */
  const presentTypes = useMemo(() => {
    const present = new Set<string>(items.map((i) => i.contentType));
    return CONTENT_TYPES.filter((t) => present.has(t.slug));
  }, [items]);

  /* Apply filters */
  const filtered = useMemo(() => {
    const cutoffMs =
      dateRange === 'all'
        ? null
        : Date.now() - (dateRange === 'week' ? 7 : 30) * 86_400_000;

    return items.filter((item) => {
      if (!typeFilters.has(item.contentType)) return false;
      if (cutoffMs !== null && new Date(item.date).getTime() < cutoffMs)
        return false;
      return true;
    });
  }, [items, typeFilters, dateRange]);

  /* Flatten into a single row array for the virtualizer:
     each entry is either a month header or a timeline item. */
  type FlatRow =
    | { kind: 'header'; monthKey: string }
    | { kind: 'item'; item: TimelineItem };

  const flatRows = useMemo(() => {
    const map = new Map<string, TimelineItem[]>();
    for (const item of filtered) {
      const key = monthKey(item.date);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }

    const rows: FlatRow[] = [];
    for (const [key, groupItems] of map.entries()) {
      rows.push({ kind: 'header', monthKey: key });
      for (const item of groupItems) {
        rows.push({ kind: 'item', item });
      }
    }
    return rows;
  }, [filtered]);

  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: flatRows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => (flatRows[index].kind === 'header' ? 40 : 72),
    overscan: 8,
  });

  function toggleType(slug: string) {
    setTypeFilters((prev) => {
      const next = new Set(prev);
      if (next.has(slug) && next.size > 1) {
        next.delete(slug);
      } else {
        next.add(slug);
      }
      return next;
    });
  }

  return (
    <div className="studio-timeline-view">

      {/* ── Filter row ─────────────────────── */}
      <div className="studio-timeline-filters">
        <div className="studio-timeline-filter-group">
          {presentTypes.map((t) => (
            <button
              key={t.slug}
              className="studio-filter-pill"
              data-active={typeFilters.has(t.slug) ? 'true' : 'false'}
              style={{ color: t.color }}
              onClick={() => toggleType(t.slug)}
            >
              {t.pluralLabel}
            </button>
          ))}
        </div>
        <div className="studio-timeline-filter-group">
          {DATE_RANGES.map(({ key, label }) => (
            <button
              key={key}
              className="studio-filter-pill"
              data-active={dateRange === key ? 'true' : 'false'}
              style={{ color: 'var(--studio-text-muted)' }}
              onClick={() => setDateRange(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Empty state ─────────────────────── */}
      {flatRows.length === 0 && (
        <p className="studio-timeline-empty">No entries match the current filters.</p>
      )}

      {/* ── Virtualized timeline rows ────────── */}
      {flatRows.length > 0 && (
        <div ref={parentRef} className="studio-virtual-list-container">
          <div
            style={{
              height: virtualizer.getTotalSize(),
              width: '100%',
              position: 'relative',
            }}
          >
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const row = flatRows[virtualRow.index];

              if (row.kind === 'header') {
                return (
                  <div
                    key={`header-${row.monthKey}`}
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
                    <h2 className="studio-timeline-month-label">
                      {formatMonth(row.monthKey)}
                    </h2>
                  </div>
                );
              }

              const { item } = row;
              const typeId = getContentTypeIdentity(item.contentType);
              const color = typeId?.color ?? 'var(--studio-text-muted)';

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
                  <div className="studio-timeline-row">
                    <div className="studio-timeline-meta-col">
                      <div
                        className="studio-timeline-dot"
                        style={{ backgroundColor: color }}
                      />
                      <div className="studio-timeline-spine" />
                    </div>

                    <div className="studio-timeline-content-col">
                      <div className="studio-timeline-row-header">
                        <span
                          className="studio-timeline-type-label"
                          style={{ color }}
                        >
                          {typeId?.label ?? item.contentType}
                        </span>
                        <span className="studio-timeline-entry-date">
                          {formatDay(item.date)}
                        </span>
                        {item.stage && (
                          <span className="studio-timeline-stage-label">
                            {STAGE_DISPLAY[item.stage] ?? item.stage}
                          </span>
                        )}
                      </div>

                      <a
                        href={editorHref(item.contentType, item.slug)}
                        className="studio-timeline-title"
                        target="_blank"
                        rel="noreferrer"
                      >
                        {item.title}
                      </a>

                      {item.summary && (
                        <p className="studio-timeline-summary">
                          {item.summary}
                        </p>
                      )}

                      {item.connections.length > 0 && (
                        <div className="studio-timeline-connections">
                          {item.connections.slice(0, 4).map((conn) => (
                            <span
                              key={conn.id}
                              className="studio-timeline-conn-pill"
                              style={{
                                borderColor: conn.color,
                                color: conn.color,
                              }}
                            >
                              {conn.title}
                            </span>
                          ))}
                          {item.connections.length > 4 && (
                            <span className="studio-timeline-conn-more">
                              +{item.connections.length - 4}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
}
