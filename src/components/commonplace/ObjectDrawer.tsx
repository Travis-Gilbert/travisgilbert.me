'use client';

import { useEffect, useState } from 'react';
import { Drawer } from 'vaul';
import * as Tabs from '@radix-ui/react-tabs';
import { useCommonPlace } from '@/lib/commonplace-context';
import { fetchObjectDetail, fetchObjectById } from '@/lib/commonplace-api';
import type { ApiObjectDetail, ApiEdgeCompact, ApiNodeListItem } from '@/lib/commonplace';
import HunchSketch from './HunchSketch';

/**
 * ObjectDrawer: Vaul slide-in drawer from the right for object detail.
 *
 * Mounted at layout level (parallel to CommandPalette) so it is available
 * from any view. Opens when context.drawerSlug changes to a non-null value.
 *
 * drawerSlug may be a URL slug (e.g. "my-source-abc") or a numeric string
 * (e.g. "42") when navigating via edge connections. The component routes to
 * fetchObjectDetail or fetchObjectById accordingly.
 *
 * Three tabs: Overview (body, source URL, components, tags, entity chips),
 * Connections (strength bars, reason text, tension section), and History
 * (immutable event timeline).
 */

/* ─────────────────────────────────────────────────
   Mini radial SVG (decorative, Connections tab)
   ───────────────────────────────────────────────── */

function MiniRadialSvg({ edgeCount, color }: { edgeCount: number; color: string }) {
  const count = Math.min(edgeCount, 8);
  const cx = 56;
  const cy = 56;
  const r = 38;

  return (
    <svg
      width={112}
      height={112}
      viewBox="0 0 112 112"
      aria-hidden="true"
      style={{ display: 'block' }}
    >
      {Array.from({ length: count }).map((_, i) => {
        const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
        const x = cx + Math.cos(angle) * r;
        const y = cy + Math.sin(angle) * r;
        return (
          <g key={i}>
            <line
              x1={cx} y1={cy} x2={x} y2={y}
              stroke={color}
              strokeWidth={1}
              strokeOpacity={0.3}
            />
            <circle cx={x} cy={y} r={4} fill={color} fillOpacity={0.2} />
          </g>
        );
      })}
      <circle cx={cx} cy={cy} r={8} fill={color} fillOpacity={0.65} />
    </svg>
  );
}

/* ─────────────────────────────────────────────────
   Edge strength: color encodes low/mid/high
   ───────────────────────────────────────────────── */

function strengthColor(strength: number): string {
  if (strength > 0.6) return '#2D5F6B';
  if (strength > 0.35) return '#C49A4A';
  return '#8A6A3A';
}

/* ─────────────────────────────────────────────────
   History: node type label and dot color
   ───────────────────────────────────────────────── */

function historyDotColor(nodeType: string, typeColor: string): string {
  if (nodeType === 'connection') return '#2D5F6B';
  if (nodeType === 'enrichment') return '#C49A4A';
  return typeColor;
}

function historyLabel(nodeType: string): string {
  const labels: Record<string, string> = {
    creation: 'Created',
    connection: 'Connected',
    enrichment: 'Enriched',
    annotation: 'Annotated',
    retrospective: 'Reflection added',
  };
  return labels[nodeType] ?? (nodeType.charAt(0).toUpperCase() + nodeType.slice(1));
}

/* ─────────────────────────────────────────────────
   Entity chip type detection from component_type_name
   ───────────────────────────────────────────────── */

type EntityChipKind = 'person' | 'place' | 'org' | 'other';

function detectEntityKind(name: string): EntityChipKind {
  const lower = name.toLowerCase();
  if (lower.includes('person') || lower.includes('people')) return 'person';
  if (lower.includes('place') || lower.includes('location') || lower.includes('geo')) return 'place';
  if (lower.includes('org') || lower.includes('company') || lower.includes('institution')) return 'org';
  return 'other';
}

function entityChipLabel(kind: EntityChipKind): string {
  if (kind === 'person') return 'PERSON';
  if (kind === 'place') return 'PLACE';
  if (kind === 'org') return 'ORG';
  return 'ENTITY';
}

/* ─────────────────────────────────────────────────
   Tag value parsing: handles JSON arrays or CSV
   ───────────────────────────────────────────────── */

function parseTags(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.map(String);
  } catch {
    // value is not JSON
  }
  return value.split(',').map((s) => s.trim()).filter(Boolean);
}

