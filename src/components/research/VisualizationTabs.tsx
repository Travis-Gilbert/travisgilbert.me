'use client';

/**
 * VisualizationTabs: tab switcher for the Paper Trails /research page.
 *
 * On mobile the default tab is List (lightweight, readable). Heavier graph
 * visualizations are lazy-loaded only when selected.
 */

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useIsMobile } from '@/hooks/useIsMobile';
import type { GraphNode, GraphEdge } from '@/lib/graph/connectionTransform';

const LazySourceGraph = dynamic(() => import('./SourceGraph'), {
  ssr: false,
  loading: () => <TabLoading label="Loading network" />,
});

const LazyConnectionMap = dynamic(() => import('@/components/ConnectionMap'), {
  ssr: false,
  loading: () => <TabLoading label="Loading connections" />,
});

const LazyResearchTimeline = dynamic(() => import('./ResearchTimeline'), {
  ssr: false,
  loading: () => <TabLoading label="Loading timeline" />,
});

const LazySourceConstellation = dynamic(() => import('./SourceConstellation'), {
  ssr: false,
  loading: () => <TabLoading label="Loading constellation" />,
});

const LazyActivityHeatmap = dynamic(() => import('./ActivityHeatmap'), {
  ssr: false,
  loading: () => <TabLoading label="Loading activity" />,
});

const LazySourceSankey = dynamic(() => import('./SourceSankey'), {
  ssr: false,
  loading: () => <TabLoading label="Loading flow" />,
});

const LazyResearchSummary = dynamic(() => import('./ResearchSummary'), {
  ssr: false,
  loading: () => <TabLoading label="Loading summary" />,
});

type TabId =
  | 'list'
  | 'graph'
  | 'connections'
  | 'timeline'
  | 'constellation'
  | 'activity'
  | 'sankey'
  | 'summary';

interface Tab {
  id: TabId;
  label: string;
  description: string;
}

const DESKTOP_TABS: Tab[] = [
  {
    id: 'graph',
    label: 'Network',
    description: 'Force-directed graph of sources and content. Drag to rearrange, click for details.',
  },
  {
    id: 'connections',
    label: 'Connections',
    description: 'How essays, field notes, projects, and shelf items relate to each other across the site.',
  },
  {
    id: 'timeline',
    label: 'Timeline',
    description: 'Sources arranged chronologically by type. Hover for details.',
  },
  {
    id: 'constellation',
    label: 'Constellation',
    description: 'Radial layout grouping sources by type. More connections, closer to center.',
  },
  {
    id: 'activity',
    label: 'Activity',
    description: 'Calendar heatmap of daily research activity over the past year.',
  },
  {
    id: 'sankey',
    label: 'Flow',
    description: 'How sources connect to essays and field notes, colored by role.',
  },
  {
    id: 'summary',
    label: 'Summary',
    description: 'Source counts by type and role, plus content ranked by connection count.',
  },
];

const MOBILE_TABS: Tab[] = [
  {
    id: 'list',
    label: 'List',
    description: 'Quick skim mode for mobile: highest-connection items first.',
  },
  ...DESKTOP_TABS,
];

interface VisualizationTabsProps {
  /** Connection graph nodes (from research API via connectionTransform) */
  connectionNodes?: GraphNode[];
  /** Connection graph edges (from research API via connectionTransform) */
  connectionEdges?: GraphEdge[];
}

export default function VisualizationTabs({
  connectionNodes = [],
  connectionEdges = [],
}: VisualizationTabsProps) {
  const isMobile = useIsMobile();
  const tabs = isMobile ? MOBILE_TABS : DESKTOP_TABS;
  const [activeTab, setActiveTab] = useState<TabId>(isMobile ? 'list' : 'graph');

  useEffect(() => {
    setActiveTab((previous) => {
      if (isMobile && previous === 'graph') return 'list';
      if (!isMobile && previous === 'list') return 'graph';
      return previous;
    });
  }, [isMobile]);

  const currentTab = tabs.find((t) => t.id === activeTab) ?? tabs[0];

  return (
    <div>
      {/* Tab buttons */}
      <div className="flex flex-wrap gap-1 mb-3">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`
              px-3 py-1.5 rounded font-mono text-[11px] tracking-wide uppercase
              transition-colors duration-150 border min-h-[44px]
              ${
                activeTab === tab.id
                  ? 'bg-surface-elevated border-border text-ink font-medium shadow-sm'
                  : 'bg-transparent border-transparent text-ink-light hover:text-ink hover:bg-surface-elevated/50'
              }
            `}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Description */}
      <p className="text-ink-secondary text-sm mb-4 font-body-alt">
        {currentTab.description}
      </p>

      {/* Active visualization */}
      <div className="min-h-[400px]">
        {activeTab === 'list' && <ResearchListMode nodes={connectionNodes} />}
        {activeTab === 'graph' && <LazySourceGraph />}
        {activeTab === 'connections' && (
          <LazyConnectionMap nodes={connectionNodes} edges={connectionEdges} />
        )}
        {activeTab === 'timeline' && <LazyResearchTimeline />}
        {activeTab === 'constellation' && <LazySourceConstellation />}
        {activeTab === 'activity' && <LazyActivityHeatmap />}
        {activeTab === 'sankey' && <LazySourceSankey />}
        {activeTab === 'summary' && <LazyResearchSummary />}
      </div>
    </div>
  );
}

function ResearchListMode({ nodes }: { nodes: GraphNode[] }) {
  const sorted = useMemo(
    () =>
      [...nodes].sort((a, b) => {
        if (b.connectionCount !== a.connectionCount) return b.connectionCount - a.connectionCount;
        return a.title.localeCompare(b.title);
      }),
    [nodes],
  );

  if (sorted.length === 0) {
    return (
      <p className="text-ink-light text-sm font-body-alt">
        No research connections yet.
      </p>
    );
  }

  return (
    <div className="grid gap-2">
      {sorted.map((node) => (
        <Link
          key={node.id}
          href={node.href}
          className="no-underline rounded-md border border-border px-3 py-3 text-ink hover:text-ink hover:border-terracotta/40"
        >
          <div className="flex items-center justify-between gap-3">
            <span className="font-title text-base leading-tight">{node.title}</span>
            <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-faint whitespace-nowrap">
              {node.connectionCount}
            </span>
          </div>
          <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.08em] text-ink-faint">
            {node.type.replace('-', ' ')}
          </div>
        </Link>
      ))}
    </div>
  );
}

function TabLoading({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center min-h-[300px] text-ink-light font-mono text-xs uppercase tracking-[0.08em]">
      {label}...
    </div>
  );
}
