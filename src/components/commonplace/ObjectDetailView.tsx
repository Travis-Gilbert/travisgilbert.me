'use client';

/**
 * ObjectDetailView: full detail for a single CommonPlace object.
 *
 * Layout:
 *   Header: type badge + display title + captured timestamp
 *   Body: object body text (prose)
 *   URL: original URL with OG metadata (if present)
 *   Components: typed properties (ComponentList)
 *   Connections: edges to other objects (ConnectionList, clickable)
 *   Recent Activity: mini timeline of recent nodes
 *
 * Fetches data via useApiData(() => fetchObjectById(objectRef)).
 * Connection clicks call onOpenObject, which replaces the current
 * detail pane content (stays in same pane, per design decision).
 */

import { useMemo } from 'react';
import { fetchObjectById, useApiData } from '@/lib/commonplace-api';
import { getObjectTypeIdentity } from '@/lib/commonplace';
import type { ApiObjectDetail, ApiNodeListItem } from '@/lib/commonplace';
import ComponentList from './ComponentList';
import ConnectionList from './ConnectionList';

interface ObjectDetailViewProps {
  objectRef: number;
  onOpenObject?: (objectRef: number, title?: string) => void;
}

/** Format a relative time string from an ISO date */
function relativeTime(isoDate: string): string {
  const now = Date.now();
  const then = new Date(isoDate).getTime();
  const diffMs = now - then;

  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks}w ago`;

  return new Date(isoDate).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/** Describe a node's event type for the mini timeline */
function nodeEventLabel(node: ApiNodeListItem): string {
  const typeMap: Record<string, string> = {
    creation: 'Created',
    update: 'Updated',
    connection: 'Connection found',
    enrichment: 'Enriched',
    retrospective: 'Reflected on',
  };
  return typeMap[node.node_type] ?? node.node_type;
}

export default function ObjectDetailView({
  objectRef,
  onOpenObject,
}: ObjectDetailViewProps) {
  const {
    data: detail,
    loading,
    error,
    refetch,
  } = useApiData(() => fetchObjectById(objectRef), [objectRef]);

  /* Derive type identity from API data */
  const typeIdentity = useMemo(() => {
    if (!detail) return null;
    return getObjectTypeIdentity(detail.object_type_data?.slug ?? '');
  }, [detail]);

  /* ── Loading state ── */
  if (loading) {
    return (
      <div className="cp-object-detail">
        <div className="cp-detail-header">
          <div
            className="cp-loading-skeleton"
            style={{ width: 60, height: 20, borderRadius: 10 }}
          />
          <div
            className="cp-loading-skeleton"
            style={{ width: '70%', height: 28, borderRadius: 4, marginTop: 8 }}
          />
        </div>
        <div style={{ padding: '16px 20px' }}>
          <div
            className="cp-loading-skeleton"
            style={{ width: '100%', height: 120, borderRadius: 4 }}
          />
        </div>
      </div>
    );
  }

  /* ── Error state ── */
  if (error) {
    return (
      <div className="cp-object-detail">
        <div className="cp-error-banner" style={{ margin: 16 }}>
          <p>
            {error.isNetworkError
              ? 'Could not reach CommonPlace API.'
              : `Error loading object: ${error.message}`}
          </p>
          <button type="button" onClick={refetch}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  /* ── No data ── */
  if (!detail || !typeIdentity) {
    return (
      <div className="cp-object-detail">
        <div className="cp-empty-state">Object not found.</div>
      </div>
    );
  }

  return (
    <div className="cp-object-detail cp-scrollbar">
      {/* ── Header ── */}
      <div className="cp-detail-header">
        <div className="cp-detail-header-top">
          <span
            className="cp-detail-type-badge"
            style={{
              backgroundColor: typeIdentity.color,
              color:
                typeIdentity.slug === 'note'
                  ? 'var(--cp-color-text)'
                  : '#F5F0E8',
            }}
          >
            {typeIdentity.label.toUpperCase()}
          </span>
          <span className="cp-detail-timestamp">
            Captured {relativeTime(detail.captured_at)}
          </span>
        </div>
        <h2 className="cp-detail-title">{detail.display_title || detail.title}</h2>
      </div>

      {/* ── Body text ── */}
      {detail.body && (
        <div className="cp-detail-body">
          <p>{detail.body}</p>
        </div>
      )}

      {/* ── URL + OG metadata ── */}
      {detail.url && (
        <div className="cp-detail-url">
          <a href={detail.url} target="_blank" rel="noopener noreferrer">
            {detail.url.length > 70 ? detail.url.slice(0, 67) + '...' : detail.url}
          </a>
          {(detail.og_title || detail.og_description) && (
            <div className="cp-detail-og">
              {detail.og_title && (
                <span className="cp-detail-og-title">{detail.og_title}</span>
              )}
              {detail.og_description && (
                <span className="cp-detail-og-desc">{detail.og_description}</span>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Components (typed properties) ── */}
      <ComponentList components={detail.components} />

      {/* ── Connections (edges) ── */}
      <ConnectionList edges={detail.edges} onOpenObject={onOpenObject} />

      {/* ── Recent Activity (mini timeline) ── */}
      {detail.recent_nodes && detail.recent_nodes.length > 0 && (
        <div className="cp-detail-section">
          <h3 className="cp-detail-section-label">Recent Activity</h3>
          <div className="cp-history-list">
            {detail.recent_nodes.map((node: ApiNodeListItem) => (
              <div key={node.id} className="cp-history-item">
                <span className="cp-history-dot" />
                <span className="cp-history-label">
                  {nodeEventLabel(node)}
                </span>
                <span className="cp-history-time">
                  {relativeTime(node.occurred_at)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
