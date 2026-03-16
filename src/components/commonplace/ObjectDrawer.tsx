'use client';

import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import rough from 'roughjs';
import { Reorder } from 'framer-motion';
import { Drawer } from 'vaul';
import * as Tabs from '@radix-ui/react-tabs';
import { useCommonPlace } from '@/lib/commonplace-context';
import {
  fetchCanvasSuggestions,
  fetchObjectDetail,
  fetchObjectById,
  patchComponent,
  searchObjects,
} from '@/lib/commonplace-api';
import type {
  ApiObjectDetail,
  ApiEdgeCompact,
  ApiNodeListItem,
  ApiComponent,
  ApiCanvasSuggestion,
} from '@/lib/commonplace';
import type { TiptapUpdatePayload } from '@/components/studio/TiptapEditor';
import HunchSketch from './HunchSketch';
import ObjectTasks from './ObjectTasks';
import ReadingPane from './ReadingPane';

const CommonPlaceEditor = dynamic(() => import('./CommonPlaceEditor'), { ssr: false });

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
 * Four tabs: Overview (body, source URL, components, tags, entity chips),
 * Info (OG card, file sections, source connections), Connections (strength
 * bars, reason text, tension section), and History (immutable event timeline).
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
   Edge strength: color + width + dash encode tier
   ───────────────────────────────────────────────── */

function strengthStyle(strength: number): { color: string; width: number; dashed: boolean } {
  if (strength > 0.6) return { color: '#2D5F6B', width: 4, dashed: false };
  if (strength > 0.35) return { color: '#C49A4A', width: 3, dashed: false };
  return { color: '#8A6A3A', width: 2, dashed: true };
}

/* ─────────────────────────────────────────────────
   Manuscript rule: label left + rough.js line right
   ───────────────────────────────────────────────── */

