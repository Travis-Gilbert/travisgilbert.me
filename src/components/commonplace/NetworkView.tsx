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

  /* Frame restoration handler: resets zoom to identity for now */
  const handleRestoreFrame = useCallback((frame: ViewFrame) => {
    /* In a full implementation this would animate the KnowledgeMap's
       D3 zoom transform to the frame's saved position. For now, the
       built-in frames just reset the view. */
    setCurrentZoom(frame.zoom);
    setCurrentCenter({ x: frame.centerX, y: frame.centerY });
  }, []);

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
        {activeSubView === 'map' && <KnowledgeMap onOpenObject={onOpenObject} />}
        {activeSubView === 'entities' && <EntityNetwork onOpenObject={onOpenObject} />}
        {activeSubView === 'timeline' && <TimelineViz onOpenObject={onOpenObject} />}
      </div>
    </div>
  );
}
