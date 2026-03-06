'use client';

import { useState, useMemo, useCallback, useEffect, useRef, type ReactNode } from 'react';
import { fetchFeed, groupNodesByDate, useApiData, postRetrospective } from '@/lib/commonplace-api';
import { useCommonPlace } from '@/lib/commonplace-context';
import type { MockNode } from '@/lib/commonplace';
import DateHeader from './DateHeader';
import NodeCard from './NodeCard';
import RetroNote from './RetroNote';
import TimelineSearch from './TimelineSearch';
import type { TimelineFilters } from './TimelineSearch';
import { useIsMobile } from '@/hooks/useIsMobile';

/**
 * TimelineView: scrollable feed of objects grouped by date.
 *
 * The primary "daily-use" view for CommonPlace. Shows all
 * captured objects in reverse chronological order, grouped by
 * date with sticky DateHeaders. Includes:
 *   - TimelineSearch at top (text + type filters)
 *   - DateHeader sticky separators
 *   - NodeCards for each object
 *   - RetroNotes inserted every 5 to 7 entries
 *
 * Registers as the 'timeline' view in PaneViewContent.
 */

interface TimelineViewProps {
  /** Callback when a node is clicked (opens detail in adjacent pane) */
  onOpenObject?: (objectRef: number) => void;
}

type TimelineRow =
  | { key: string; type: 'date'; label: string; estimatedHeight: number }
  | { key: string; type: 'retro'; nodeId: string; estimatedHeight: number }
  | { key: string; type: 'node'; node: MockNode; estimatedHeight: number };

const RETRO_INTERVAL = 6;
const DESKTOP_VIRTUALIZE_AFTER_ROWS = 120;
const MOBILE_VIRTUALIZE_AFTER_ROWS = 64;
const DESKTOP_OVERSCAN_PX = 920;
const MOBILE_OVERSCAN_PX = 560;