function djb2Seed(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function ManuscriptRule({
  label,
  onNavigate,
}: {
  label?: string;
  onNavigate?: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper) return;

    let raf: number;

    function draw() {
      const rect = wrapper!.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const w = rect.width;
      const h = 8;
      if (w < 1) return;

      canvas!.width = Math.min(w * dpr, 8192);
      canvas!.height = h * dpr;
      canvas!.style.width = `${w}px`;
      canvas!.style.height = `${h}px`;

      const ctx = canvas!.getContext('2d');
      if (!ctx) return;
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, w, h);

      const rc = rough.canvas(canvas!);
      rc.line(0, h / 2, w, h / 2, {
        roughness: 0.8,
        strokeWidth: 0.5,
        stroke: 'rgba(196, 80, 60, 0.22)',
        bowing: 0.8,
        seed: djb2Seed(label || 'end-rule'),
      });
    }

    raf = requestAnimationFrame(draw);

    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(draw);
    });
    observer.observe(wrapper);

    return () => {
      observer.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [label]);

  return (
    <div className={`cp-manuscript-rule${label ? '' : ' cp-manuscript-rule--end'}`}>
      {label && (
        <button
          type="button"
          className="cp-manuscript-rule-label"
          onClick={onNavigate}
          title={`Open ${label}`}
        >
          {label}
        </button>
      )}
      <div ref={wrapperRef} style={{ flex: 1 }}>
        <canvas ref={canvasRef} aria-hidden="true" style={{ display: 'block' }} />
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────
   Section head: mono label + thin rule separator
   ───────────────────────────────────────────────── */

function SectionHead({ label }: { label: string }) {
  return (
    <div className="cp-drawer-section-head">
      <span className="cp-drawer-section-head-label">{label}</span>
      <span className="cp-drawer-section-head-rule" />
    </div>
  );
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
  const ss = strengthStyle(edge.strength);
  return (
    <button
      type="button"
      className="cp-drawer-connection-item"
      onClick={() => onNavigate(edge.other_id)}
    >
      <div
        className="cp-drawer-strength-bar"
        style={{
          backgroundColor: ss.dashed ? 'transparent' : ss.color,
          borderLeft: ss.dashed ? `${ss.width}px dashed ${ss.color}` : 'none',
          width: ss.dashed ? 0 : `${ss.width}px`,
          opacity: Math.max(0.35, edge.strength),
        }}
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
          <span
            className={`cp-drawer-connection-engine cp-drawer-connection-engine--${connectionTone(edge)}`}
          >
            {connectionLabel(edge)}
          </span>
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

function connectionTone(edge: ApiEdgeCompact): 'bridge' | 'manual' | 'tension' | 'support' | 'engine' {
  const engine = (edge.engine || '').toLowerCase();
  const edgeType = (edge.edge_type || '').toLowerCase();
  const reason = (edge.reason || '').toLowerCase();

  if (engine.includes('research_bridge')) return 'bridge';
  if (engine.includes('manual')) return 'manual';
  if (
    edgeType.includes('counter') ||
    edgeType.includes('tension') ||
    reason.includes('contradict')
  ) {
    return 'tension';
  }
  if (edgeType.includes('support') || reason.includes('support') || reason.includes('entail')) {
    return 'support';
  }
  return 'engine';
}

function connectionLabel(edge: ApiEdgeCompact): string {
  const tone = connectionTone(edge);
  if (tone === 'bridge') return 'Research bridge';
  if (tone === 'manual') return 'Manual';
  if (tone === 'tension') return 'Contradiction';
  if (tone === 'support') return 'Support';
  return edge.engine ? edge.engine.replace(/_/g, ' ') : 'Notebook engine';
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
   Info tab: item model + builder
   ───────────────────────────────────────────────── */

interface InfoItem {
  id: string;
  kind: 'og' | 'file-section' | 'connected-source';
  title: string;
  subtitle?: string;
  body?: string;
  url?: string;
  componentId?: number;
}

function stringifyInfoValue(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value == null) return '';
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function buildInfoItems(detail: ApiObjectDetail, connectedSources: ApiObjectDetail[]): InfoItem[] {
  const items: InfoItem[] = [];

  if (detail.url) {
    items.push({
      id: 'og-card',
      kind: 'og',
      title: detail.og_title || detail.url,
      subtitle: detail.og_description ?? undefined,
      body: [detail.og_title, detail.og_description].filter(Boolean).join('\n\n'),
      url: detail.url,
    });
  }

  const fileSectionComps = detail.components.filter(
    (c) => c.data_type === 'file' || c.key === 'extracted_sections',
  );
  for (const comp of fileSectionComps) {
    items.push({
      id: `comp-${comp.id}`,
      kind: 'file-section',
      title: comp.key || comp.component_type_name,
      body: stringifyInfoValue(comp.value),
      componentId: comp.id,
    });
  }

  for (const source of connectedSources) {
    const subtitle = source.og_description || source.url || undefined;
    const body = source.body || source.og_description || source.url || '';
    items.push({
      id: `source-${source.id}`,
      kind: 'connected-source',
      title: source.display_title || source.title,
      subtitle,
      body,
      url: source.url || undefined,
    });
  }

  return items;
}

/* ─────────────────────────────────────────────────
   DrawerTabBar: draggable horizontal tab strip
   ───────────────────────────────────────────────── */

const TAB_LABELS: Record<string, string> = {
  overview: 'Overview',
  info: 'Info',
  connections: 'Connections',
  model: 'Model',
  history: 'History',
};

const DEFAULT_TAB_ORDER = ['overview', 'info', 'connections', 'model', 'history'];

function modelHintForType(typeSlug: string | undefined): string | undefined {
  if (typeSlug === 'event') return 'timeline';
  if (typeSlug === 'place') return 'map';
  if (typeSlug === 'person' || typeSlug === 'organization') return 'comparison';
  return undefined;
}

function ModelSuggestionCard({ suggestion }: { suggestion: ApiCanvasSuggestion }) {
  const spec = JSON.stringify(suggestion.vega_lite_spec, null, 2);
  return (
    <div className="cp-model-card">
      <div className="cp-model-card-header">
        <div>
          <div className="cp-model-card-kicker">Vega-Lite spec</div>
          <div className="cp-model-card-title">{suggestion.name}</div>
        </div>
        <span className="cp-model-card-badge">backend</span>
      </div>
      <div className="cp-model-card-copy">{suggestion.description}</div>
      <pre className="cp-model-card-spec">{spec}</pre>
    </div>
  );
}

function DrawerTabBar({
  order,
  onReorder,
  counts,
}: {
  order: string[];
  onReorder: (newOrder: string[]) => void;
  counts: Record<string, number>;
}) {
  return (
    <Tabs.List asChild>
      <Reorder.Group
        as="div"
        axis="x"
        values={order}
        onReorder={onReorder}
        className="cp-drawer-tab-list"
      >
        {order.map((tabId) => (
          <Reorder.Item
            key={tabId}
            value={tabId}
            as="div"
            className="cp-drawer-tab-item"
            whileDrag={{ scale: 1.04, zIndex: 10 }}
          >
            <Tabs.Trigger value={tabId} className="cp-drawer-tab">
              {TAB_LABELS[tabId] ?? tabId}
              {(counts[tabId] ?? 0) > 0 && (
                <span className="cp-drawer-tab-count">{counts[tabId]}</span>
              )}
            </Tabs.Trigger>
          </Reorder.Item>
        ))}
      </Reorder.Group>
    </Tabs.List>
  );
}

/* ─────────────────────────────────────────────────
   Main component
   ───────────────────────────────────────────────── */

export default function ObjectDrawer() {
  const { drawerSlug, closeDrawer, openDrawer } = useCommonPlace();

  const [detail, setDetail] = useState<ApiObjectDetail | null>(null);
  const [liveComponents, setLiveComponents] = useState<ApiComponent[]>([]);
  const [connectedSources, setConnectedSources] = useState<ApiObjectDetail[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [activeInfoItem, setActiveInfoItem] = useState<InfoItem | null>(null);
  const [infoDraft, setInfoDraft] = useState('');
  const [savingInfo, setSavingInfo] = useState(false);
  const [infoSaveError, setInfoSaveError] = useState<string | null>(null);
  const [tabOrder, setTabOrder] = useState<string[]>(DEFAULT_TAB_ORDER);
  const [modelSuggestions, setModelSuggestions] = useState<ApiCanvasSuggestion[]>([]);
  const [modelLoading, setModelLoading] = useState(false);
  const [modelError, setModelError] = useState<string | null>(null);

  useEffect(() => {
    if (!drawerSlug) {
      setDetail(null);
      return;
    }

    setLoading(true);
    setError(null);
    setActiveTab('overview');
    setActiveInfoItem(null);
    setInfoDraft('');
    setInfoSaveError(null);
    setLiveComponents([]);
    setConnectedSources([]);
    setModelSuggestions([]);
    setModelError(null);

    // drawerSlug may be a URL slug or a numeric ID string (from edge navigation)
    const isNumeric = /^\d+$/.test(drawerSlug);
    const fetchFn = isNumeric
      ? () => fetchObjectById(parseInt(drawerSlug, 10))
      : () => fetchObjectDetail(drawerSlug);

    fetchFn()
      .then((data) => {
        setDetail(data);
        setLiveComponents(data.components);
        // Smart tab: open to Info for URL-based objects with no body text
        const hasBody = Boolean(data.body?.trim());
        const hasInfoContent = Boolean(data.url) || data.components.some(
          (c: ApiComponent) => c.data_type === 'file' || c.key === 'extracted_sections',
        );
        if (!hasBody && hasInfoContent) {
          setActiveTab('info');
        }
        setLoading(false);
      })
      .catch((err: Error) => {
        setError(err.message);
        setLoading(false);
      });
  }, [drawerSlug]);

  useEffect(() => {
    if (!detail) {
      setConnectedSources([]);
      return;
    }

    const ids = Array.from(new Set(detail.edges.map((edge) => edge.other_id)));
    if (ids.length === 0) {
      setConnectedSources([]);
      return;
    }

    let cancelled = false;
    Promise.all(
      ids.map((id) => fetchObjectById(id).catch(() => null)),
    ).then((objects) => {
      if (cancelled) return;
      const sources = objects.filter((obj): obj is ApiObjectDetail => (
        obj !== null && obj.object_type_data?.slug === 'source'
      ));
      setConnectedSources(sources);
    });

    return () => {
      cancelled = true;
    };
  }, [detail]);

  useEffect(() => {
    if (!activeInfoItem) return;
    setInfoDraft(activeInfoItem.body ?? '');
    setInfoSaveError(null);
  }, [activeInfoItem]);

  useEffect(() => {
    if (!detail || activeTab !== 'model') return;

    let cancelled = false;
    setModelLoading(true);
    setModelError(null);

    fetchCanvasSuggestions(
      [detail.id],
      modelHintForType(detail.object_type_data?.slug),
    )
      .then((suggestions) => {
        if (cancelled) return;
        setModelSuggestions(suggestions);
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setModelError(err.message || 'Could not load model suggestions.');
      })
      .finally(() => {
        if (!cancelled) setModelLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [detail, activeTab]);

  // Navigate to a connected object by its numeric ID
  function navigateToObject(id: number) {
    openDrawer(String(id));
  }

  async function navigateToEntity(entityValue: string) {
    const q = entityValue.trim();
    if (!q) return;
    try {
      const results = await searchObjects(q, 6);
      if (results.length === 0) return;
      const normalized = q.toLowerCase();
      const bestMatch = results.find(
        (result) =>
          result.title.toLowerCase() === normalized ||
          result.display_title.toLowerCase() === normalized,
      ) ?? results[0];
      if (bestMatch) openDrawer(bestMatch.slug);
    } catch {
      // Silent: chip navigation is best effort only.
    }
  }

  const typeColor = detail?.object_type_data?.color ?? '#8A7A6A';
  const typeName = detail?.object_type_data?.name ?? '';
  const displayTitle = detail?.display_title || detail?.title || '';

  // Classify components by type (uses liveComponents for optimistic updates)
  const ENTITY_KEYWORDS = ['person', 'people', 'place', 'location', 'org', 'company', 'entity', 'geo'];
  const isEntityComponent = (name: string) =>
    ENTITY_KEYWORDS.some((k) => name.toLowerCase().includes(k));
  const isTaskComponent = (c: ApiComponent) =>
    c.component_type_name.toLowerCase() === 'task' ||
    (c.component_type_name.toLowerCase() === 'status' && (c.key || '').toLowerCase().startsWith('task')) ||
    (c.key || '').toLowerCase() === 'task' ||
    (c.key || '').toLowerCase().startsWith('task-');

  const tagComponents = liveComponents.filter(
    (c) => c.key === 'tags' || c.component_type_name.toLowerCase() === 'tags',
  );

  const entityComponents = liveComponents.filter(
    (c) => isEntityComponent(c.component_type_name),
  );

  const regularComponents = liveComponents.filter(
    (c) =>
      c.key !== 'tags' &&
      c.component_type_name.toLowerCase() !== 'tags' &&
      !isEntityComponent(c.component_type_name) &&
      !isTaskComponent(c),
  );

  const infoItems = useMemo(
    () => (detail ? buildInfoItems({ ...detail, components: liveComponents }, connectedSources) : []),
    [detail, liveComponents, connectedSources],
  );

  /* ── Manuscript: split body into paragraphs, match connections ── */
  const manuscriptParagraphs = useMemo(() => {
    if (!detail?.body) return [];
    return detail.body
      .split(/\n\n+/)
      .map((text) => text.trim())
      .filter((text) => text.length > 0);
  }, [detail?.body]);

  const manuscriptRules = useMemo(() => {
    if (!detail?.edges || manuscriptParagraphs.length === 0) return new Map<number, ApiEdgeCompact>();

    // Map: paragraph index -> first matched edge (each edge placed once)
    const placed = new Map<number, ApiEdgeCompact>();
    const usedEdgeIds = new Set<number>();

    for (let pIdx = 0; pIdx < manuscriptParagraphs.length; pIdx++) {
      const paraLower = manuscriptParagraphs[pIdx].toLowerCase();
      for (const edge of detail.edges) {
        if (usedEdgeIds.has(edge.id)) continue;
        const titleWords = edge.other_title.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
        const hasMatch = titleWords.some((word) => paraLower.includes(word));
        if (hasMatch) {
          placed.set(pIdx, edge);
          usedEdgeIds.add(edge.id);
          break;
        }
      }
    }

    return placed;
  }, [detail?.edges, manuscriptParagraphs]);

  async function saveInfoItemEdits() {
    if (!activeInfoItem?.componentId) return;
    setSavingInfo(true);
    setInfoSaveError(null);
    try {
      await patchComponent(activeInfoItem.componentId, { value: infoDraft });
      setLiveComponents((prev) => prev.map((comp) => (
        comp.id === activeInfoItem.componentId
          ? { ...comp, value: infoDraft }
          : comp
      )));
      setActiveInfoItem((prev) => (prev ? { ...prev, body: infoDraft } : prev));
    } catch (err) {
      setInfoSaveError(err instanceof Error ? err.message : 'Could not save changes.');
    } finally {
      setSavingInfo(false);
    }
  }

  const tensionEdges = detail?.edges.filter((edge) => connectionTone(edge) === 'tension') ?? [];
  const bridgeEdges = detail?.edges.filter((edge) => connectionTone(edge) === 'bridge') ?? [];
  const manualEdges = detail?.edges.filter((edge) => connectionTone(edge) === 'manual') ?? [];
  const supportEdges = detail?.edges.filter((edge) => connectionTone(edge) === 'support') ?? [];
  const notebookEdges = detail?.edges.filter((edge) => connectionTone(edge) === 'engine') ?? [];

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

          {/* Rough.js divider between header and body */}
          <div className="cp-drawer-header-rule">
            <ManuscriptRule />
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
                <DrawerTabBar
                  order={tabOrder}
                  onReorder={setTabOrder}
                  counts={{
                    info: infoItems.length,
                    connections: detail.edges.length,
                    model: modelSuggestions.length,
                  }}
                />

                {/* ─── Overview ─── */}
                <Tabs.Content value="overview" className="cp-drawer-tab-content">
                  {detail.object_type_data?.slug === 'hunch' && (
                    <HunchSketch objectId={detail.id} components={detail.components} />
                  )}

                  <ReadingPane
                    detail={detail}
                    onEntityClick={(text) => navigateToEntity(text)}
                  />

                  <ObjectTasks
                    objectId={detail.id}
                    components={liveComponents}
                    onComponentsChange={setLiveComponents}
                  />

                  {!detail.body && !detail.url && detail.components.length === 0 &&
                    !liveComponents.some(isTaskComponent) && (
                    <div className="cp-drawer-empty">No content captured yet</div>
                  )}
                </Tabs.Content>

                {/* ─── Info ─── */}
                <Tabs.Content value="info" className="cp-drawer-tab-content">
                  {infoItems.length === 0 ? (
                    <div className="cp-drawer-empty">No metadata or linked files</div>
                  ) : activeInfoItem === null ? (
                    <div className="cp-info-grid">
                      {infoItems.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          className="cp-info-thumbnail"
                          onClick={() => setActiveInfoItem(item)}
                        >
                          <span className="cp-info-thumbnail-kind">{item.kind}</span>
                          <span className="cp-info-thumbnail-title">{item.title}</span>
                          {item.subtitle && (
                            <span className="cp-info-thumbnail-subtitle">{item.subtitle}</span>
                          )}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="cp-info-content">
                      <button
                        type="button"
                        className="cp-info-back"
                        onClick={() => setActiveInfoItem(null)}
                      >
                        <svg width={10} height={10} viewBox="0 0 10 10" fill="none" aria-hidden="true">
                          <polyline
                            points="7,1 3,5 7,9"
                            stroke="currentColor"
                            strokeWidth={1.5}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                        Back
                      </button>
                      <div className="cp-info-content-title">{activeInfoItem.title}</div>
                      {activeInfoItem.url && (
                        <a
                          href={activeInfoItem.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="cp-info-content-link"
                        >
                          {activeInfoItem.url}
                        </a>
                      )}
                      {activeInfoItem.kind === 'file-section' ? (
                        <>
                          <div className="cp-info-editor">
                            <CommonPlaceEditor
                              key={activeInfoItem.id}
                              initialContent={activeInfoItem.body ?? ''}
                              initialContentFormat="markdown"
                              onUpdate={(payload: TiptapUpdatePayload) => {
                                const next = payload.markdown || payload.html || '';
                                setInfoDraft(next);
                              }}
                              placeholder="No extracted content yet."
                            />
                          </div>
                          <div className="cp-info-actions">
                            {infoSaveError && (
                              <span className="cp-info-save-error">{infoSaveError}</span>
                            )}
                            <button
                              type="button"
                              className="cp-info-save-btn"
                              onClick={saveInfoItemEdits}
                              disabled={savingInfo}
                            >
                              {savingInfo ? 'Saving...' : 'Save changes'}
                            </button>
                          </div>
                        </>
                      ) : (
                        activeInfoItem.body && (
                          <div className="cp-info-content-body">{activeInfoItem.body}</div>
                        )
                      )}
                    </div>
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

                      {notebookEdges.length > 0 && (
                        <div className="cp-drawer-connection-group">
                          <SectionHead label="Engine" />
                          <div className="cp-drawer-connection-list">
                            {notebookEdges.map((edge) => (
                              <ConnectionItem
                                key={`engine-${edge.id}`}
                                edge={edge}
                                onNavigate={navigateToObject}
                              />
                            ))}
                          </div>
                        </div>
                      )}

                      {supportEdges.length > 0 && (
                        <div className="cp-drawer-connection-group">
                          <SectionHead label="Support" />
                          <div className="cp-drawer-connection-list">
                            {supportEdges.map((edge) => (
                              <ConnectionItem
                                key={`support-${edge.id}`}
                                edge={edge}
                                onNavigate={navigateToObject}
                              />
                            ))}
                          </div>
                        </div>
                      )}

                      {bridgeEdges.length > 0 && (
                        <div className="cp-drawer-connection-group">
                          <SectionHead label="Bridge" />
                          <div className="cp-drawer-connection-list">
                            {bridgeEdges.map((edge) => (
                              <ConnectionItem
                                key={`bridge-${edge.id}`}
                                edge={edge}
                                onNavigate={navigateToObject}
                              />
                            ))}
                          </div>
                        </div>
                      )}

                      {manualEdges.length > 0 && (
                        <div className="cp-drawer-connection-group">
                          <SectionHead label="Manual" />
                          <div className="cp-drawer-connection-list">
                            {manualEdges.map((edge) => (
                              <ConnectionItem
                                key={`manual-${edge.id}`}
                                edge={edge}
                                onNavigate={navigateToObject}
                              />
                            ))}
                          </div>
                        </div>
                      )}

                      {tensionEdges.length > 0 && (
                        <div className="cp-drawer-tensions">
                          <SectionHead label="Tensions" />
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

                {/* ─── Model ─── */}
                <Tabs.Content value="model" className="cp-drawer-tab-content">
                  <div className="cp-model-panel-copy">
                    Backend visualization suggestions for the selected object.
                  </div>
                  {modelLoading ? (
                    <div className="cp-drawer-empty">Loading model suggestions...</div>
                  ) : modelError ? (
                    <div className="cp-drawer-error">
                      <span className="cp-drawer-error-label">Model unavailable</span>
                      <span className="cp-drawer-error-detail">{modelError}</span>
                    </div>
                  ) : modelSuggestions.length === 0 ? (
                    <div className="cp-drawer-empty">No model suggestions for this object.</div>
                  ) : (
                    <div className="cp-model-grid">
                      {modelSuggestions.map((suggestion) => (
                        <ModelSuggestionCard key={suggestion.id} suggestion={suggestion} />
                      ))}
                    </div>
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
