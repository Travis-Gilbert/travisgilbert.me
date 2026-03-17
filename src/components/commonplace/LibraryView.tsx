'use client';

import { useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  fetchClusters,
  fetchFeed,
  fetchGraph,
  fetchLineage,
  fetchProjects,
  fetchResurface,
  useApiData,
} from '@/lib/commonplace-api';
import { getObjectTypeIdentity, type ClusterResponse, type MockNode } from '@/lib/commonplace';
import { useCommonPlace } from '@/lib/commonplace-context';
import ObjectRenderer, { type RenderableObject } from './objects/ObjectRenderer';
import ResumeCards from './ResumeCards';
import LineageSwimlane from './LineageSwimlane';
import ClusterCard from './ClusterCard';
import InquiryBar from './InquiryBar';
import InquirySuggestions from './InquirySuggestions';
import {
  renderableFromClusterMember,
  renderableFromMockNode,
  renderableFromResurfaceCard,
} from './objectRenderables';
import { useRenderableObjectAction } from './useRenderableObjectAction';

interface LibraryViewProps {
  paneId?: string;
  onOpenObject?: (objectRef: number) => void;
}

function truncate(text: string, limit = 140): string {
  if (text.length <= limit) return text;
  return `${text.slice(0, limit - 1).trimEnd()}…`;
}

function buildClusterSummary(members: Array<{ title: string; body_preview: string }>): string {
  const preview = members.find((member) => member.body_preview.trim());
  if (preview?.body_preview) return truncate(preview.body_preview);

  const titles = members
    .map((member) => member.title)
    .filter(Boolean)
    .slice(0, 3);

  if (titles.length === 0) return 'Objects collecting around a shared thread.';
  return `${titles.join(' · ')}${members.length > 3 ? ' · more' : ''}`;
}