export default function TimelineView({ onOpenObject }: TimelineViewProps) {
  const { captureVersion } = useCommonPlace();
  const isMobile = useIsMobile();
  const { data: nodes, loading, error, refetch } = useApiData(
    () => fetchFeed({ page_size: 100 }),
    [captureVersion],
  );

  const [filters, setFilters] = useState<TimelineFilters>({
    query: '',
    activeTypes: new Set(),
  });

  /* Filter nodes (client-side on fetched data) */
  const filteredNodes = useMemo(() => {
    if (!nodes) return [];
    let result = nodes;

    /* Text search (title + summary) */
    if (filters.query) {
      const q = filters.query.toLowerCase();
      result = result.filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          n.summary.toLowerCase().includes(q)
      );
    }

    /* Type filter */
    if (filters.activeTypes.size > 0) {
      result = result.filter((n) => filters.activeTypes.has(n.objectType));
    }

    return result;
  }, [nodes, filters]);

  /* Group by date */
  const dateGroups = useMemo(
    () => groupNodesByDate(filteredNodes),
    [filteredNodes]
  );

  const handleSelect = useCallback(
    (nodeId: string) => {
      const node = (nodes ?? []).find((n) => n.id === nodeId);
      if (node) onOpenObject?.(node.objectRef);
    },
    [onOpenObject, nodes]
  );

  const timelineRows = useMemo(() => {
    const rows: TimelineRow[] = [];
    let cardIndex = 0;

    for (const group of dateGroups) {
      rows.push({
        key: `date-${group.dateKey}`,
        type: 'date',
        label: group.dateLabel,
        estimatedHeight: 42,
      });

      for (const node of group.nodes) {
        const showRetro = cardIndex > 0 && cardIndex % RETRO_INTERVAL === 0 && !filters.query;
        if (showRetro) {
          rows.push({
            key: `retro-${node.id}`,
            type: 'retro',
            nodeId: node.id,
            estimatedHeight: 118,
          });
        }
        rows.push({
          key: node.id,
          type: 'node',
          node,
          estimatedHeight: 142,
        });
        cardIndex += 1;
      }
    }

    return rows;
  }, [dateGroups, filters.query]);

  const shouldVirtualize =
    timelineRows.length >= (isMobile ? MOBILE_VIRTUALIZE_AFTER_ROWS : DESKTOP_VIRTUALIZE_AFTER_ROWS);
  const overscanPx = isMobile ? MOBILE_OVERSCAN_PX : DESKTOP_OVERSCAN_PX;
  const feedRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [rowHeights, setRowHeights] = useState<Record<string, number>>({});

  useEffect(() => {
    const container = feedRef.current;
    if (!container) return;

    const onScroll = () => setScrollTop(container.scrollTop);
    onScroll();
    container.addEventListener('scroll', onScroll, { passive: true });

    const resizeObserver = new ResizeObserver((entries) => {
      const next = Math.round(entries[0].contentRect.height);
      setViewportHeight(next);
    });
    resizeObserver.observe(container);

    return () => {
      container.removeEventListener('scroll', onScroll);
      resizeObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    const container = feedRef.current;
    if (!container) return;
    container.scrollTop = 0;
  }, [captureVersion, filters.query, filters.activeTypes]);

  const handleRowHeight = useCallback((rowKey: string, height: number) => {
    setRowHeights((prev) => {
      if (prev[rowKey] === height) return prev;
      return { ...prev, [rowKey]: height };
    });
  }, []);

  const { offsets, heights, totalHeight } = useMemo(() => {
    const nextOffsets: number[] = [];
    const nextHeights: number[] = [];
    let total = 0;

    for (const row of timelineRows) {
      nextOffsets.push(total);
      const measured = rowHeights[row.key];
      const rowHeight = measured && measured > 0 ? measured : row.estimatedHeight;
      nextHeights.push(rowHeight);
      total += rowHeight;
    }

    return { offsets: nextOffsets, heights: nextHeights, totalHeight: total };
  }, [timelineRows, rowHeights]);

  const { startIndex, endIndex, beforeHeight, afterHeight } = useMemo(() => {
    if (!shouldVirtualize || timelineRows.length === 0) {
      return {
        startIndex: 0,
        endIndex: timelineRows.length - 1,
        beforeHeight: 0,
        afterHeight: 0,
      };
    }

    const visibleStart = Math.max(0, scrollTop - overscanPx);
    const visibleEnd = scrollTop + Math.max(viewportHeight, 400) + overscanPx;
    const start = findStartIndex(offsets, heights, visibleStart);
    const end = findEndIndex(offsets, visibleEnd);
    const topSpacer = offsets[start] ?? 0;
    const bottomStart = (offsets[end] ?? 0) + (heights[end] ?? 0);
    const bottomSpacer = Math.max(0, totalHeight - bottomStart);

    return {
      startIndex: start,
      endIndex: end,
      beforeHeight: topSpacer,
      afterHeight: bottomSpacer,
    };
  }, [shouldVirtualize, timelineRows.length, scrollTop, viewportHeight, offsets, heights, totalHeight, overscanPx]);

  const visibleRows = useMemo(() => {
    if (!shouldVirtualize) return timelineRows;
    if (timelineRows.length === 0) return [];
    return timelineRows.slice(startIndex, endIndex + 1);
  }, [shouldVirtualize, timelineRows, startIndex, endIndex]);

  const renderRow = useCallback((row: TimelineRow) => {
    if (row.type === 'date') {
      return <DateHeader label={row.label} />;
    }

    if (row.type === 'retro') {
      return (
        <RetroNote
          adjacentNodeId={row.nodeId}
          onSubmit={(text) => {
            postRetrospective(row.nodeId, text).catch((err) => {
              console.warn('[RetroNote] save failed:', err.message);
            });
          }}
        />
      );
    }

    return (
      <NodeCard
        node={row.node}
        onSelect={handleSelect}
        allNodes={nodes ?? []}
      />
    );
  }, [handleSelect, nodes]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      {/* Search bar */}
      <TimelineSearch
        filters={filters}
        onChange={setFilters}
        resultCount={filteredNodes.length}
      />

      {/* Timeline feed */}
      <div
        ref={feedRef}
        className="cp-scrollbar cp-timeline-feed"
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '0 12px 20px',
        }}
      >
        {/* Loading state */}
        {loading && (
          <div className="cp-loading-skeleton">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="cp-skeleton-card" />
            ))}
          </div>
        )}

        {/* Error state */}
        {error && !loading && (
          <div className="cp-error-banner">
            <span>
              {error.isNetworkError
                ? 'Could not reach CommonPlace API.'
                : `Error: ${error.message}`}
            </span>
            <button type="button" onClick={refetch}>
              Retry
            </button>
          </div>
        )}

        {/* Empty state (not loading, no error, no data) */}
        {!loading && !error && dateGroups.length === 0 && (
          <div className="cp-empty-state">
            {filters.query || filters.activeTypes.size > 0
              ? 'No objects match your filters'
              : 'No objects captured yet. Use the capture bar to get started.'}
          </div>
        )}

        {/* Data */}
        {!loading && !error && timelineRows.length > 0 && (
          <>
            {shouldVirtualize && beforeHeight > 0 && (
              <div style={{ height: beforeHeight }} aria-hidden="true" />
            )}
            {visibleRows.map((row) => (
              shouldVirtualize ? (
                <MeasuredTimelineRow
                  key={row.key}
                  rowKey={row.key}
                  onHeight={handleRowHeight}
                >
                  {renderRow(row)}
                </MeasuredTimelineRow>
              ) : (
                <div key={row.key}>
                  {renderRow(row)}
                </div>
              )
            ))}
            {shouldVirtualize && afterHeight > 0 && (
              <div style={{ height: afterHeight }} aria-hidden="true" />
            )}
          </>
        )}
      </div>
    </div>
  );
}

function findStartIndex(offsets: number[], heights: number[], scrollValue: number): number {
  if (offsets.length === 0) return 0;
  let low = 0;
  let high = offsets.length - 1;
  let result = 0;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const rowEnd = offsets[mid] + heights[mid];
    if (rowEnd < scrollValue) {
      low = mid + 1;
    } else {
      result = mid;
      high = mid - 1;
    }
  }

  return result;
}

function findEndIndex(offsets: number[], visibleEnd: number): number {
  if (offsets.length === 0) return 0;
  let low = 0;
  let high = offsets.length - 1;
  let result = 0;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (offsets[mid] <= visibleEnd) {
      result = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return result;
}

function MeasuredTimelineRow({
  rowKey,
  onHeight,
  children,
}: {
  rowKey: string;
  onHeight: (rowKey: string, height: number) => void;
  children: ReactNode;
}) {
  const rowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const row = rowRef.current;
    if (!row) return;

    const emitHeight = () => {
      const next = Math.round(row.getBoundingClientRect().height);
      if (next > 0) onHeight(rowKey, next);
    };

    emitHeight();

    const resizeObserver = new ResizeObserver(() => {
      emitHeight();
    });
    resizeObserver.observe(row);

    return () => resizeObserver.disconnect();
  }, [rowKey, onHeight]);

  return <div ref={rowRef}>{children}</div>;
}
