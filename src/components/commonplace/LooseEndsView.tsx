'use client';

/**
 * LooseEndsView: orphan objects that lack connections.
 *
 * Fetches graph data (objects + edges) and filters to objects
 * with zero or very few connections. Grouped by object type
 * as a card grid. Threshold toggle via ViewSubTabs lets users
 * switch between "Orphaned" (0 edges) and "Barely Connected"
 * (0 or 1 edges).
 *
 * Clicking a card opens the object detail in an adjacent pane.
 */

import { useState, useMemo } from 'react';
import { fetchGraph, useApiData } from '@/lib/commonplace-api';
import { getObjectTypeIdentity } from '@/lib/commonplace';
import type { GraphNode } from '@/lib/commonplace';
import { useCommonPlace } from '@/lib/commonplace-context';
import ViewSubTabs from './ViewSubTabs';
import ObjectRenderer from './objects/ObjectRenderer';
import { renderableFromGraphNode } from './objectRenderables';
import { useRenderableObjectAction } from './useRenderableObjectAction';

interface LooseEndsViewProps {
  onOpenObject?: (objectRef: number, title?: string) => void;
}

const THRESHOLD_TABS = [
  { key: 'orphaned', label: 'Orphaned' },
  { key: 'barely', label: 'Barely Connected' },
];

export default function LooseEndsView({ onOpenObject }: LooseEndsViewProps) {
  const { openContextMenu } = useCommonPlace();
  const [thresholdKey, setThresholdKey] = useState('orphaned');
  const { data: graphData, loading, error, refetch } = useApiData(
    () => fetchGraph(),
    [],
  );

  const threshold = thresholdKey === 'orphaned' ? 0 : 1;
  const handleObjectClick = useRenderableObjectAction(
    onOpenObject
      ? (obj) => onOpenObject(obj.id, obj.display_title ?? obj.title)
      : undefined,
  );

  /* Filter + group nodes by type */
  const { groups, totalCount } = useMemo(() => {
    if (!graphData) return { groups: [] as [string, GraphNode[]][], totalCount: 0 };

    const looseNodes = graphData.nodes.filter((n) => n.edgeCount <= threshold);
    const groupMap = new Map<string, GraphNode[]>();

    for (const node of looseNodes) {
      const existing = groupMap.get(node.objectType);
      if (existing) existing.push(node);
      else groupMap.set(node.objectType, [node]);
    }

    /* Sort groups by count (most orphans first) */
    const sorted = [...groupMap.entries()].sort((a, b) => b[1].length - a[1].length);

    return { groups: sorted, totalCount: looseNodes.length };
  }, [graphData, threshold]);

  /* ── Loading state ── */
  if (loading) {
    return (
      <div className="cp-loose-ends-view cp-scrollbar">
        <div className="cp-loose-ends-header">
          <h2 className="cp-loose-ends-title">Loose Ends</h2>
        </div>
        <div style={{ padding: '0 16px' }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="cp-loading-skeleton"
              style={{ width: '100%', height: 56, borderRadius: 8, marginBottom: 8 }}
            />
          ))}
        </div>
      </div>
    );
  }

  /* ── Error state ── */
  if (error) {
    return (
      <div className="cp-loose-ends-view">
        <div className="cp-loose-ends-header">
          <h2 className="cp-loose-ends-title">Loose Ends</h2>
        </div>
        <div className="cp-error-banner" style={{ margin: 16 }}>
          <p>
            {error.isNetworkError
              ? 'Could not reach CommonPlace API.'
              : `Error: ${error.message}`}
          </p>
          <button type="button" onClick={refetch}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="cp-loose-ends-view cp-scrollbar">
      <div className="cp-loose-ends-header">
        <div>
          <h2 className="cp-loose-ends-title">Loose Ends</h2>
          <p className="cp-loose-ends-subtitle">
            Objects with {thresholdKey === 'orphaned' ? 'no' : 'few'} connections.
            Click to explore and connect them.
          </p>
        </div>
        {totalCount > 0 && (
          <span className="cp-loose-ends-count">{totalCount}</span>
        )}
      </div>

      <div style={{ padding: '0 16px 12px' }}>
        <ViewSubTabs
          tabs={THRESHOLD_TABS}
          active={thresholdKey}
          onChange={setThresholdKey}
        />
      </div>

      {/* Empty state */}
      {totalCount === 0 && (
        <div className="cp-empty-state" style={{ padding: '32px 16px' }}>
          All your objects are connected. Nice work.
        </div>
      )}

      {/* Grouped cards */}
      <div style={{ padding: '0 16px 16px' }}>
        {groups.map(([objectType, nodes]) => {
          const typeId = getObjectTypeIdentity(objectType);
          return (
            <div key={objectType} className="cp-loose-ends-group">
              <div
                className="cp-loose-ends-group-title"
                style={{ color: typeId.color }}
              >
                <span
                  className="cp-loose-ends-group-dot"
                  style={{ backgroundColor: typeId.color }}
                />
                {typeId.label}
                <span className="cp-loose-ends-group-count">({nodes.length})</span>
              </div>
              <div className="cp-loose-ends-grid">
                {nodes.map((node) => {
                  const object = renderableFromGraphNode(node);
                  return (
                    <ObjectRenderer
                      key={node.id}
                      object={object}
                      compact
                      variant="module"
                      onClick={handleObjectClick}
                      onContextMenu={(e, obj) => openContextMenu(e.clientX, e.clientY, obj)}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