function formatReminder(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function clusterKeyFor(cluster: ClusterResponse): string {
  return `${cluster.type}:${cluster.label}`;
}

const DEMO_LIBRARY_NODES: MockNode[] = [
  {
    id: 'demo-1',
    objectRef: 12,
    objectSlug: 'on-walkable-software',
    objectType: 'note',
    title: 'On walkable software',
    summary: 'Good software has the quality of a walkable city: human scale, discoverable, rewards exploration.',
    capturedAt: '2026-03-09T02:30:00Z',
    edgeCount: 1,
    edges: [],
  },
  {
    id: 'demo-2',
    objectRef: 1,
    objectSlug: 'symbolic-analysis-of-relay-and-switching-circuits',
    objectType: 'source',
    title: 'A Symbolic Analysis of Relay and Switching Circuits',
    summary: "Claude Shannon's foundational work on switching circuits and symbolic logic.",
    capturedAt: '2026-03-09T01:55:00Z',
    edgeCount: 4,
    edges: [],
  },
  {
    id: 'demo-3',
    objectRef: 2,
    objectSlug: 'stigmergy',
    objectType: 'concept',
    title: 'Stigmergy',
    summary: 'Indirect coordination through environmental modification.',
    capturedAt: '2026-03-08T23:20:00Z',
    edgeCount: 7,
    edges: [],
  },
  {
    id: 'demo-4',
    objectRef: 3,
    objectSlug: 'connection-engines-are-stigmergic-systems',
    objectType: 'hunch',
    title: 'Connection engines are stigmergic systems',
    summary: 'Each edge modifies the knowledge environment and guides the next action.',
    capturedAt: '2026-03-08T23:45:00Z',
    edgeCount: 3,
    edges: [],
  },
  {
    id: 'demo-5',
    objectRef: 5,
    objectSlug: 'information-theory',
    objectType: 'source',
    title: 'Information theory',
    summary: 'Quantification, storage, and communication of information.',
    capturedAt: '2026-03-09T01:52:00Z',
    edgeCount: 3,
    edges: [],
  },
  {
    id: 'demo-6',
    objectRef: 7,
    objectSlug: 'strasbourg-cathedral',
    objectType: 'place',
    title: 'Strasbourg Cathedral',
    summary: 'Gothic masterwork. 142m spire.',
    capturedAt: '2026-03-05T14:15:00Z',
    edgeCount: 3,
    edges: [],
  },
];

const DEMO_CLUSTERS: ClusterResponse[] = [
  {
    type: 'concept',
    label: 'Information Architecture',
    color: '#7050A0',
    icon: 'cluster',
    count: 4,
    members: [
      { id: 1, title: 'A Symbolic Analysis of Relay and Switching Circuits', slug: 'symbolic-analysis-of-relay-and-switching-circuits', body_preview: "Claude Shannon's foundational work on switching circuits and symbolic logic.", edge_count: 4 },
      { id: 5, title: 'Information theory', slug: 'information-theory', body_preview: 'Quantification, storage, and communication of information.', edge_count: 3 },
      { id: 2, title: 'Stigmergy', slug: 'stigmergy', body_preview: 'Indirect coordination through environmental modification.', edge_count: 7 },
      { id: 3, title: 'Connection engines are stigmergic systems', slug: 'connection-engines-are-stigmergic-systems', body_preview: 'Each edge modifies the knowledge environment and guides the next action.', edge_count: 3 },
    ],
  },
  {
    type: 'place',
    label: 'Urban Systems as Software',
    color: '#2D8A5A',
    icon: 'cluster',
    count: 2,
    members: [
      { id: 12, title: 'On walkable software', slug: 'on-walkable-software', body_preview: 'Good software has the quality of a walkable city: human scale, discoverable, rewards exploration.', edge_count: 1 },
      { id: 7, title: 'Strasbourg Cathedral', slug: 'strasbourg-cathedral', body_preview: 'Gothic masterwork. 142m spire.', edge_count: 3 },
    ],
  },
];

export default function LibraryView({ onOpenObject }: LibraryViewProps) {
  const prefersReducedMotion = useReducedMotion();
  const { captureVersion, openContextMenu, launchView } = useCommonPlace();
  const [activeType, setActiveType] = useState<string | null>(null);
  const [activeClusterKey, setActiveClusterKey] = useState<string | null>(null);
  const [inquiryQuery, setInquiryQuery] = useState('');

  const { data: nodes, error } = useApiData(
    () => fetchFeed({ per_page: 100 }),
    [captureVersion],
  );
  const { data: resurfaceData } = useApiData(() => fetchResurface({ count: 3 }), []);
  const { data: clustersData } = useApiData(() => fetchClusters(), [captureVersion]);
  const { data: graphData } = useApiData(() => fetchGraph(), [captureVersion]);
  const { data: projects } = useApiData(() => fetchProjects(), []);

  const firstSlug = nodes?.[0]?.objectSlug ?? '';
  const { data: lineageData } = useApiData(
    () => (firstSlug ? fetchLineage(firstSlug) : Promise.resolve(null)),
    [firstSlug],
  );

  const handleObjectClick = useRenderableObjectAction(
    onOpenObject ? (obj) => onOpenObject(obj.id) : undefined,
  );

  const feedNodes = nodes && nodes.length > 0 ? nodes : DEMO_LIBRARY_NODES;
  const clusterItems = clustersData && clustersData.length > 0 ? clustersData : DEMO_CLUSTERS;
  const usingOfflinePreview = Boolean(error) || !nodes || nodes.length === 0;

  const types = useMemo(
    () => Array.from(new Set(feedNodes.map((node) => node.objectType))).sort(),
    [feedNodes],
  );

  const clusterFilters = useMemo(
    () =>
      clusterItems.map((cluster) => ({
        key: clusterKeyFor(cluster),
        label: cluster.label,
        memberIds: new Set(cluster.members.map((member) => member.id)),
      })),
    [clusterItems],
  );

  const activeCluster = useMemo(
    () => clusterFilters.find((cluster) => cluster.key === activeClusterKey) ?? null,
    [activeClusterKey, clusterFilters],
  );

  const allObjects = useMemo<RenderableObject[]>(
    () => feedNodes.map(renderableFromMockNode),
    [feedNodes],
  );

  const filteredNodes = useMemo(() => {
    let base = allObjects;

    if (activeCluster) {
      base = base.filter((node) => activeCluster.memberIds.has(node.id));
    }

    if (activeType) {
      base = base.filter((node) => node.object_type_slug === activeType);
    }

    return base;
  }, [activeCluster, activeType, allObjects]);

  const isFiltering = activeType !== null || activeCluster !== null;
  const lastEdited = allObjects[0] ?? null;
  const recentActivity = allObjects.slice(1, 4);

  const resurfacePills = useMemo(() => {
    const cards = resurfaceData?.cards?.length
      ? resurfaceData.cards
      : null;

    if (!cards) {
      // Demo fallback: create fake resurface pill data from demo nodes
      return DEMO_LIBRARY_NODES.slice(1, 4).map((node) => ({
        renderable: renderableFromMockNode(node),
        signal_label: 'fading connection',
        object: { slug: node.objectSlug || String(node.objectRef) },
      }));
    }

    return cards.map((card) => ({
      renderable: renderableFromResurfaceCard(card),
      signal_label: card.signal_label || card.signal.replace(/_/g, ' '),
      object: { slug: card.object.slug },
    }));
  }, [resurfaceData]);

  const reminderProjects = useMemo(
    () =>
      (projects ?? [])
        .filter((project) => !!project.reminder_at)
        .sort((a, b) => {
          const left = new Date(a.reminder_at || '').getTime();
          const right = new Date(b.reminder_at || '').getTime();
          return left - right;
        })
        .slice(0, 4),
    [projects],
  );
  const clusterCount = clustersData?.length ?? 0;

  // Compute edges per cluster from graph data for ClusterGraphWindow
  const clusterEdgesMap = useMemo(() => {
    const map = new Map<string, Array<{ from: number; to: number }>>();
    if (!graphData?.links) return map;

    for (const cluster of clusterItems) {
      const key = clusterKeyFor(cluster);
      const memberIds = new Set(cluster.members.map((m) => m.id));

      const clusterEdges = graphData.links
        .map((link) => {
          const sourceId = typeof link.source === 'string'
            ? parseInt(link.source.replace('object:', ''), 10)
            : (link.source as { objectRef?: number }).objectRef ?? 0;
          const targetId = typeof link.target === 'string'
            ? parseInt(link.target.replace('object:', ''), 10)
            : (link.target as { objectRef?: number }).objectRef ?? 0;
          return { from: sourceId, to: targetId };
        })
        .filter((e) => memberIds.has(e.from) && memberIds.has(e.to));

      map.set(key, clusterEdges);
    }
    return map;
  }, [graphData, clusterItems]);

  // Map objectId -> cluster color for chain node indicators
  const objectClusterColorMap = useMemo(() => {
    const map = new Map<number, string>();
    for (const cluster of clusterItems) {
      const color = cluster.color || getObjectTypeIdentity(cluster.type).color;
      for (const member of cluster.members) {
        map.set(member.id, color);
      }
    }
    return map;
  }, [clusterItems]);

  // Objects not belonging to any cluster
  const unclusteredObjects = useMemo(() => {
    const clusteredIds = new Set<number>();
    for (const cluster of clusterItems) {
      for (const member of cluster.members) {
        clusteredIds.add(member.id);
      }
    }
    return allObjects.filter((obj) => !clusteredIds.has(obj.id));
  }, [allObjects, clusterItems]);

  return (
    <div style={{ flex: 1, overflow: 'auto' }}>
      <div className="cp-pane-content-inner">
      {/* Combined header + inquiry bar */}
      <div style={{ marginBottom: 20 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 10,
          }}
        >
          <h2
            style={{
              margin: 0,
              fontFamily: 'var(--cp-font-title)',
              fontSize: 22,
              lineHeight: 1.08,
              color: 'var(--cp-text)',
              letterSpacing: '-0.02em',
              fontFeatureSettings: 'var(--cp-kern-title)',
            }}
          >
            Library
          </h2>
          <button
            type="button"
            className="cp-resurface-btn"
            onClick={() => launchView('resurface')}
            style={{
              border: '1px solid var(--cp-red-line)',
              background: 'var(--cp-red-soft)',
              color: 'var(--cp-red)',
              borderRadius: 5,
              padding: '5px 12px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              fontFamily: 'var(--cp-font-mono)',
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              cursor: 'pointer',
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: 'var(--cp-red)',
                flexShrink: 0,
              }}
            />
            Resurface
          </button>
        </div>
        <InquiryBar
          gapCount={0}
          onOpenObject={onOpenObject}
          externalQuery={inquiryQuery}
          onExternalQueryConsumed={() => setInquiryQuery('')}
        />
        <InquirySuggestions
          onSelectQuery={setInquiryQuery}
        />
      </div>

      {usingOfflinePreview && (
        <div
          style={{
            fontFamily: 'var(--cp-font-mono)',
            fontSize: 10,
            color: 'var(--cp-text-faint)',
            letterSpacing: '0.06em',
            padding: '2px 2px 0',
          }}
        >
          Offline preview. Start the notebook API to replace demo content with live data.
        </div>
      )}

      {(lastEdited || recentActivity.length > 0) && (
        <div className="cp-content-section"><ResumeCards
          lastEdited={lastEdited}
          recentActivity={recentActivity}
          onOpenObject={onOpenObject}
        />
        </div>
      )}

      {feedNodes.length > 0 && (
        <div className="cp-content-section"><LineageSwimlane
          nodes={feedNodes.slice(0, 6)}
          lineageData={lineageData}
          clusterColorMap={objectClusterColorMap}
          onOpenObject={onOpenObject}
          onContextMenu={(e, object) => openContextMenu(e.clientX, e.clientY, object)}
        /></div>
      )}

      <div className="cp-content-section">
        {types.length > 1 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 20 }}>
            {activeCluster && (
              <button
                type="button"
                onClick={() => setActiveClusterKey(null)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  fontFamily: 'var(--cp-font-mono)',
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  padding: '3px 10px',
                  borderRadius: 999,
                  border: '1px solid var(--cp-red-line)',
                  background: 'var(--cp-red-soft)',
                  color: 'var(--cp-red)',
                  cursor: 'pointer',
                }}
              >
                Cluster
                <span style={{ opacity: 0.72 }}>{activeCluster.label}</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setActiveType(null)}
              style={{
                fontFamily: 'var(--cp-font-mono)',
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                padding: '3px 10px',
                borderRadius: 999,
                border: '1px solid var(--cp-border)',
                background: activeType === null ? 'var(--cp-red-soft)' : 'transparent',
                color: activeType === null ? 'var(--cp-red)' : 'var(--cp-text-faint)',
                cursor: 'pointer',
              }}
            >
              All
            </button>
            {types.map((type) => {
              const identity = getObjectTypeIdentity(type);
              const isActive = activeType === type;
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => setActiveType(isActive ? null : type)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    fontFamily: 'var(--cp-font-mono)',
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                    padding: '3px 10px',
                    borderRadius: 999,
                    border: `1px solid ${isActive ? identity.color : 'var(--cp-border)'}`,
                    background: isActive ? `${identity.color}12` : 'transparent',
                    color: isActive ? identity.color : 'var(--cp-text-faint)',
                    cursor: 'pointer',
                  }}
                >
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: identity.color,
                      flexShrink: 0,
                    }}
                  />
                  {identity.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {isFiltering ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filteredNodes.length === 0 ? (
              <div
                style={{
                  fontFamily: 'var(--cp-font-mono)',
                  fontSize: 10,
                  color: 'var(--cp-chrome-muted)',
                  padding: '16px 0',
                  textAlign: 'center',
                }}
              >
                No objects match the current search.
              </div>
            ) : (
              <AnimatePresence mode="popLayout">
                {filteredNodes.map((obj) => (
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
                      variant="module"
                      onClick={handleObjectClick}
                      onContextMenu={(e, object) => openContextMenu(e.clientX, e.clientY, object)}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>
        ) : (
          <>
            <div className="cp-content-section">
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 10,
                }}
              >
                <span
                  style={{
                  fontFamily: 'var(--cp-font-mono)',
                  fontSize: 9,
                  fontWeight: 700,
                  color: 'var(--cp-purple)',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                }}
              >
                  Clusters
                </span>
                <div style={{ flex: 1, height: 1, background: 'var(--cp-border)' }} />
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 10,
                }}
              >
                {clusterItems.map((cluster) => {
                  const key = clusterKeyFor(cluster);
                  return (
                    <div key={key} style={{ display: 'flex' }}>
                      <ClusterCard
                        clusterKey={key}
                        label={cluster.label || getObjectTypeIdentity(cluster.type).label}
                        color={cluster.color}
                        summary={buildClusterSummary(cluster.members)}
                        memberCount={cluster.count}
                        members={cluster.members.map((member) =>
                          renderableFromClusterMember(member, cluster.type),
                        )}
                        edges={clusterEdgesMap.get(key)}
                        selected={activeClusterKey === key}
                        onSelectCluster={(clusterKey) =>
                          setActiveClusterKey((prev) => (prev === clusterKey ? null : clusterKey))
                        }
                        onOpenObject={handleObjectClick}
                        onContextMenu={(e, object) => openContextMenu(e.clientX, e.clientY, object)}
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            {unclusteredObjects.length > 0 && (
              <div className="cp-content-section">
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    marginBottom: 10,
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'var(--cp-font-mono)',
                      fontSize: 9,
                      fontWeight: 700,
                      color: 'var(--cp-text-faint)',
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                    }}
                  >
                    Not yet clustered
                  </span>
                  <div style={{ flex: 1, height: 1, background: 'var(--cp-border)' }} />
                  <span
                    style={{
                      fontFamily: 'var(--cp-font-mono)',
                      fontSize: 9,
                      color: 'var(--cp-text-faint)',
                    }}
                  >
                    {unclusteredObjects.length}
                  </span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {unclusteredObjects.map((obj) => {
                    const identity = getObjectTypeIdentity(obj.object_type_slug);
                    const isPill = obj.object_type_slug === 'concept' || obj.object_type_slug === 'person';
                    return (
                      <button
                        key={obj.slug}
                        type="button"
                        onClick={() => handleObjectClick(obj)}
                        onContextMenu={(e) => openContextMenu(e.clientX, e.clientY, obj)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '5px 12px 5px 8px',
                          borderRadius: isPill ? 100 : 6,
                          border: `1px solid ${identity.color}20`,
                          background: `${identity.color}06`,
                          cursor: 'pointer',
                          fontFamily: 'var(--cp-font-body)',
                          fontSize: 12,
                          fontWeight: 500,
                          color: 'var(--cp-text)',
                          maxWidth: 260,
                        }}
                      >
                        <span style={{
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          background: identity.color,
                          flexShrink: 0,
                        }} />
                        <span style={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}>
                          {obj.display_title ?? obj.title}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {resurfacePills.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    marginBottom: 10,
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'var(--cp-font-mono)',
                      fontSize: 9,
                      fontWeight: 700,
                      color: 'var(--cp-red)',
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                    }}
                  >
                    Resurfaced
                  </span>
                  <div style={{ flex: 1, height: 1, background: 'var(--cp-red-line)' }} />
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {resurfacePills.map((card) => (
                    <ResurfacedPill
                      key={card.object.slug}
                      object={card.renderable}
                      signal={card.signal_label}
                      onClick={handleObjectClick}
                      onContextMenu={(e, obj) => openContextMenu(e.clientX, e.clientY, obj)}
                    />
                  ))}
                </div>
              </div>
            )}

            {reminderProjects.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    marginBottom: 10,
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'var(--cp-font-mono)',
                      fontSize: 9,
                      fontWeight: 700,
                      color: 'var(--cp-type-task, var(--cp-chrome-muted))',
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                    }}
                  >
                    Reminders
                  </span>
                  <div style={{ flex: 1, height: 1, background: 'var(--cp-border)' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {reminderProjects.map((project) => (
                    <button
                      key={project.id}
                      type="button"
                      onClick={() => launchView('project', { slug: project.slug })}
                      style={{
                        textAlign: 'left',
                        border: '1px solid var(--cp-border)',
                        borderRadius: 6,
                        background: 'var(--cp-card)',
                        padding: '10px 14px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                      }}
                    >
                      <span
                        style={{
                          fontFamily: 'var(--cp-font-mono)',
                          fontSize: 9,
                          color: 'var(--cp-red)',
                          letterSpacing: '0.08em',
                          textTransform: 'uppercase',
                          flexShrink: 0,
                        }}
                      >
                        Due {project.reminder_at ? formatReminder(project.reminder_at) : 'Soon'}
                      </span>
                      <span
                        style={{
                          fontFamily: 'var(--cp-font-body)',
                          fontSize: 14,
                          fontWeight: 600,
                          color: 'var(--cp-text)',
                        }}
                      >
                        {project.name}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ResurfacedPill({
  object,
  signal,
  onClick,
  onContextMenu,
}: {
  object: RenderableObject;
  signal: string;
  onClick?: (obj: RenderableObject) => void;
  onContextMenu?: (e: React.MouseEvent, obj: RenderableObject) => void;
}) {
  const identity = getObjectTypeIdentity(object.object_type_slug);
  return (
    <button
      type="button"
      onClick={() => onClick?.(object)}
      onContextMenu={(e) => onContextMenu?.(e, object)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 14px 6px 10px',
        borderRadius: 100,
        border: '1px solid var(--cp-red-line)',
        background: 'var(--cp-red-soft)',
        maxWidth: 320,
        cursor: 'pointer',
        textAlign: 'left',
      }}
    >
      <MiniConnectionGraph
        edgeCount={object.edge_count ?? 0}
        color={identity.color}
        size={22}
      />
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{
            width: 5,
            height: 5,
            borderRadius: '50%',
            background: identity.color,
            flexShrink: 0,
          }} />
          <span style={{
            fontFamily: 'var(--cp-font-body)',
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--cp-text)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {object.display_title ?? object.title}
          </span>
        </div>
        <div style={{
          fontFamily: 'var(--cp-font-mono)',
          fontSize: 8,
          color: 'var(--cp-red)',
          marginTop: 1,
          letterSpacing: '0.04em',
        }}>
          {signal}
        </div>
      </div>
    </button>
  );
}

function MiniConnectionGraph({
  edgeCount,
  color,
  size = 22,
}: {
  edgeCount: number;
  color: string;
  size?: number;
}) {
  if (edgeCount < 1) return null;

  const cx = size / 2;
  const cy = size / 2;
  const centerR = 2.5;
  const outerR = size / 2 - 2;
  const nodeR = 1.5;
  const count = Math.min(edgeCount, 6);

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      fill="none"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      {Array.from({ length: count }, (_, i) => {
        const angle = (2 * Math.PI * i) / count - Math.PI / 2;
        const nx = cx + Math.cos(angle) * outerR;
        const ny = cy + Math.sin(angle) * outerR;
        return (
          <g key={i}>
            <line
              x1={cx}
              y1={cy}
              x2={nx}
              y2={ny}
              stroke={color}
              strokeOpacity={0.25}
              strokeWidth={0.5}
            />
            <circle cx={nx} cy={ny} r={nodeR} fill={color} opacity={0.5} />
          </g>
        );
      })}
      <circle cx={cx} cy={cy} r={centerR} fill={color} />
    </svg>
  );
}
