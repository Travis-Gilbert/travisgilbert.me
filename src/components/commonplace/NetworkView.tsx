'use client';

/**
 * NetworkView: wrapper for all three network sub-views.
 *
 * Provides a toolbar with toggle buttons (Map / Entities / Timeline)
 * and the FrameManager dropdown. Delegates rendering to KnowledgeMap,
 * EntityNetwork, or TimelineViz based on the active sub-view.
 *
 * Registers as the 'network' view type in SplitPaneContainer.
 */

import dynamic from 'next/dynamic';
import { useState, useCallback, useMemo } from 'react';
import FrameManager from './FrameManager';
import type { ViewFrame, GraphNode, GraphLink } from '@/lib/commonplace';
import { fetchGraph, useApiData } from '@/lib/commonplace-api';
import { useDrawer } from '@/lib/providers/drawer-provider';
import { useIsMobileViewport } from '@/hooks/useIsMobileViewport';

type NetworkSubView = 'list' | 'map' | 'entities' | 'timeline';

interface NetworkViewProps {
  onOpenObject?: (objectId: string) => void;
  filterTypes?: string[];
}

const DESKTOP_SUB_VIEWS: { key: NetworkSubView; label: string }[] = [
  { key: 'map', label: 'Map' },
  { key: 'entities', label: 'Entities' },
  { key: 'timeline', label: 'Timeline' },
];

const MOBILE_SUB_VIEWS: { key: NetworkSubView; label: string }[] = [
  { key: 'list', label: 'List' },
  { key: 'map', label: 'Map' },
  { key: 'entities', label: 'Entities' },
  { key: 'timeline', label: 'Timeline' },
];

const LazyKnowledgeMap = dynamic(() => import('./KnowledgeMap'), {
  ssr: false,
  loading: () => <GraphViewSkeleton />,
});

const LazyEntityNetwork = dynamic(() => import('./EntityNetwork'), {
  ssr: false,
  loading: () => <GraphViewSkeleton />,
});

const LazyTimelineViz = dynamic(() => import('./TimelineViz'), {
  ssr: false,
  loading: () => <GraphViewSkeleton />,
});

