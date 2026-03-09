'use client';

import { useState, useMemo, useCallback } from 'react';
import { fetchFeed, fetchResurface, useApiData } from '@/lib/commonplace-api';
import { useCommonPlace } from '@/lib/commonplace-context';
import type { MockEdge, MockNode } from '@/lib/commonplace';
import { getObjectTypeIdentity } from '@/lib/commonplace';
import ObjectCard from './ObjectCard';

/**
 * GridView: masonry card grid as the default CommonPlace view.
 *
 * Layout:
 *   - Resurface strip at top (3 compact cards from /resurface/)
 *   - Three-way toggle: Grid | Timeline | Graph (stored in context)
 *   - Type filter chip row
 *   - CSS columns masonry (3 cols >1200px, 2 cols 768-1200px, 1 col mobile)
 *
 * The three-way toggle changes viewMode in CommonPlaceContext. The
 * SplitPaneContainer reads this and switches the rendered view type.
 */

const ALL_OBJECT_TYPES = [
  'source', 'hunch', 'person', 'quote', 'concept',
  'place', 'task', 'event', 'script', 'note',
] as const;

interface GridViewProps {
  onOpenObject?: (objectRef: number) => void;
}

export default function GridView({ onOpenObject }: GridViewProps) {
  const { captureVersion, viewMode, setViewMode } = useCommonPlace();

  const { data: nodes, loading, error, refetch } = useApiData(
    () => fetchFeed({ per_page: 100 }),
    [captureVersion],
  );

  const { data: resurfaceData } = useApiData(
    () => fetchResurface({ count: 4 }),
    [],
  );

  const [activeTypes, setActiveTypes] = useState<Set<string>>(new Set());

  const filteredNodes = useMemo(() => {
    if (!nodes) return [];
    if (activeTypes.size === 0) return nodes;
    return nodes.filter((n) => activeTypes.has(n.objectType));
  }, [nodes, activeTypes]);

  const handleSelect = useCallback(
    (nodeId: string) => {
      const node = (nodes ?? []).find((n) => n.id === nodeId);
      if (node) onOpenObject?.(node.objectRef);
    },
    [onOpenObject, nodes],
  );

  const toggleType = useCallback((type: string) => {
    setActiveTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }, []);

  const resurfaceNodes: MockNode[] = useMemo(() => {
    if (!resurfaceData) return [];
    return resurfaceData.cards.map((card) => ({
      id: String(card.object.id),
      objectRef: card.object.id,
      objectSlug: card.object.slug,
      objectType: card.object.object_type_data?.slug ?? '',
      title: card.object.display_title ?? card.object.title,
      summary: card.object.og_description ?? card.object.body.slice(0, 200),
      capturedAt: card.object.captured_at,
      edgeCount: card.object.edges.length,
      edges: [] as MockEdge[],
    }));
  }, [resurfaceData]);

  return (
    <div className="cp-grid-view">
      {/* Header: view toggle + type filters */}
      <div className="cp-grid-header">
        {/* Three-way view toggle */}
        <div className="cp-view-toggle" role="group" aria-label="View mode">
          {(['grid', 'timeline', 'graph'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              className={`cp-view-toggle-btn${viewMode === mode ? ' cp-view-toggle-btn--active' : ''}`}
              onClick={() => setViewMode(mode)}
              aria-pressed={viewMode === mode}
            >
              {mode === 'grid' && (
                <svg width={13} height={13} viewBox="0 0 13 13" fill="none" aria-hidden="true">
                  <rect x={0.5} y={0.5} width={5} height={5} rx={0.5} stroke="currentColor" strokeWidth={1} />
                  <rect x={7.5} y={0.5} width={5} height={5} rx={0.5} stroke="currentColor" strokeWidth={1} />
                  <rect x={0.5} y={7.5} width={5} height={5} rx={0.5} stroke="currentColor" strokeWidth={1} />
                  <rect x={7.5} y={7.5} width={5} height={5} rx={0.5} stroke="currentColor" strokeWidth={1} />
                </svg>
              )}
              {mode === 'timeline' && (
                <svg width={13} height={13} viewBox="0 0 13 13" fill="none" aria-hidden="true">
                  <line x1={2} y1={3} x2={11} y2={3} stroke="currentColor" strokeWidth={1} strokeLinecap="round" />
                  <line x1={2} y1={6.5} x2={9} y2={6.5} stroke="currentColor" strokeWidth={1} strokeLinecap="round" />
                  <line x1={2} y1={10} x2={11} y2={10} stroke="currentColor" strokeWidth={1} strokeLinecap="round" />
                </svg>
              )}
              {mode === 'graph' && (
                <svg width={13} height={13} viewBox="0 0 13 13" fill="none" aria-hidden="true">
                  <circle cx={6.5} cy={6.5} r={2} stroke="currentColor" strokeWidth={1} />
                  <circle cx={2} cy={2} r={1.2} stroke="currentColor" strokeWidth={1} />
                  <circle cx={11} cy={2} r={1.2} stroke="currentColor" strokeWidth={1} />
                  <circle cx={6.5} cy={11} r={1.2} stroke="currentColor" strokeWidth={1} />
                  <line x1={3.4} y1={3.4} x2={5.1} y2={5.1} stroke="currentColor" strokeWidth={0.8} />
                  <line x1={9.6} y1={3.4} x2={7.9} y2={5.1} stroke="currentColor" strokeWidth={0.8} />
                  <line x1={6.5} y1={8.5} x2={6.5} y2={9.8} stroke="currentColor" strokeWidth={0.8} />
                </svg>
              )}
              <span>{mode.charAt(0).toUpperCase() + mode.slice(1)}</span>
            </button>
          ))}
        </div>

        {/* Type filter chips */}
        <div className="cp-type-chips" role="group" aria-label="Filter by type">
          {ALL_OBJECT_TYPES.map((type) => {
            const info = getObjectTypeIdentity(type);
            const isActive = activeTypes.has(type);
            return (
              <button
                key={type}
                type="button"
                className={`cp-type-chip${isActive ? ' cp-type-chip--active' : ''}`}
                style={{ '--chip-color': info.color } as React.CSSProperties}
                onClick={() => toggleType(type)}
                aria-pressed={isActive}
              >
                {info.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Resurface strip */}
      {resurfaceNodes.length > 0 && (
        <div className="cp-resurface-strip">
          <div className="cp-resurface-label">
            {'R\nE\nS\nU\nR\nF\nA\nC\nE'}
          </div>
          <div className="cp-resurface-cards">
            {resurfaceNodes.map((node) => (
              <ObjectCard
                key={node.id}
                node={node}
                onSelect={handleSelect}
                allNodes={nodes ?? []}
                mode="timeline"
              />
            ))}
          </div>
        </div>
      )}

      {/* Masonry grid */}
      <div className="cp-grid-scroll cp-scrollbar">
        {loading && (
          <div className="cp-loading-skeleton">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="cp-skeleton-card" style={{ height: 80 + (i % 3) * 40 }} />
            ))}
          </div>
        )}

        {error && !loading && (
          <div className="cp-error-banner">
            <span>
              {error.isNetworkError
                ? 'Could not reach CommonPlace API.'
                : `Error: ${error.message}`}
            </span>
            <button type="button" onClick={refetch}>Retry</button>
          </div>
        )}

        {!loading && !error && filteredNodes.length === 0 && (
          <div className="cp-empty-state">
            {activeTypes.size > 0
              ? 'No objects match the selected types.'
              : 'No objects captured yet. Use the capture bar to get started.'}
          </div>
        )}

        {!loading && !error && filteredNodes.length > 0 && (
          <div className="cp-masonry">
            {filteredNodes.map((node) => (
              <div key={node.id} className="cp-masonry-item">
                <ObjectCard
                  node={node}
                  onSelect={handleSelect}
                  allNodes={nodes ?? []}
                  mode="grid"
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
