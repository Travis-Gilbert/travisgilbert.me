'use client';

import { useState, useMemo } from 'react';
import { fetchFeed, fetchResurface, fetchClusters, fetchLineage, useApiData } from '@/lib/commonplace-api';
import { useCommonPlace } from '@/lib/commonplace-context';
import type { MockNode } from '@/lib/commonplace';
import { getObjectTypeIdentity } from '@/lib/commonplace';
import type { RenderableObject } from './objects/ObjectRenderer';
import ObjectRenderer from './objects/ObjectRenderer';
import ResumeCards from './ResumeCards';
import LineageSwimlane from './LineageSwimlane';
import ClusterCard from './ClusterCard';

interface LibraryViewProps {
  paneId?: string;
  onOpenObject?: (objectRef: number) => void;
}

function mockNodeToRenderable(node: MockNode): RenderableObject {
  return {
    id: node.objectRef,
    title: node.title,
    object_type_slug: node.objectType,
    body: node.summary || undefined,
    captured_at: node.capturedAt || undefined,
    edge_count: node.edgeCount,
  };
}

export default function LibraryView({ onOpenObject }: LibraryViewProps) {
  const { captureVersion, openContextMenu } = useCommonPlace();

  const { data: nodes, loading, error } = useApiData(
    () => fetchFeed({ per_page: 100 }),
    [captureVersion],
  );

  const { data: resurfaceData } = useApiData(
    () => fetchResurface({ count: 3 }),
    [],
  );

  const { data: clustersData } = useApiData(
    () => fetchClusters(),
    [captureVersion],
  );

  const firstSlug = nodes?.[0]?.objectSlug ?? '';
  const { data: lineageData } = useApiData(
    () => (firstSlug ? fetchLineage(firstSlug) : Promise.resolve(null)),
    [firstSlug],
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [activeType, setActiveType] = useState<string | null>(null);

  const types = useMemo(
    () => (clustersData ?? []).map((c) => c.type),
    [clustersData],
  );

  const filteredNodes = useMemo<RenderableObject[]>(() => {
    if (!nodes) return [];
    let base = nodes;
    if (activeType) base = base.filter((n) => n.objectType === activeType);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      base = base.filter((n) => n.title.toLowerCase().includes(q));
    }
    return base.map(mockNodeToRenderable);
  }, [nodes, activeType, searchQuery]);

  const isFiltering = searchQuery.length > 0 || activeType !== null;

  const lastEdited = nodes?.[0] ? mockNodeToRenderable(nodes[0]) : null;
  const recentActivity = (nodes ?? []).slice(1, 4).map(mockNodeToRenderable);

  const resurfaceRenderables = useMemo<RenderableObject[]>(() => {
    if (!resurfaceData?.cards) return [];
    return resurfaceData.cards.map((card) => ({
      id: card.object.id,
      title: card.object.title,
      display_title: card.object.display_title || undefined,
      object_type_slug: card.object.object_type_data?.slug ?? '',
      body: card.object.body || undefined,
      captured_at: card.object.captured_at || undefined,
    }));
  }, [resurfaceData]);

  return (
    <div style={{ padding: '20px 18px', display: 'flex', flexDirection: 'column', gap: 0 }}>

      {(lastEdited || recentActivity.length > 0) && (
        <ResumeCards
          lastEdited={lastEdited}
          recentActivity={recentActivity}
          onOpenObject={onOpenObject}
        />
      )}

      {nodes && nodes.length > 0 && (
        <LineageSwimlane nodes={nodes.slice(0, 6)} lineageData={lineageData} onOpenObject={onOpenObject} />
      )}

      {/* Search + type filters */}
      <div style={{ marginBottom: 16 }}>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search objects..."
          style={{
            width: '100%',
            padding: '7px 11px',
            background: 'var(--cp-surface)',
            border: '1px solid var(--cp-border)',
            borderRadius: 4,
            fontFamily: 'var(--cp-font-mono)',
            fontSize: 11,
            color: 'var(--cp-text)',
            outline: 'none',
            marginBottom: 10,
            boxSizing: 'border-box',
          }}
        />
        {types.length > 1 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            <button
              type="button"
              onClick={() => setActiveType(null)}
              style={{
                fontFamily: 'var(--cp-font-mono)',
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                padding: '3px 8px',
                borderRadius: 3,
                border: '1px solid var(--cp-border)',
                background: activeType === null ? 'var(--cp-accent)' : 'transparent',
                color: activeType === null ? 'var(--cp-vellum)' : 'var(--cp-text-faint)',
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
                    fontFamily: 'var(--cp-font-mono)',
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    padding: '3px 8px',
                    borderRadius: 3,
                    border: `1px solid ${isActive ? identity.color : 'var(--cp-border)'}`,
                    background: isActive ? identity.color : 'transparent',
                    color: isActive ? '#fff' : 'var(--cp-text-faint)',
                    cursor: 'pointer',
                  }}
                >
                  {identity.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Loading / error states */}
      {loading && (
        <div
          style={{
            fontFamily: 'var(--cp-font-mono)',
            fontSize: 10,
            color: 'var(--cp-chrome-muted)',
            padding: '16px 0',
            textAlign: 'center',
            letterSpacing: '0.08em',
          }}
        >
          Loading...
        </div>
      )}

      {error && (
        <div
          style={{
            fontFamily: 'var(--cp-font-mono)',
            fontSize: 10,
            color: 'var(--cp-accent)',
            padding: '10px 12px',
            background: 'var(--cp-surface)',
            border: '1px solid var(--cp-border)',
            borderRadius: 4,
            marginBottom: 12,
          }}
        >
          {error.message}
        </div>
      )}

      {/* Cluster cards (unfiltered) or flat grid (filtered) */}
      {!loading && !error && nodes && (
        isFiltering ? (
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
                No objects match
              </div>
            ) : (
              filteredNodes.map((obj) => (
                <ObjectRenderer
                  key={obj.id}
                  object={obj}
                  onClick={onOpenObject ? (o) => onOpenObject(o.id) : undefined}
                  onContextMenu={(e, o) => openContextMenu(e.clientX, e.clientY, o)}
                />
              ))
            )}
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              gap: 10,
            }}
          >
            {(clustersData ?? []).map((cluster) => (
              <ClusterCard
                key={cluster.type}
                label={cluster.type}
                memberCount={cluster.count}
                members={cluster.members.map((m) => ({
                  id: m.id,
                  title: m.title,
                  object_type_slug: cluster.type,
                  body: m.body_preview || undefined,
                }))}
                onOpenObject={onOpenObject}
              />
            ))}
          </div>
        )
      )}

      {/* Resurface suggestions */}
      {resurfaceRenderables.length > 0 && !isFiltering && (
        <div style={{ marginTop: 24 }}>
          <div
            style={{
              fontFamily: 'var(--cp-font-mono)',
              fontSize: 9,
              fontWeight: 700,
              color: 'var(--cp-chrome-muted)',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              marginBottom: 8,
            }}
          >
            Resurface
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {resurfaceRenderables.map((obj) => (
              <ObjectRenderer
                key={obj.id}
                object={obj}
                compact
                onClick={onOpenObject ? (o) => onOpenObject(o.id) : undefined}
                onContextMenu={(e, o) => openContextMenu(e.clientX, e.clientY, o)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