export default function NetworkView({ onOpenObject, filterTypes }: NetworkViewProps) {
  const { openReader } = useDrawer();
  const isMobile = useIsMobileViewport();
  const [activeSubView, setActiveSubView] = useState<NetworkSubView>('map');
  const [hasChosenView, setHasChosenView] = useState(false);
  const [getCanvasSnapshot, setGetCanvasSnapshot] = useState<(() => string | null) | null>(null);

  /* Track zoom state for FrameManager (only used with map sub-view) */
  const [currentZoom, setCurrentZoom] = useState(1);
  const [currentCenter, setCurrentCenter] = useState({ x: 0, y: 0 });
  const handleRegisterSnapshotGetter = useCallback((getter: (() => string | null) | null) => {
    setGetCanvasSnapshot(() => getter);
  }, []);

  const subViews = useMemo(
    () => (isMobile ? MOBILE_SUB_VIEWS : DESKTOP_SUB_VIEWS),
    [isMobile],
  );
  const graphFilter = useMemo(
    () => (filterTypes && filterTypes.length > 0 ? new Set(filterTypes) : undefined),
    [filterTypes],
  );

  const effectiveSubView =
    isMobile && !hasChosenView && activeSubView === 'map'
      ? 'list'
      : (!isMobile && activeSubView === 'list' ? 'map' : activeSubView);

  /* ── Fetch graph data once, shared by all sub-views ── */
  const { data: graphData, loading, error, refetch } = useApiData(() => fetchGraph(), []);
  const graphNodes: GraphNode[] = graphData?.nodes ?? [];
  const graphLinks: GraphLink[] = graphData?.links ?? [];

  /* Frame restoration handler: resets zoom to identity for now */
  const handleRestoreFrame = useCallback((frame: ViewFrame) => {
    /* In a full implementation this would animate the KnowledgeMap's
       D3 zoom transform to the frame's saved position. For now, the
       built-in frames just reset the view. */
    setCurrentZoom(frame.zoom);
    setCurrentCenter({ x: frame.centerX, y: frame.centerY });
  }, []);

  /* ── Loading state ── */
  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div className="cp-network-toolbar">
          <div style={{ display: 'flex', gap: 4, flex: 1 }}>
            {subViews.map((sv) => (
              <button key={sv.key} className="cp-network-toggle" data-active={false} disabled>
                {sv.label}
              </button>
            ))}
          </div>
        </div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="cp-loading-skeleton" style={{ width: '80%', height: '60%', borderRadius: 8 }} />
        </div>
      </div>
    );
  }

  /* ── Error state ── */
  if (error) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div className="cp-network-toolbar">
          <div style={{ display: 'flex', gap: 4, flex: 1 }}>
            {subViews.map((sv) => (
              <button key={sv.key} className="cp-network-toggle" data-active={false} disabled>
                {sv.label}
              </button>
            ))}
          </div>
        </div>
        <div className="cp-error-banner" style={{ margin: 16 }}>
          <p>Could not load knowledge graph.</p>
          <button onClick={refetch}>Retry</button>
        </div>
      </div>
    );
  }

  /* ── Empty state ── */
  if (graphNodes.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div className="cp-network-toolbar">
          <div style={{ display: 'flex', gap: 4, flex: 1 }}>
            {subViews.map((sv) => (
              <button key={sv.key} className="cp-network-toggle" data-active={false} disabled>
                {sv.label}
              </button>
            ))}
          </div>
        </div>
        <div className="cp-empty-state">
          <p>No objects yet. Capture something to see the knowledge graph.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Toolbar: sub-view toggles + frame manager */}
      <div className="cp-network-toolbar">
        <div style={{ display: 'flex', gap: 4, flex: 1 }}>
          {subViews.map((sv) => (
            <button
              key={sv.key}
              className="cp-network-toggle"
              data-active={effectiveSubView === sv.key}
              onClick={() => {
                setHasChosenView(true);
                setActiveSubView(sv.key);
              }}
            >
              {sv.label}
            </button>
          ))}
        </div>
        {effectiveSubView === 'map' && (
          <FrameManager
            currentZoom={currentZoom}
            currentCenterX={currentCenter.x}
            currentCenterY={currentCenter.y}
            onRestoreFrame={handleRestoreFrame}
            getCanvasSnapshot={getCanvasSnapshot ?? undefined}
          />
        )}
      </div>

      {/* Active sub-view */}
      <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
        {effectiveSubView === 'list' && (
          <NetworkListView graphNodes={graphNodes} onOpenObject={onOpenObject} />
        )}
        {effectiveSubView === 'map' && (
          <LazyKnowledgeMap
            graphNodes={graphNodes}
            graphLinks={graphLinks}
            onOpenObject={onOpenObject}
            onReadObject={openReader}
            filter={graphFilter}
            registerSnapshotGetter={effectiveSubView === 'map' ? handleRegisterSnapshotGetter : undefined}
          />
        )}
        {effectiveSubView === 'entities' && (
          <LazyEntityNetwork graphNodes={graphNodes} graphLinks={graphLinks} onOpenObject={onOpenObject} />
        )}
        {effectiveSubView === 'timeline' && (
          <LazyTimelineViz graphNodes={graphNodes} graphLinks={graphLinks} onOpenObject={onOpenObject} />
        )}
      </div>
    </div>
  );
}

function GraphViewSkeleton() {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div className="cp-loading-skeleton" style={{ width: '100%', height: '72%', borderRadius: 10 }} />
    </div>
  );
}

function NetworkListView({
  graphNodes,
  onOpenObject,
}: {
  graphNodes: GraphNode[];
  onOpenObject?: (objectId: string) => void;
}) {
  const sorted = useMemo(
    () =>
      [...graphNodes].sort((a, b) => {
        if (b.edgeCount !== a.edgeCount) return b.edgeCount - a.edgeCount;
        return a.title.localeCompare(b.title);
      }),
    [graphNodes],
  );

  return (
    <div className="cp-network-list cp-scrollbar">
      {sorted.map((node) => (
        <button
          key={node.id}
          type="button"
          className="cp-network-list-item"
          onClick={() => onOpenObject?.(node.id)}
        >
          <span className="cp-network-list-title">{node.title}</span>
          <span className="cp-network-list-meta">
            {node.objectType} · {node.edgeCount} connections
          </span>
        </button>
      ))}
    </div>
  );
}
