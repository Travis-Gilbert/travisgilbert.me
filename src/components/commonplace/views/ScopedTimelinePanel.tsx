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

import { useMemo } from 'react';
import { fetchFeed, groupNodesByDate, useApiData } from '@/lib/commonplace-api';
import type { MockNode } from '@/lib/commonplace';
import { useDrawer } from '@/lib/providers/drawer-provider';
import DateHeader from '../shared/DateHeader';
import ObjectRenderer from '../objects/ObjectRenderer';
import { renderableFromMockNode } from '../objectRenderables';
import { useRenderableObjectAction } from '../useRenderableObjectAction';

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
  const { openContextMenu } = useDrawer();
  const { data: nodes, loading, error, refetch } = useApiData(
    () => fetchFeed({ per_page: 50, notebook, project }),
    [notebook, project],
  );

  const dateGroups = useMemo(
    () => groupNodesByDate(nodes ?? []),
    [nodes],
  );

  const handleObjectClick = useRenderableObjectAction(
    onOpenObject ? (obj) => onOpenObject(obj.id) : undefined,
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
            <div
              key={node.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '88px minmax(0, 1fr)',
                gap: 12,
                alignItems: 'start',
                paddingBottom: 12,
              }}
            >
              <div
                style={{
                  fontFamily: 'var(--cp-font-mono)',
                  fontSize: 10,
                  color: 'var(--cp-chrome-muted)',
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  paddingTop: 10,
                }}
              >
                {new Date(node.capturedAt).toLocaleTimeString('en-US', {
                  hour: 'numeric',
                  minute: '2-digit',
                  hour12: true,
                })}
              </div>
              <ObjectRenderer
                object={renderableFromMockNode(node)}
                variant="timeline"
                onClick={handleObjectClick}
                onContextMenu={(e, obj) => openContextMenu(e.clientX, e.clientY, obj)}
              />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
