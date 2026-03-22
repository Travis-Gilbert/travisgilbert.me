'use client';

import { useState, useMemo } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { fetchFeed, fetchResurface, useApiData } from '@/lib/commonplace-api';
import { useLayout } from '@/lib/providers/layout-provider';
import { useCapture } from '@/lib/providers/capture-provider';
import { useDrawer } from '@/lib/providers/drawer-provider';
import type { MockEdge, MockNode } from '@/lib/commonplace';
import { getObjectTypeIdentity } from '@/lib/commonplace';
import ObjectRenderer, { type RenderableObject } from '../objects/ObjectRenderer';
import { renderableFromMockNode, renderableFromResurfaceCard } from '../objectRenderables';
import { useRenderableObjectAction } from '../useRenderableObjectAction';

/**
 * GridView: masonry card grid as the default CommonPlace view.
 *
 * Layout:
 *   - Resurface strip at top (3 compact cards from /resurface/)
 *   - Three-way toggle: Grid | Timeline | Graph (opens matching views)
 *   - Type filter chip row
 *   - CSS columns masonry (3 cols >1200px, 2 cols 768-1200px, 1 col mobile)
 *
 * Timeline/Graph are launched as real pane tabs via requestView().
 * Grid stays the active mode for this component.
 *
 * Adjacency clustering: before the masonry render, filteredNodes is
 * reordered by clusterByAdjacency() so strongly connected cards land
 * near each other in the CSS column layout. This is a one-pass greedy
 * sort, not a physics simulation; it runs once per filter change.
 */

/* ─────────────────────────────────────────────────
   Adjacency clustering helpers
   ───────────────────────────────────────────────── */

/**
 * Build a symmetric adjacency map from each node's edges array.
 * Edges carry both sourceId and targetId so we add both directions.
 */
function buildAdjacency(nodes: MockNode[]): Map<string, Set<string>> {
  const adj = new Map<string, Set<string>>();
  for (const node of nodes) {
    if (!adj.has(node.id)) adj.set(node.id, new Set());
    for (const edge of node.edges) {
      const other = edge.sourceId === node.id ? edge.targetId : edge.sourceId;
      adj.get(node.id)!.add(other);
      if (!adj.has(other)) adj.set(other, new Set());
      adj.get(other)!.add(node.id);
    }
  }
  return adj;
}

/**
 * Greedy adjacency clustering. Reorders the node array so that
 * connected nodes land near each other when CSS columns distributes
 * them top-to-bottom. Runs in O(n * WINDOW) per step (O(n²) total)
 * which is well under 50ms for 50 objects.
 *
 * Strategy: at each step pick the unplaced node with the most
 * connections to nodes placed within the last WINDOW positions.
 * WINDOW=6 covers roughly two columns of recently placed items.
 */
function clusterByAdjacency(nodes: MockNode[]): MockNode[] {
  if (nodes.length < 3) return nodes;

  const adj = buildAdjacency(nodes);
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const remaining = new Set(nodes.map((n) => n.id));
  const placed: MockNode[] = [];
  const WINDOW = 6;

  /* Start with the most-connected node as anchor */
  let startId = nodes[0].id;
  let maxDeg = -1;
  for (const node of nodes) {
    const deg = adj.get(node.id)?.size ?? 0;
    if (deg > maxDeg) { maxDeg = deg; startId = node.id; }
  }
  placed.push(nodeMap.get(startId)!);
  remaining.delete(startId);

  while (remaining.size > 0) {
    const recentIds = placed.slice(-WINDOW).map((n) => n.id);
    let bestId = '';
    let bestScore = -1;

    for (const id of remaining) {
      const neighbors = adj.get(id) ?? new Set<string>();
      let score = 0;
      for (const r of recentIds) {
        if (neighbors.has(r)) score++;
      }
      /* Tie-break by total degree so hub nodes attract clusters */
      const deg = adj.get(id)?.size ?? 0;
      const prevDeg = adj.get(bestId)?.size ?? 0;
      if (score > bestScore || (score === bestScore && deg > prevDeg)) {
        bestScore = score;
        bestId = id;
      }
    }

    placed.push(nodeMap.get(bestId)!);
    remaining.delete(bestId);
  }

  return placed;
}

const ALL_OBJECT_TYPES = [
  'source', 'hunch', 'person', 'quote', 'concept',
  'place', 'task', 'event', 'script', 'note',
] as const;

const VIEW_LABELS = {
  grid: 'Library',
  timeline: 'Timeline',
  graph: 'Map',
} as const;

interface GridViewProps {
  onOpenObject?: (objectRef: number) => void;
}

export default function GridView({ onOpenObject }: GridViewProps) {
  const prefersReducedMotion = useReducedMotion();
  const { launchView } = useLayout();
  const { captureVersion } = useCapture();
  const { openContextMenu } = useDrawer();

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
    const base = activeTypes.size === 0 ? nodes : nodes.filter((n) => activeTypes.has(n.objectType));
    return clusterByAdjacency(base);
  }, [nodes, activeTypes]);

  const handleObjectClick = useRenderableObjectAction(
    onOpenObject ? (obj) => onOpenObject(obj.id) : undefined,
  );

  const toggleType = (type: string) => {
    setActiveTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  const resurfaceNodes: RenderableObject[] = useMemo(() => {
    if (!resurfaceData) return [];
    return resurfaceData.cards.map(renderableFromResurfaceCard);
  }, [resurfaceData]);

  const gridObjects = useMemo(
    () => filteredNodes.map(renderableFromMockNode),
    [filteredNodes],
  );

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
              className={`cp-view-toggle-btn${mode === 'grid' ? ' cp-view-toggle-btn--active' : ''}`}
              onClick={() => {
                if (mode === 'timeline') {
                  launchView('timeline');
                  return;
                }
                if (mode === 'graph') {
                  launchView('network', {
                    filterTypes: Array.from(activeTypes),
                  });
                }
              }}
              aria-pressed={mode === 'grid'}
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
              <span>{VIEW_LABELS[mode]}</span>
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
          <div className="cp-drawer-section-head">
            <span className="cp-drawer-section-head-label">Resurface</span>
            <span className="cp-drawer-section-head-rule" />
          </div>
          <div className="cp-resurface-cards">
            <AnimatePresence mode="popLayout">
              {resurfaceNodes.map((obj) => (
                <motion.div
                  key={obj.id}
                  layout="position"
                  initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ layout: { duration: 0.2, ease: 'easeOut' } }}
                >
                  <ObjectRenderer
                    object={obj}
                    compact
                    variant="module"
                    onClick={handleObjectClick}
                    onContextMenu={(e, object) => openContextMenu(e.clientX, e.clientY, object)}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
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
            <AnimatePresence mode="popLayout">
              {gridObjects.map((obj, index) => (
                <motion.div
                  key={obj.id}
                  layout="position"
                  className="cp-masonry-item"
                  data-priority={(obj.edge_count ?? 0) >= 5 ? 'featured' : undefined}
                  initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{
                    layout: { duration: 0.2, ease: 'easeOut' },
                    opacity: prefersReducedMotion ? {} : { delay: Math.min(index * 0.03, 0.45) },
                    y: prefersReducedMotion ? {} : { delay: Math.min(index * 0.03, 0.45) },
                  }}
                >
                  <ObjectRenderer
                    object={obj}
                    variant="module"
                    onClick={handleObjectClick}
                    onContextMenu={(e, object) => openContextMenu(e.clientX, e.clientY, object)}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
