'use client';

import { useState, useMemo, useCallback } from 'react';
import { fetchFeed, groupNodesByDate, useApiData, postRetrospective } from '@/lib/commonplace-api';
import { useCommonPlace } from '@/lib/commonplace-context';
import DateHeader from './DateHeader';
import NodeCard from './NodeCard';
import RetroNote from './RetroNote';
import TimelineSearch from './TimelineSearch';
import type { TimelineFilters } from './TimelineSearch';

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

export default function TimelineView({ onOpenObject }: TimelineViewProps) {
  const { captureVersion } = useCommonPlace();
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

  /* Track global card index for RetroNote insertion */
  let globalCardIdx = 0;
  /* Deterministic interval for retro notes: every 6th card
     (plan says 5 to 7, so 6 is the midpoint) */
  const RETRO_INTERVAL = 6;

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
        className="cp-scrollbar"
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
        {!loading &&
          dateGroups.map((group) => (
            <div key={group.dateKey}>
              <DateHeader label={group.dateLabel} />

              {group.nodes.map((node) => {
                const cardIdx = globalCardIdx++;
                const showRetro =
                  cardIdx > 0 &&
                  cardIdx % RETRO_INTERVAL === 0 &&
                  !filters.query;

                return (
                  <div key={node.id}>
                    {showRetro && (
                      <RetroNote
                        adjacentNodeId={node.id}
                        onSubmit={(text) => {
                          postRetrospective(node.id, text).catch((err) => {
                            console.warn('[RetroNote] save failed:', err.message);
                          });
                        }}
                      />
                    )}
                    <NodeCard
                      node={node}
                      onSelect={handleSelect}
                      allNodes={nodes ?? []}
                    />
                  </div>
                );
              })}
            </div>
          ))}
      </div>
    </div>
  );
}
