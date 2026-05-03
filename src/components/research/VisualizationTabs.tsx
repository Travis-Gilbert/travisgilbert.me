'use client';

/**
 * VisualizationTabs: tab switcher for the Paper Trails /research page.
 *
 * On mobile the default tab is List (lightweight, readable). Heavier graph
 * visualizations are lazy-loaded only when selected.
 */

import dynamic from 'next/dynamic';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useIsMobile } from '@/hooks/useIsMobile';
import type { ActivityDay, GraphNode, GraphResponse, ThreadListItem } from '@/lib/research';

const LazySourceGraph = dynamic(() => import('./SourceGraph'), {
  ssr: false,
  loading: () => <TabLoading label="Loading network" />,
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
    description: 'Force-directed graph of public Paper Trails sources and content.',
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
  graph: GraphResponse;
  activity: ActivityDay[];
  threads: ThreadListItem[];
}

export default function VisualizationTabs({
  graph,
  activity,
  threads,
}: VisualizationTabsProps) {
  const isMobile = useIsMobile();
  const tabs = isMobile ? MOBILE_TABS : DESKTOP_TABS;
  const [selectedTab, setSelectedTab] = useState<TabId>('list');
  const activeTab = !isMobile && selectedTab === 'list' ? 'graph' : selectedTab;

  const currentTab = tabs.find((t) => t.id === activeTab) ?? tabs[0];

  return (
    <div>
      {/* Tab buttons */}
      <div className="flex flex-wrap gap-1 mb-3">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setSelectedTab(tab.id)}
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
        {activeTab === 'list' && <ResearchListMode graph={graph} threads={threads} />}
        {activeTab === 'graph' && <LazySourceGraph initialData={graph} />}
        {activeTab === 'timeline' && <LazyResearchTimeline initialData={graph} />}
        {activeTab === 'constellation' && <LazySourceConstellation initialData={graph} />}
        {activeTab === 'activity' && <LazyActivityHeatmap initialActivity={activity} />}
        {activeTab === 'sankey' && <LazySourceSankey initialData={graph} />}
        {activeTab === 'summary' && <LazyResearchSummary initialData={graph} />}
      </div>
    </div>
  );
}

function ResearchListMode({
  graph,
  threads,
}: {
  graph: GraphResponse;
  threads: ThreadListItem[];
}) {
  const sorted = useMemo(() => {
    const degreeMap = new Map<string, number>();
    graph.edges.forEach((edge) => {
      degreeMap.set(edge.source, (degreeMap.get(edge.source) ?? 0) + 1);
      degreeMap.set(edge.target, (degreeMap.get(edge.target) ?? 0) + 1);
    });

    return [...graph.nodes]
      .map((node) => ({ ...node, connectionCount: degreeMap.get(node.id) ?? 0 }))
      .sort((a, b) => {
        if (b.connectionCount !== a.connectionCount) {
          return b.connectionCount - a.connectionCount;
        }
        return a.label.localeCompare(b.label);
      });
  }, [graph]);

  if (sorted.length === 0 && threads.length === 0) {
    return (
      <p className="text-ink-light text-sm font-body-alt">
        Index API has no public Paper Trails records yet.
      </p>
    );
  }

  return (
    <div className="grid gap-5">
      {threads.length > 0 && (
        <section>
          <h3 className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-faint mb-3">
            Active Threads
          </h3>
          <div className="grid gap-2">
            {threads.map((thread) => (
              <div key={thread.slug} className="border border-border px-3 py-3 bg-surface">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-title text-base leading-tight">{thread.title}</span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-faint whitespace-nowrap">
                    {thread.entry_count} entries
                  </span>
                </div>
                {thread.description && (
                  <p className="mt-1 text-sm text-ink-secondary">{thread.description}</p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {sorted.length > 0 && (
        <section>
          <h3 className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-faint mb-3">
            Graph Nodes
          </h3>
          <div className="grid gap-2">
            {sorted.map((node) => (
              <GraphNodeLink key={node.id} node={node} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function GraphNodeLink({ node }: { node: GraphNode & { connectionCount: number } }) {
  const href =
    node.type === 'essay'
      ? `/on/${node.slug}`
      : node.type === 'field_note'
        ? `/field-notes/${node.slug}`
        : node.type === 'source' && node.slug
          ? node.url ?? '#'
          : '#';
  const isExternal = href.startsWith('http');

  const content = (
    <>
      <div className="flex items-center justify-between gap-3">
        <span className="font-title text-base leading-tight">{node.label}</span>
        <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-faint whitespace-nowrap">
          {node.connectionCount}
        </span>
      </div>
      <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.08em] text-ink-faint">
        {(node.sourceType ?? node.type).replace('_', ' ')}
      </div>
    </>
  );

  if (isExternal) {
    return (
      <a
        href={href}
        className="no-underline border border-border bg-surface px-3 py-3 text-ink hover:text-ink hover:border-terracotta/40"
      >
        {content}
      </a>
    );
  }

  return (
    <Link
      href={href}
      className="no-underline border border-border bg-surface px-3 py-3 text-ink hover:text-ink hover:border-terracotta/40"
    >
      {content}
    </Link>
  );
}

function TabLoading({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center min-h-[300px] text-ink-light font-mono text-xs uppercase tracking-[0.08em]">
      {label}...
    </div>
  );
}
