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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import FrameManager from '../shared/FrameManager';
import type { ViewFrame, GraphNode, GraphLink } from '@/lib/commonplace';
import { fetchGraph, useApiData } from '@/lib/commonplace-api';
import { useDrawer } from '@/lib/providers/drawer-provider';
import { useSelection } from '@/lib/providers/selection-provider';
import { useIsMobileViewport } from '@/hooks/useIsMobileViewport';
import styles from './GraphView.module.css';

type NetworkSubView = 'list' | 'global' | 'ego' | 'model';

interface NetworkViewProps {
  onOpenObject?: (objectId: string) => void;
  filterTypes?: string[];
}

const DESKTOP_SUB_VIEWS: { key: NetworkSubView; label: string }[] = [
  { key: 'global', label: 'Global' },
  { key: 'ego', label: 'Ego' },
  { key: 'model', label: 'Model' },
];

const MOBILE_SUB_VIEWS: { key: NetworkSubView; label: string }[] = [
  { key: 'list', label: 'List' },
  { key: 'global', label: 'Global' },
  { key: 'ego', label: 'Ego' },
  { key: 'model', label: 'Model' },
];

const LazyKnowledgeMap = dynamic(() => import('./KnowledgeMap'), {
  ssr: false,
  loading: () => <GraphViewSkeleton />,
});

const LazyCosmosGlobalGraph = dynamic(() => import('./CosmosGlobalGraph'), {
  ssr: false,
  loading: () => <GraphViewSkeleton />,
});

const LazyReactFlowModelCanvas = dynamic(() => import('./ReactFlowModelCanvas'), {
  ssr: false,
  loading: () => <GraphViewSkeleton />,
});

function graphNodeId(value: string | GraphNode): string {
  return typeof value === 'string' ? value : value.id;
}

function selectedGraph(nodes: GraphNode[], links: GraphLink[], selectedItems: Set<string>) {
  if (selectedItems.size === 0) return { nodes, links };
  const directlySelected = new Set(
    nodes
      .filter((node) => selectedItems.has(node.id) || (node.objectRef != null && selectedItems.has(String(node.objectRef))))
      .map((node) => node.id),
  );
  if (directlySelected.size === 0) return { nodes: [], links: [] };
  const included = new Set(directlySelected);
  for (const link of links) {
    const source = graphNodeId(link.source);
    const target = graphNodeId(link.target);
    if (directlySelected.has(source)) included.add(target);
    if (directlySelected.has(target)) included.add(source);
  }
  return {
    nodes: nodes.filter((node) => included.has(node.id)),
    links: links.filter((link) => included.has(graphNodeId(link.source)) && included.has(graphNodeId(link.target))),
  };
}

export default function NetworkView({ onOpenObject, filterTypes }: NetworkViewProps) {
  const { openReader } = useDrawer();
  const { selectedItems, selectSingle, clearSelection } = useSelection();
  const isMobile = useIsMobileViewport();
  const [activeSubView, setActiveSubView] = useState<NetworkSubView>('global');
  const [hasChosenView, setHasChosenView] = useState(false);
  const [getCanvasSnapshot, setGetCanvasSnapshot] = useState<(() => string | null) | null>(null);

  /* Track zoom state for FrameManager. */
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
    isMobile && !hasChosenView && activeSubView === 'global'
      ? 'list'
      : (!isMobile && activeSubView === 'list' ? 'global' : activeSubView);

  /* ── Fetch graph data once, shared by all sub-views ── */
  const { data: graphData, loading, error, refetch } = useApiData(() => fetchGraph(), []);
  const graphNodes: GraphNode[] = useMemo(() => graphData?.nodes ?? [], [graphData]);
  const graphLinks: GraphLink[] = useMemo(() => graphData?.links ?? [], [graphData]);
  const scopedGraph = useMemo(
    () => selectedGraph(graphNodes, graphLinks, selectedItems),
    [graphLinks, graphNodes, selectedItems],
  );
  const visibleGraphNodes = scopedGraph.nodes;
  const visibleGraphLinks = scopedGraph.links;

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
          <NetworkSubViewTabs
            subViews={subViews}
            value={effectiveSubView}
            disabled
            onChange={() => undefined}
          />
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
          <NetworkSubViewTabs
            subViews={subViews}
            value={effectiveSubView}
            disabled
            onChange={() => undefined}
          />
        </div>
        <div className="cp-error-banner" style={{ margin: 'var(--cp-space-4)' }}>
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
          <NetworkSubViewTabs
            subViews={subViews}
            value={effectiveSubView}
            disabled
            onChange={() => undefined}
          />
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
        <NetworkSubViewTabs
          subViews={subViews}
          value={effectiveSubView}
          onChange={(nextView) => {
            setHasChosenView(true);
            setActiveSubView(nextView);
          }}
        />
        {effectiveSubView === 'ego' && (
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
      <div className={styles.canvasFrame}>
        {effectiveSubView === 'list' && (
          <NetworkListView
            graphNodes={visibleGraphNodes}
            onOpenObject={onOpenObject}
            onSelectObject={selectSingle}
          />
        )}
        {effectiveSubView === 'global' && (
          <LazyCosmosGlobalGraph
            graphNodes={visibleGraphNodes}
            graphLinks={visibleGraphLinks}
            selectedItems={selectedItems}
            onSelectNode={selectSingle}
          />
        )}
        {effectiveSubView === 'ego' && (
          <LazyKnowledgeMap
            graphNodes={visibleGraphNodes}
            graphLinks={visibleGraphLinks}
            onOpenObject={onOpenObject}
            onReadObject={openReader}
            filter={graphFilter}
            registerSnapshotGetter={effectiveSubView === 'ego' ? handleRegisterSnapshotGetter : undefined}
          />
        )}
        {effectiveSubView === 'model' && (
          <LazyReactFlowModelCanvas
            graphNodes={visibleGraphNodes}
            graphLinks={visibleGraphLinks}
            selectedItems={selectedItems}
            onSelectNode={selectSingle}
          />
        )}
        {selectedItems.size > 0 && (
          <button
            type="button"
            className={`${styles.smallButton} ${styles.floatingClear}`}
            onClick={clearSelection}
          >
            Clear selection
          </button>
        )}
      </div>
    </div>
  );
}

function NetworkSubViewTabs({
  subViews,
  value,
  disabled,
  onChange,
}: {
  subViews: { key: NetworkSubView; label: string }[];
  value: NetworkSubView;
  disabled?: boolean;
  onChange: (value: NetworkSubView) => void;
}) {
  return (
    <Tabs
      value={value}
      onValueChange={(nextValue) => onChange(nextValue as NetworkSubView)}
      className={styles.modeTabs}
    >
      <TabsList className={styles.segmented} aria-label="Graph view">
        {subViews.map((subView) => (
          <TabsTrigger
            key={subView.key}
            value={subView.key}
            disabled={disabled}
            className={styles.segment}
          >
            {subView.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
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
        padding: 'var(--cp-space-4)',
      }}
    >
      <div className="cp-loading-skeleton" style={{ width: '100%', height: '72%', borderRadius: 10 }} />
    </div>
  );
}

function NetworkListView({
  graphNodes,
  onOpenObject,
  onSelectObject,
}: {
  graphNodes: GraphNode[];
  onOpenObject?: (objectId: string) => void;
  onSelectObject?: (objectId: string) => void;
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
          onClick={() => {
            onSelectObject?.(node.id);
            onOpenObject?.(node.id);
          }}
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
