'use client';

import { useState, useMemo, useCallback } from 'react';
import type { MockNode } from '@/lib/commonplace';
import { getMockData, groupNodesByDate } from '@/lib/commonplace-mock-data';
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
  onOpenObject?: (objectId: string) => void;
}

export default function TimelineView({ onOpenObject }: TimelineViewProps) {
  const { nodes } = getMockData();

  const [filters, setFilters] = useState<TimelineFilters>({
    query: '',
    activeTypes: new Set(),
  });

  /* Filter nodes */
  const filteredNodes = useMemo(() => {
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
      onOpenObject?.(nodeId);
    },
    [onOpenObject]
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
        {dateGroups.length === 0 && (
          <div
            style={{
              textAlign: 'center',
              padding: '40px 20px',
              fontFamily: 'var(--cp-font-mono)',
              fontSize: 11,
              color: 'var(--cp-text-faint)',
              fontStyle: 'italic',
            }}
          >
            {filters.query || filters.activeTypes.size > 0
              ? 'No objects match your filters'
              : 'No objects captured yet'}
          </div>
        )}

        {dateGroups.map((group) => (
          <div key={group.dateKey}>
            <DateHeader label={group.dateLabel} />

            {group.nodes.map((node) => {
              const cardIdx = globalCardIdx++;
              const showRetro =
                cardIdx > 0 &&
                cardIdx % RETRO_INTERVAL === 0 &&
                !filters.query; // hide retro notes when searching

              return (
                <div key={node.id}>
                  {showRetro && (
                    <RetroNote
                      adjacentNodeId={node.id}
                      onSubmit={(text) => {
                        /* In a real app, this would create a retrospective
                           note linked to the adjacent node */
                        console.log(
                          '[RetroNote] reflection:',
                          text,
                          'adjacent:',
                          node.id
                        );
                      }}
                    />
                  )}
                  <NodeCard
                    node={node}
                    onSelect={handleSelect}
                    allNodes={nodes}
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
