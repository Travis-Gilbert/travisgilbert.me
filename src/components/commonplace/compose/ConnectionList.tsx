'use client';

/**
 * ConnectionList: renders an object's edges (connections to other objects).
 *
 * Each edge shows:
 *   - direction arrow (outgoing or incoming)
 *   - other object's title (clickable, navigates to that object)
 *   - edge type label
 *   - reason text explaining why the connection exists
 *
 * Clicking a connection card calls onOpenObject, which opens
 * the target object in the same detail pane (replaces current detail).
 */

import { useState } from 'react';
import type { ApiEdgeCompact } from '@/lib/commonplace';

const MAX_VISIBLE = 3;

interface ConnectionListProps {
  edges: ApiEdgeCompact[];
  onOpenObject?: (objectRef: number, title?: string) => void;
}

export default function ConnectionList({ edges, onOpenObject }: ConnectionListProps) {
  const [expanded, setExpanded] = useState(false);
  if (edges.length === 0) return null;

  const hasOverflow = edges.length > MAX_VISIBLE;
  const visible = expanded ? edges : edges.slice(0, MAX_VISIBLE);

  return (
    <div className="cp-detail-section">
      <h3 className="cp-detail-section-label">
        Connections ({edges.length})
      </h3>
      <div className="cp-connection-list">
        {visible.map((edge) => (
          <button
            key={edge.id}
            type="button"
            className="cp-connection-card"
            onClick={() => onOpenObject?.(edge.other_id, edge.other_title)}
          >
            <span className="cp-connection-direction">
              {edge.direction === 'outgoing' ? '\u2192' : '\u2190'}
            </span>
            <div className="cp-connection-info">
              <span className="cp-connection-title">
                {edge.other_title}
              </span>
              <span className="cp-connection-meta">
                <span className="cp-connection-type">{edge.edge_type}</span>
                {edge.reason && (
                  <span className="cp-connection-reason">{edge.reason}</span>
                )}
              </span>
            </div>
            <span
              className="cp-connection-strength"
              title={`Strength: ${edge.strength}`}
              style={{ opacity: 0.3 + edge.strength * 0.7 }}
            >
              {'\u2022'.repeat(Math.max(1, Math.round(edge.strength * 3)))}
            </span>
          </button>
        ))}
      </div>
      {hasOverflow && (
        <button
          type="button"
          className="cp-connection-expand"
          onClick={() => setExpanded((prev) => !prev)}
        >
          {expanded
            ? 'Show fewer'
            : `Show all ${edges.length} connections`}
        </button>
      )}
    </div>
  );
}