/* ─────────────────────────────────────────────────
   Date formatting for History tab
   ───────────────────────────────────────────────── */

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

/* ─────────────────────────────────────────────────
   Loading skeleton
   ───────────────────────────────────────────────── */

function DrawerSkeleton() {
  return (
    <div className="cp-drawer-skeleton">
      <div className="cp-drawer-skeleton-bar" style={{ width: '65%', height: 22, marginBottom: 8 }} />
      <div className="cp-drawer-skeleton-bar" style={{ width: '28%', height: 11, marginBottom: 24 }} />
      <div className="cp-drawer-skeleton-bar" style={{ width: '100%', height: 11, marginBottom: 6 }} />
      <div className="cp-drawer-skeleton-bar" style={{ width: '100%', height: 11, marginBottom: 6 }} />
      <div className="cp-drawer-skeleton-bar" style={{ width: '78%', height: 11, marginBottom: 20 }} />
      <div className="cp-drawer-skeleton-bar" style={{ width: '45%', height: 60, marginBottom: 0 }} />
    </div>
  );
}

/* ─────────────────────────────────────────────────
   Connection item
   ───────────────────────────────────────────────── */

function ConnectionItem({
  edge,
  onNavigate,
}: {
  edge: ApiEdgeCompact;
  onNavigate: (id: number) => void;
}) {
  return (
    <button
      type="button"
      className="cp-drawer-connection-item"
      onClick={() => onNavigate(edge.other_id)}
    >
      <div
        className="cp-drawer-strength-bar"
        style={{ backgroundColor: strengthColor(edge.strength) }}
        title={`Strength: ${Math.round(edge.strength * 100)}%`}
      />
      <div className="cp-drawer-connection-body">
        <div className="cp-drawer-connection-title">{edge.other_title}</div>
        {edge.reason && (
          <div className="cp-drawer-connection-reason">{edge.reason}</div>
        )}
        <div className="cp-drawer-connection-meta">
          {edge.edge_type && (
            <span className="cp-drawer-connection-type">{edge.edge_type}</span>
          )}
          <span className="cp-drawer-connection-strength">
            {Math.round(edge.strength * 100)}%
          </span>
          <span className="cp-drawer-connection-dir">
            {edge.direction === 'incoming' ? 'in' : 'out'}
          </span>
        </div>
      </div>
      <svg
        width={12}
        height={12}
        viewBox="0 0 12 12"
        fill="none"
        aria-hidden="true"
        className="cp-drawer-chevron"
      >
        <polyline
          points="4,1 9,6 4,11"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

/* ─────────────────────────────────────────────────
   History item
   ───────────────────────────────────────────────── */

function HistoryItem({
  node,
  typeColor,
}: {
  node: ApiNodeListItem;
  typeColor: string;
}) {
  const dotColor = historyDotColor(node.node_type, typeColor);
  const hasDetail = node.title && node.title !== node.object_title;

  return (
    <div className="cp-drawer-history-item">
      <div className="cp-drawer-history-dot" style={{ backgroundColor: dotColor }} />
      <div className="cp-drawer-history-body">
        <div className="cp-drawer-history-event">
          {historyLabel(node.node_type)}
          {hasDetail && (
            <span className="cp-drawer-history-detail"> {node.title}</span>
          )}
        </div>
        <div className="cp-drawer-history-time">{formatDate(node.occurred_at)}</div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────
   Main component
   ───────────────────────────────────────────────── */

export default function ObjectDrawer() {
  const { drawerSlug, closeDrawer, openDrawer } = useCommonPlace();

  const [detail, setDetail] = useState<ApiObjectDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    if (!drawerSlug) {
      setDetail(null);
      return;
    }

    setLoading(true);
    setError(null);
    setActiveTab('overview');

    // drawerSlug may be a URL slug or a numeric ID string (from edge navigation)
    const isNumeric = /^\d+$/.test(drawerSlug);
    const fetchFn = isNumeric
      ? () => fetchObjectById(parseInt(drawerSlug, 10))
      : () => fetchObjectDetail(drawerSlug);

    fetchFn()
      .then((data) => {
        setDetail(data);
        setLoading(false);
      })
      .catch((err: Error) => {
        setError(err.message);
        setLoading(false);
      });
  }, [drawerSlug]);

  // Navigate to a connected object by its numeric ID
  function navigateToObject(id: number) {
    openDrawer(String(id));
  }

  const typeColor = detail?.object_type_data?.color ?? '#8A7A6A';
  const typeName = detail?.object_type_data?.name ?? '';
  const displayTitle = detail?.display_title || detail?.title || '';

  // Classify components by type
  const ENTITY_KEYWORDS = ['person', 'people', 'place', 'location', 'org', 'company', 'entity', 'geo'];
  const isEntityComponent = (name: string) =>
    ENTITY_KEYWORDS.some((k) => name.toLowerCase().includes(k));

  const tagComponents = detail?.components.filter(
    (c) => c.key === 'tags' || c.component_type_name.toLowerCase() === 'tags',
  ) ?? [];

  const entityComponents = detail?.components.filter(
    (c) => isEntityComponent(c.component_type_name),
  ) ?? [];

  const regularComponents = detail?.components.filter(
    (c) =>
      c.key !== 'tags' &&
      c.component_type_name.toLowerCase() !== 'tags' &&
      !isEntityComponent(c.component_type_name),
  ) ?? [];

  // Tension edges: counter or contradiction semantics
  const tensionEdges = detail?.edges.filter(
    (e) =>
      e.edge_type?.toLowerCase().includes('counter') ||
      e.edge_type?.toLowerCase().includes('tension') ||
      e.reason?.toLowerCase().includes('contradict'),
  ) ?? [];

  const mainEdges = detail?.edges.filter(
    (e) =>
      !e.edge_type?.toLowerCase().includes('counter') &&
      !e.edge_type?.toLowerCase().includes('tension') &&
      !e.reason?.toLowerCase().includes('contradict'),
  ) ?? [];

  const isOpen = drawerSlug !== null;

  return (
    <Drawer.Root
      open={isOpen}
      onOpenChange={(open) => { if (!open) closeDrawer(); }}
      direction="right"
      noBodyStyles
    >
      <Drawer.Portal>
        <Drawer.Overlay className="cp-drawer-overlay" />
        <Drawer.Content
          className="cp-drawer-content"
          aria-describedby="cp-drawer-desc"
        >
          {/* Visually-hidden description for screen readers */}
          <Drawer.Description id="cp-drawer-desc" style={{ display: 'none' }}>
            Object detail for {displayTitle || 'loading'}
          </Drawer.Description>

          {/* Header */}
          <div className="cp-drawer-header">
            <div className="cp-drawer-header-text">
              <Drawer.Title className="cp-drawer-title">
                {displayTitle || (loading ? 'Loading...' : 'Object')}
              </Drawer.Title>
              {typeName && !loading && (
                <div
                  className="cp-drawer-type-badge"
                  style={{ color: typeColor, borderColor: `${typeColor}50` }}
                >
                  {typeName.toUpperCase()}
                </div>
              )}
            </div>
            <Drawer.Close
              className="cp-drawer-close"
              aria-label="Close"
              onClick={closeDrawer}
            >
              <svg
                width={15}
                height={15}
                viewBox="0 0 15 15"
                fill="none"
                aria-hidden="true"
              >
                <line
                  x1={2.5} y1={2.5} x2={12.5} y2={12.5}
                  stroke="currentColor"
                  strokeWidth={1.5}
                  strokeLinecap="round"
                />
                <line
                  x1={12.5} y1={2.5} x2={2.5} y2={12.5}
                  stroke="currentColor"
                  strokeWidth={1.5}
                  strokeLinecap="round"
                />
              </svg>
            </Drawer.Close>
          </div>

          {/* Content area */}
          <div className="cp-drawer-body-area">
            {loading && <DrawerSkeleton />}

            {error && !loading && (
              <div className="cp-drawer-error">
                <span className="cp-drawer-error-label">Could not load object</span>
                <span className="cp-drawer-error-detail">{error}</span>
              </div>
            )}

            {!loading && !error && detail && (
              <Tabs.Root
                value={activeTab}
                onValueChange={setActiveTab}
                className="cp-drawer-tabs"
              >
                <Tabs.List className="cp-drawer-tab-list">
                  <Tabs.Trigger value="overview" className="cp-drawer-tab">
                    Overview
                  </Tabs.Trigger>
                  <Tabs.Trigger value="connections" className="cp-drawer-tab">
                    Connections
                    {detail.edges.length > 0 && (
                      <span className="cp-drawer-tab-count">{detail.edges.length}</span>
                    )}
                  </Tabs.Trigger>
                  <Tabs.Trigger value="history" className="cp-drawer-tab">
                    History
                  </Tabs.Trigger>
                </Tabs.List>

                {/* ─── Overview ─── */}
                <Tabs.Content value="overview" className="cp-drawer-tab-content">
                  {detail.object_type_data?.slug === 'hunch' && (
                    <HunchSketch objectId={detail.id} components={detail.components} />
                  )}
                  {detail.body && (
                    <p className="cp-drawer-body-text">{detail.body}</p>
                  )}

                  {detail.url && (
                    <div className="cp-drawer-url-card">
                      <div className="cp-drawer-url-label">SOURCE</div>
                      <a
                        href={detail.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="cp-drawer-url-link"
                      >
                        {detail.url}
                      </a>
                      {(detail.og_title || detail.og_description) && (
                        <div className="cp-drawer-og-preview">
                          {detail.og_title && (
                            <div className="cp-drawer-og-title">{detail.og_title}</div>
                          )}
                          {detail.og_description && (
                            <div className="cp-drawer-og-desc">{detail.og_description}</div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {regularComponents.length > 0 && (
                    <div className="cp-drawer-components-grid">
                      {regularComponents.map((comp) => (
                        <div key={comp.id} className="cp-drawer-component-row">
                          <span className="cp-drawer-component-key">
                            {comp.key || comp.component_type_name}
                          </span>
                          <span className="cp-drawer-component-value">{comp.value}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {tagComponents.length > 0 && (
                    <div className="cp-drawer-tags-row">
                      {tagComponents
                        .flatMap((tc) => parseTags(tc.value))
                        .map((tag, i) => (
                          <span key={`${tag}-${i}`} className="cp-drawer-tag">
                            {tag}
                          </span>
                        ))}
                    </div>
                  )}

                  {entityComponents.length > 0 && (
                    <div className="cp-drawer-entity-row">
                      {entityComponents.map((ec) => {
                        const kind = detectEntityKind(ec.component_type_name);
                        return (
                          <span
                            key={ec.id}
                            className={`cp-drawer-entity-chip cp-drawer-entity-chip--${kind}`}
                          >
                            <span className="cp-drawer-entity-kind">
                              {entityChipLabel(kind)}
                            </span>
                            {ec.value}
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {!detail.body && !detail.url && regularComponents.length === 0 && (
                    <div className="cp-drawer-empty">No content captured yet</div>
                  )}
                </Tabs.Content>

                {/* ─── Connections ─── */}
                <Tabs.Content value="connections" className="cp-drawer-tab-content">
                  {detail.edges.length === 0 ? (
                    <div className="cp-drawer-empty">No connections yet</div>
                  ) : (
                    <>
                      <div className="cp-drawer-radial-wrap">
                        <MiniRadialSvg edgeCount={detail.edges.length} color={typeColor} />
                        <div className="cp-drawer-radial-count">
                          {detail.edges.length} connection{detail.edges.length !== 1 ? 's' : ''}
                        </div>
                      </div>

                      <div className="cp-drawer-connection-list">
                        {mainEdges.map((edge) => (
                          <ConnectionItem
                            key={edge.id}
                            edge={edge}
                            onNavigate={navigateToObject}
                          />
                        ))}
                      </div>

                      {tensionEdges.length > 0 && (
                        <div className="cp-drawer-tensions">
                          <div className="cp-drawer-tensions-header">TENSIONS</div>
                          <div className="cp-drawer-connection-list">
                            {tensionEdges.map((edge) => (
                              <ConnectionItem
                                key={`tension-${edge.id}`}
                                edge={edge}
                                onNavigate={navigateToObject}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </Tabs.Content>

                {/* ─── History ─── */}
                <Tabs.Content
                  value="history"
                  className="cp-drawer-tab-content cp-drawer-history-panel"
                >
                  <div className="cp-drawer-history-header">IMMUTABLE RECORD</div>
                  {detail.recent_nodes.length === 0 ? (
                    <div className="cp-drawer-empty">No history recorded</div>
                  ) : (
                    <div
                      className="cp-drawer-history-list"
                      style={{ borderLeftColor: typeColor }}
                    >
                      {detail.recent_nodes.map((node) => (
                        <HistoryItem
                          key={node.id}
                          node={node}
                          typeColor={typeColor}
                        />
                      ))}
                    </div>
                  )}
                </Tabs.Content>
              </Tabs.Root>
            )}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
