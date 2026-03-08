'use client';

/**
 * ScopedTimelinePanel: timeline feed scoped to a notebook or project.
 *
 * Fetches from fetchFeed() with a notebook or project slug param,
 * then renders using the same DateHeader + NodeCard pattern as
 * the main TimelineView (without search/filter controls).
 *
 * Used as a sub-tab inside NotebookView and ProjectView.
 */

import { useCallback, useMemo } from 'react';
import { fetchFeed, groupNodesByDate, useApiData } from '@/lib/commonplace-api';
import type { MockNode } from '@/lib/commonplace';
import DateHeader from './DateHeader';
import NodeCard from './NodeCard';

interface ScopedTimelinePanelProps {
  notebook?: string;
  project?: string;
  onOpenObject?: (objectRef: number) => void;
}

export default function ScopedTimelinePanel({
  notebook,
  project,
  onOpenObject,
}: ScopedTimelinePanelProps) {
  const { data: nodes, loading, error, refetch } = useApiData(
    () => fetchFeed({ per_page: 50, notebook, project }),
    [notebook, project],
  );

  const dateGroups = useMemo(
    () => groupNodesByDate(nodes ?? []),
    [nodes],
  );

  const handleSelect = useCallback(
    (nodeId: string) => {
      const node = (nodes ?? []).find((n) => n.id === nodeId);
      if (node) onOpenObject?.(node.objectRef);
    },
    [onOpenObject, nodes],
  );

  if (loading) {
    return (
      <div className="cp-scoped-timeline">
        <div className="cp-loading-skeleton">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="cp-skeleton-card" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="cp-scoped-timeline">
        <div className="cp-error-banner">
          <span>
            {error.isNetworkError
              ? 'Could not reach CommonPlace API.'
              : `Error: ${error.message}`}
          </span>
          <button type="button" onClick={refetch}>Retry</button>
        </div>
      </div>
    );
  }

  if (dateGroups.length === 0) {
    return (
      <div className="cp-scoped-timeline">
        <div className="cp-empty-state">
          No timeline activity in this collection yet.
        </div>
      </div>
    );
  }

  return (
    <div className="cp-scoped-timeline cp-scrollbar">
      {dateGroups.map((group) => (
        <div key={group.dateKey}>
          <DateHeader label={group.dateLabel} />
          {group.nodes.map((node: MockNode) => (
            <NodeCard
              key={node.id}
              node={node}
              onSelect={handleSelect}
              allNodes={nodes ?? []}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
