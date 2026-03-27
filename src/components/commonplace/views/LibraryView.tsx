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
import { getObjectTypeIdentity, type ClusterResponse } from '@/lib/commonplace';
import { useLayout } from '@/lib/providers/layout-provider';
import { useCapture } from '@/lib/providers/capture-provider';
import { useDrawer } from '@/lib/providers/drawer-provider';
import ObjectRenderer, { type RenderableObject } from '../objects/ObjectRenderer';
import InquirySuggestions from '../capture/InquirySuggestions';
import {
  renderableFromClusterMember,
  renderableFromMockNode,
} from '../objectRenderables';
import { useRenderableObjectAction } from '../useRenderableObjectAction';

import SearchHero from './library/SearchHero';
import ResumeZone from './library/ResumeZone';
import ResurfacedZone from './library/ResurfacedZone';
import ThreadChain from './library/ThreadChain';
import LibraryTypeFilters from './library/LibraryTypeFilters';
import ClusterSection from './library/ClusterSection';

interface LibraryViewProps {
  paneId?: string;
  onOpenObject?: (objectRef: number) => void;
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

export default function LibraryView({ onOpenObject }: LibraryViewProps) {
  const prefersReducedMotion = useReducedMotion();
  const { launchView } = useLayout();
  const { captureVersion } = useCapture();
  const { openContextMenu } = useDrawer();
  const [activeType, setActiveType] = useState<string | null>(null);
  const [inquiryQuery, setInquiryQuery] = useState('');

  /* ── Data fetching ── */

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

  /* ── Derived data ── */

  const feedNodes = nodes && nodes.length > 0 ? nodes : null;
  const clusterItems = clustersData && clustersData.length > 0 ? clustersData : null;
  const isOffline = Boolean(error) || !nodes || nodes.length === 0;

  const allObjects = useMemo<RenderableObject[]>(
    () => (feedNodes ?? []).map(renderableFromMockNode),
    [feedNodes],
  );

  const types = useMemo(
    () => Array.from(new Set((feedNodes ?? []).map((node) => node.objectType))).sort(),
    [feedNodes],
  );

  const filteredNodes = useMemo(() => {
    if (!activeType) return allObjects;
    return allObjects.filter((node) => node.object_type_slug === activeType);
  }, [activeType, allObjects]);

  const isFiltering = activeType !== null;
  const lastEdited = allObjects[0] ?? null;
  const recentActivity = allObjects.slice(1, 4);

  // Build objectId -> type slug map from graph data for cluster type dots
  const objectTypeMap = useMemo(() => {
    const map = new Map<number, string>();
    if (graphData?.nodes) {
      for (const gn of graphData.nodes) {
        if (gn.objectRef) {
          map.set(gn.objectRef, gn.objectType);
        }
      }
    }
    return map;
  }, [graphData]);

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

  /* ── Render ── */

  return (
    <div style={{ flex: 1, overflow: 'auto' }}>
      <div className="cp-pane-content-inner">
        <SearchHero
          onOpenObject={onOpenObject}
          inquiryQuery={inquiryQuery}
          onQueryConsumed={() => setInquiryQuery('')}
        />
        <InquirySuggestions onSelectQuery={setInquiryQuery} />

        {isOffline && (
          <div className="cp-offline-banner">
            Offline. Start the notebook API to see live data.
          </div>
        )}

        <ResumeZone
          lastEdited={lastEdited}
          recentActivity={recentActivity}
          onOpenObject={onOpenObject}
        />

        <ResurfacedZone
          cards={resurfaceData?.cards}
          onOpenObject={onOpenObject}
        />

        <ThreadChain
          nodes={feedNodes ?? undefined}
          lineageData={lineageData}
          onOpenObject={onOpenObject}
        />

        <LibraryTypeFilters
          types={types}
          active={activeType}
          onFilter={setActiveType}
        />

        {isFiltering ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filteredNodes.length === 0 ? (
              <div className="cp-empty-state">
                No objects match the current filter.
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
            <ClusterSection
              clusters={clusterItems ?? undefined}
              graphData={graphData}
              objectTypeMap={objectTypeMap}
              onOpenObject={onOpenObject}
            />

            {reminderProjects.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <div style={{ marginBottom: 8, display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span style={{
                    fontFamily: 'var(--cp-font-mono)',
                    fontSize: 9,
                    fontWeight: 600,
                    letterSpacing: '0.7px',
                    textTransform: 'uppercase' as const,
                    color: 'rgba(26, 24, 22, 0.28)',
                  }}>
                    Reminders
                  </span>
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
