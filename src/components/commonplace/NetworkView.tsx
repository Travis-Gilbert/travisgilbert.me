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

import { useState, useCallback } from 'react';
import KnowledgeMap from './KnowledgeMap';
import EntityNetwork from './EntityNetwork';
import TimelineViz from './TimelineViz';
import FrameManager from './FrameManager';
import type { ViewFrame, GraphNode, GraphLink } from '@/lib/commonplace';
import { fetchGraph, useApiData } from '@/lib/commonplace-api';

type NetworkSubView = 'map' | 'entities' | 'timeline';

interface NetworkViewProps {
  onOpenObject?: (objectId: string) => void;
}

const SUB_VIEWS: { key: NetworkSubView; label: string }[] = [
  { key: 'map', label: 'Map' },
  { key: 'entities', label: 'Entities' },
  { key: 'timeline', label: 'Time' },
];

export default function NetworkView({ onOpenObject }: NetworkViewProps) {
  const [activeSubView, setActiveSubView] = useState<NetworkSubView>('map');

  /* Track zoom state for FrameManager (only used with map sub-view) */
  const [currentZoom, setCurrentZoom] = useState(1);
  const [currentCenter, setCurrentCenter] = useState({ x: 0, y: 0 });

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
            {SUB_VIEWS.map((sv) => (
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
            {SUB_VIEWS.map((sv) => (
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
            {SUB_VIEWS.map((sv) => (
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
          {SUB_VIEWS.map((sv) => (
            <button
              key={sv.key}
              className="cp-network-toggle"
              data-active={activeSubView === sv.key}
              onClick={() => setActiveSubView(sv.key)}
            >
              {sv.label}
            </button>
          ))}
        </div>
        {activeSubView === 'map' && (
          <FrameManager
            currentZoom={currentZoom}
            currentCenterX={currentCenter.x}
            currentCenterY={currentCenter.y}
            onRestoreFrame={handleRestoreFrame}
          />
        )}
      </div>

      {/* Active sub-view */}
      <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
        {activeSubView === 'map' && (
          <KnowledgeMap graphNodes={graphNodes} graphLinks={graphLinks} onOpenObject={onOpenObject} />
        )}
        {activeSubView === 'entities' && (
          <EntityNetwork graphNodes={graphNodes} graphLinks={graphLinks} onOpenObject={onOpenObject} />
        )}
        {activeSubView === 'timeline' && (
          <TimelineViz graphNodes={graphNodes} graphLinks={graphLinks} onOpenObject={onOpenObject} />
        )}
      </div>
    </div>
  );
}
