'use client';

/**
 * NotebookWorkspace: full research environment for a notebook.
 *
 * Replaces the old NotebookView with a 5-tab workspace:
 *   Objects (drop zone + grid), Graph (scoped force graph),
 *   Timeline (scoped feed), Tuning (intensity sliders + modules),
 *   Sharing (visibility + link).
 *
 * Identity banner shows notebook icon, title, description, and
 * health stats. Collapses to a 40px toolbar on scroll via
 * IntersectionObserver (Task 18).
 */

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import {
  fetchNotebookBySlug,
  fetchNotebookHealth,
  fetchGraph,
  fetchFeed,
  batchAddObjects,
  patchEngineConfig,
  patchNotebook,
  useApiData,
} from '@/lib/commonplace-api';
import type {
  ApiNotebookDetail,
  ApiNotebookHealth,
  ApiGraphResponse,
  GraphNode,
  GraphLink,
} from '@/lib/commonplace';
import { OBJECT_TYPES, getObjectTypeIdentity } from '@/lib/commonplace';
import {
  INTENSITY_LABELS,
  mapIntensityToConfig,
  configToIntensity,
  ENGINE_PASSES,
  POST_PASSES,
  NOTEBOOK_MODULES,
  getNotebookAbbrev,
} from '@/lib/commonplace-notebook';
import ViewSubTabs from '../panes/ViewSubTabs';
import ScopedTimelinePanel from './ScopedTimelinePanel';

/* Lazy-load KnowledgeMap (canvas component, heavy) */
const LazyKnowledgeMap = dynamic(() => import('./KnowledgeMap'), {
  ssr: false,
  loading: () => (
    <div className="cp-loading-skeleton" style={{ width: '100%', height: 300, borderRadius: 8 }} />
  ),
});

/* ────────────────────────────────────────────────────
   Tab configuration
   ──────────────────────────────────────────────────── */

const TABS = [
  { key: 'objects', label: 'Objects' },
  { key: 'graph', label: 'Graph' },
  { key: 'timeline', label: 'Timeline' },
  { key: 'tuning', label: 'Tuning' },
  { key: 'sharing', label: 'Sharing' },
];

/* ────────────────────────────────────────────────────
   Props
   ──────────────────────────────────────────────────── */

interface NotebookWorkspaceProps {
  slug: string;
  onOpenObject?: (objectRef: number, title?: string) => void;
}

/* ────────────────────────────────────────────────────
   Component
   ──────────────────────────────────────────────────── */

export default function NotebookWorkspace({ slug, onOpenObject }: NotebookWorkspaceProps) {
  const { data: notebook, loading, error, refetch } = useApiData(
    () => fetchNotebookBySlug(slug),
    [slug],
  );
  const { data: health } = useApiData(
    () => fetchNotebookHealth(slug),
    [slug],
  );

  const [activeTab, setActiveTab] = useState('objects');
  const [bannerCollapsed, setBannerCollapsed] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const bannerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  /* ── Banner scroll collapse (IntersectionObserver) ── */
  useEffect(() => {
    const bannerEl = bannerRef.current;
    if (!bannerEl) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        setBannerCollapsed(entry.intersectionRatio < 0.1);
      },
      { threshold: [0, 0.1, 0.8] },
    );
    observer.observe(bannerEl);
    return () => observer.disconnect();
  }, [notebook]);

  /* ── Full-surface drop overlay ── */
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    // Only hide when leaving the outermost container
    if (e.currentTarget === e.target || !e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOver(false);
    }
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (!notebook) return;

      const raw = e.dataTransfer.getData('application/commonplace-object');
      if (!raw) return;

      try {
        const data = JSON.parse(raw);
        const ids: number[] = data.type === 'cluster'
          ? data.member_pks
          : [data.id ?? data.object_id];
        if (ids.length > 0) {
          await batchAddObjects(slug, ids);
          refetch();
        }
      } catch {
        // Invalid drag data, ignore
      }
    },
    [notebook, slug, refetch],
  );

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="cp-nb-workspace cp-scrollbar">
        <div className="cp-nb-banner">
          <div className="cp-loading-skeleton" style={{ width: 40, height: 40, borderRadius: '50%' }} />
          <div style={{ flex: 1 }}>
            <div className="cp-loading-skeleton" style={{ width: 200, height: 22, marginBottom: 8 }} />
            <div className="cp-loading-skeleton" style={{ width: 300, height: 14 }} />
          </div>
        </div>
        <div className="cp-view-sub-tabs">
          {TABS.map((t) => (
            <div key={t.key} className="cp-loading-skeleton" style={{ width: 60, height: 28, borderRadius: 4 }} />
          ))}
        </div>
        <div style={{ padding: 16 }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="cp-loading-skeleton" style={{ width: '100%', height: 60, borderRadius: 8, marginBottom: 12 }} />
          ))}
        </div>
      </div>
    );
  }

  /* ── Error ── */
  if (error || !notebook) {
    return (
      <div className="cp-nb-workspace">
        <div className="cp-error-banner" style={{ margin: 16 }}>
          <p>
            {error?.isNetworkError
              ? 'Could not reach CommonPlace API.'
              : `Error: ${error?.message ?? 'Notebook not found'}`}
          </p>
          <button type="button" onClick={refetch}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="cp-nb-workspace cp-scrollbar"
      ref={scrollRef}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* ── Collapsed toolbar (sticky, shown when banner scrolled out) ── */}
      {bannerCollapsed && (
        <div className="cp-nb-toolbar">
          <span className="cp-nb-toolbar-pip" style={{ backgroundColor: notebook.color || '#8B6FA0' }} />
          <span className="cp-nb-toolbar-name">{notebook.name}</span>
          <span className="cp-nb-toolbar-stats">
            {health?.object_count ?? '...'} obj
            {' · '}
            {health?.edge_count ?? '...'} edges
            {' · '}
            {health?.density != null ? (health.density * 100).toFixed(1) + '%' : '...'}
          </span>
          <button
            type="button"
            className="cp-nb-toolbar-expand"
            onClick={() => scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
            aria-label="Expand banner"
          >
            ↑
          </button>
        </div>
      )}

      {/* ── Identity banner ── */}
      <div ref={bannerRef} className="cp-nb-banner">
        <div
          className="cp-nb-icon"
          style={{ backgroundColor: notebook.color || '#8B6FA0' }}
        >
          {getNotebookAbbrev(notebook.name)}
        </div>
        <div className="cp-nb-banner-text">
          <h2 className="cp-nb-title">{notebook.name}</h2>
          {notebook.description && (
            <p className="cp-nb-description">{notebook.description}</p>
          )}
          <div className="cp-nb-stats">
            <Stat label="objects" value={health?.object_count} />
            <Stat label="edges" value={health?.edge_count} />
            <Stat label="density" value={health?.density != null ? (health.density * 100).toFixed(1) + '%' : null} />
            <Stat label="clusters" value={health?.cluster_count} />
          </div>
        </div>
      </div>

      {/* ── Tab bar (sticky below toolbar) ── */}
      <ViewSubTabs tabs={TABS} active={activeTab} onChange={setActiveTab} />

      {/* ── Tab content ── */}
      <div className="cp-nb-tab-content">
        {activeTab === 'objects' && (
          <ObjectsTab notebook={notebook} slug={slug} onOpenObject={onOpenObject} />
        )}
        {activeTab === 'graph' && (
          <GraphTab slug={slug} onOpenObject={onOpenObject} />
        )}
        {activeTab === 'timeline' && (
          <ScopedTimelinePanel
            notebook={slug}
            onOpenObject={onOpenObject ? (ref) => onOpenObject(ref) : undefined}
          />
        )}
        {activeTab === 'tuning' && (
          <TuningTab notebook={notebook} slug={slug} onConfigChange={refetch} />
        )}
        {activeTab === 'sharing' && (
          <SharingTab notebook={notebook} slug={slug} />
        )}
      </div>

      {/* ── Full-surface drop overlay ── */}
      {dragOver && (
        <div className="cp-nb-drop-overlay">
          <span className="cp-nb-drop-overlay-text">
            Drop to add to {notebook.name}
          </span>
        </div>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────
   Stat pill (used in banner)
   ──────────────────────────────────────────────────── */

function Stat({ label, value }: { label: string; value: number | string | null | undefined }) {
  return (
    <div className="cp-nb-stat">
      <span className="cp-nb-stat-value">{value ?? '...'}</span>
      <span className="cp-nb-stat-label">{label}</span>
    </div>
  );
}

/* ────────────────────────────────────────────────────
   Objects tab
   ──────────────────────────────────────────────────── */

type ObjectSortKey = 'recent' | 'connected' | 'alpha';

function ObjectsTab({
  notebook,
  slug,
  onOpenObject,
}: {
  notebook: ApiNotebookDetail;
  slug: string;
  onOpenObject?: (objectRef: number, title?: string) => void;
}) {
  const [sortBy, setSortBy] = useState<ObjectSortKey>('recent');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [stripDragOver, setStripDragOver] = useState(false);

  const allTypes = useMemo(() => {
    const types = new Set(notebook.objects.map((o) => o.object_type));
    return Array.from(types).sort();
  }, [notebook.objects]);

  const sortedObjects = useMemo(() => {
    let list = [...notebook.objects];

    // Filter by type
    if (typeFilter !== 'all') {
      list = list.filter((o) => o.object_type === typeFilter);
    }

    // Sort
    switch (sortBy) {
      case 'connected':
        list.sort((a, b) => ((b as ObjectWithConnections).connection_count ?? 0) - ((a as ObjectWithConnections).connection_count ?? 0));
        break;
      case 'alpha':
        list.sort((a, b) => a.title.localeCompare(b.title));
        break;
      default: // 'recent': keep API order (already sorted by recency)
        break;
    }
    return list;
  }, [notebook.objects, sortBy, typeFilter]);

  return (
    <div>
      {/* Sort and filter controls */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 0',
        flexWrap: 'wrap',
      }}>
        {/* Sort */}
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as ObjectSortKey)}
          style={selectStyle}
        >
          <option value="recent">Recent</option>
          <option value="connected">Most connected</option>
          <option value="alpha">Alphabetical</option>
        </select>

        {/* Type filter */}
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          style={selectStyle}
        >
          <option value="all">All types</option>
          {allTypes.map((t) => (
            <option key={t} value={t}>{getObjectTypeIdentity(t).label}</option>
          ))}
        </select>
      </div>

      {/* Inline drop strip */}
      <div
        onDragOver={(e) => { e.preventDefault(); setStripDragOver(true); }}
        onDragLeave={() => setStripDragOver(false)}
        onDrop={() => setStripDragOver(false)}
        style={{
          height: stripDragOver ? 80 : 40,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '1px dashed var(--cp-border)',
          borderRadius: 6,
          color: 'var(--cp-text-faint)',
          fontSize: 11,
          fontFamily: 'var(--cp-font-mono)',
          background: stripDragOver
            ? 'color-mix(in srgb, var(--cp-teal) 8%, var(--cp-surface))'
            : 'transparent',
          transition: 'height 200ms cubic-bezier(0.34, 1.56, 0.64, 1), background-color 200ms',
          marginBottom: 8,
        }}
      >
        Drop objects here to add to {notebook.name}
      </div>

      {/* Object rows */}
      {sortedObjects.length === 0 ? (
        <div className="cp-empty-state">
          No objects in this collection yet.
          <span className="cp-empty-state-hint">
            Drag objects here or capture with this notebook selected.
          </span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {sortedObjects.map((obj) => {
            const typeId = getObjectTypeIdentity(obj.object_type);
            const connCount = (obj as ObjectWithConnections).connection_count;
            return (
              <button
                key={obj.id}
                type="button"
                onClick={() => onOpenObject?.(obj.id, obj.title)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  width: '100%',
                  padding: '8px 12px',
                  background: 'none',
                  border: 'none',
                  borderRadius: 4,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background-color 100ms',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--cp-surface-hover)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'none'; }}
              >
                {/* Type dot */}
                <span style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: typeId.color,
                  flexShrink: 0,
                }} />

                {/* Title */}
                <span style={{
                  flex: 1,
                  minWidth: 0,
                  fontSize: 13,
                  color: 'var(--cp-text)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap' as const,
                }}>
                  {obj.title}
                </span>

                {/* Connection count */}
                {connCount != null && connCount > 0 && (
                  <span style={{
                    fontSize: 10,
                    fontFamily: 'var(--cp-font-mono)',
                    color: 'var(--cp-text-faint)',
                    flexShrink: 0,
                  }}>
                    {connCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Extended object type with optional connection_count from API. */
interface ObjectWithConnections {
  id: number;
  title: string;
  object_type: string;
  connection_count?: number;
}

const selectStyle: React.CSSProperties = {
  padding: '4px 8px',
  fontSize: 11,
  fontFamily: 'var(--cp-font-mono)',
  color: 'var(--cp-text-muted)',
  background: 'var(--cp-surface)',
  border: '1px solid var(--cp-border)',
  borderRadius: 4,
  cursor: 'pointer',
  outline: 'none',
};

/* ────────────────────────────────────────────────────
   Graph tab (scoped KnowledgeMap)
   ──────────────────────────────────────────────────── */

function GraphTab({
  slug,
  onOpenObject,
}: {
  slug: string;
  onOpenObject?: (objectRef: number, title?: string) => void;
}) {
  const { data: graphData, loading, error } = useApiData(
    () => fetchGraph({ notebook: slug }),
    [slug],
  );

  if (loading) {
    return <div className="cp-loading-skeleton" style={{ width: '100%', height: 300, borderRadius: 8 }} />;
  }

  if (error) {
    return (
      <div className="cp-empty-state">
        Could not load graph data.
      </div>
    );
  }

  if (!graphData || graphData.nodes.length === 0) {
    return (
      <div className="cp-empty-state">
        Run the connection engine to see relationships between objects.
      </div>
    );
  }

  return (
    <div style={{ height: 400 }}>
      <LazyKnowledgeMap
        graphNodes={graphData.nodes}
        graphLinks={graphData.links}
        onOpenObject={
          onOpenObject
            ? (objectId: string) => {
                const numId = parseInt(objectId.replace('object:', ''), 10);
                if (!isNaN(numId)) onOpenObject(numId);
              }
            : undefined
        }
      />
    </div>
  );
}

/* ────────────────────────────────────────────────────
   Tuning tab
   ──────────────────────────────────────────────────── */

function TuningTab({
  notebook,
  slug,
  onConfigChange,
}: {
  notebook: ApiNotebookDetail;
  slug: string;
  onConfigChange?: () => void;
}) {
  const config = notebook.engine_config ?? {};
  const initial = configToIntensity(config as Record<string, unknown>);
  const [discovery, setDiscovery] = useState(initial.discovery);
  const [pruning, setPruning] = useState(initial.pruning);
  const [organization, setOrganization] = useState(initial.organization);
  const [showNerds, setShowNerds] = useState(false);

  // Type allowlist
  const allTypes = OBJECT_TYPES.map((t) => t.slug);
  const activeTypes = (notebook.available_types?.length > 0
    ? notebook.available_types
    : allTypes) as string[];
  const [selectedTypes, setSelectedTypes] = useState<string[]>(activeTypes);

  // Module toggles
  const modules = (config.modules ?? {}) as Record<string, boolean>;
  const [moduleState, setModuleState] = useState<Record<string, boolean>>(
    Object.fromEntries(NOTEBOOK_MODULES.map((m) => [m.key, modules[m.key] ?? true])),
  );

  // Debounced intensity save
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);
  const saveIntensity = useCallback(
    (d: number, p: number, o: number) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
        const mapped = mapIntensityToConfig(d, p, o);
        await patchEngineConfig(slug, mapped as Record<string, unknown>);
        onConfigChange?.();
      }, 500);
    },
    [slug, onConfigChange],
  );

  const handleTypeToggle = useCallback(
    async (typeSlug: string) => {
      const next = selectedTypes.includes(typeSlug)
        ? selectedTypes.filter((t) => t !== typeSlug)
        : [...selectedTypes, typeSlug];
      setSelectedTypes(next);
      await patchNotebook(slug, { available_types: next });
    },
    [slug, selectedTypes],
  );

  const handleModuleToggle = useCallback(
    async (moduleKey: string) => {
      const next = { ...moduleState, [moduleKey]: !moduleState[moduleKey] };
      setModuleState(next);
      await patchEngineConfig(slug, { modules: next } as Record<string, unknown>);
    },
    [slug, moduleState],
  );

  return (
    <div className="cp-nb-tuning">
      {/* ── Intensity sliders ── */}
      <section className="cp-nb-tuning-section">
        <h3 className="cp-nb-tuning-heading">Connection Intensity</h3>
        <IntensitySlider
          label="Discovery"
          value={discovery}
          onChange={(v) => { setDiscovery(v); saveIntensity(v, pruning, organization); }}
        />
        <IntensitySlider
          label="Pruning"
          value={pruning}
          onChange={(v) => { setPruning(v); saveIntensity(discovery, v, organization); }}
        />
        <IntensitySlider
          label="Organization"
          value={organization}
          onChange={(v) => { setOrganization(v); saveIntensity(discovery, pruning, v); }}
        />
      </section>

      {/* ── Type allowlist ── */}
      <section className="cp-nb-tuning-section">
        <h3 className="cp-nb-tuning-heading">Object Types</h3>
        <div className="cp-nb-type-grid">
          {OBJECT_TYPES.map((t) => (
            <button
              key={t.slug}
              type="button"
              className="cp-nb-type-chip"
              data-active={selectedTypes.includes(t.slug)}
              onClick={() => handleTypeToggle(t.slug)}
            >
              <span
                className="cp-nb-type-chip-dot"
                style={{ backgroundColor: t.color }}
              />
              {t.label}
            </button>
          ))}
        </div>
      </section>

      {/* ── Modules ── */}
      <section className="cp-nb-tuning-section">
        <h3 className="cp-nb-tuning-heading">Modules</h3>
        <div className="cp-nb-module-list">
          {NOTEBOOK_MODULES.map((m) => (
            <div key={m.key} className="cp-nb-module-card">
              <div className="cp-nb-module-info">
                <span className="cp-nb-module-name">{m.name}</span>
                <span className="cp-nb-module-desc">{m.description}</span>
              </div>
              <label className="cp-nb-toggle">
                <input
                  type="checkbox"
                  checked={moduleState[m.key] ?? true}
                  onChange={() => handleModuleToggle(m.key)}
                />
                <span className="cp-nb-toggle-track" />
              </label>
            </div>
          ))}
        </div>
      </section>

      {/* ── Stats for nerds (collapsible) ── */}
      <details
        className="cp-nb-tuning-section cp-nb-nerds"
        open={showNerds}
        onToggle={(e) => setShowNerds((e.target as HTMLDetailsElement).open)}
      >
        <summary className="cp-nb-nerds-summary">
          Show engine internals (stats for nerds)
        </summary>
        <div className="cp-nb-nerds-content">
          <EnginePassGrid config={config as Record<string, Record<string, unknown>>} />
        </div>
      </details>
    </div>
  );
}

/* ── Intensity slider ── */

function IntensitySlider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="cp-nb-slider">
      <div className="cp-nb-slider-label">
        <span>{label}</span>
        <span className="cp-nb-slider-semantic">{INTENSITY_LABELS[value - 1]}</span>
        <span className="cp-nb-slider-value">{value}</span>
      </div>
      <input
        type="range"
        min={1}
        max={5}
        step={1}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        className="cp-nb-slider-input"
      />
    </div>
  );
}

/* ── Inline engine pass grid (stats for nerds) ── */

function EnginePassGrid({ config }: { config: Record<string, Record<string, unknown>> }) {
  const passes = config?.passes ?? {};
  const postPasses = config?.post_passes ?? {};

  return (
    <div className="cp-engine-grid">
      <h4 className="cp-engine-grid-heading">Connection Passes</h4>
      {ENGINE_PASSES.map((p) => {
        const passConfig = (passes[p.key] ?? {}) as Record<string, unknown>;
        const enabled = passConfig.enabled !== false;
        const available = !p.requiresPyTorch; // Production mode: PyTorch unavailable
        return (
          <div
            key={p.key}
            className="cp-engine-row"
            data-available={available}
            data-enabled={enabled && available}
          >
            <span className="cp-engine-badge">{p.pass}</span>
            <div className="cp-engine-row-info">
              <span className="cp-engine-row-name">{p.name}</span>
              <span className="cp-engine-row-source">{p.source}</span>
            </div>
            <span className="cp-engine-status" data-status={!available ? 'unavailable' : enabled ? 'active' : 'disabled'}>
              {!available ? 'Unavailable' : enabled ? 'Active' : 'Disabled'}
            </span>
          </div>
        );
      })}

      <h4 className="cp-engine-grid-heading" style={{ marginTop: 16 }}>Post-Passes</h4>
      {POST_PASSES.map((p) => {
        const passConfig = (postPasses[p.key] ?? {}) as Record<string, unknown>;
        const enabled = passConfig.enabled !== false;
        return (
          <div key={p.key} className="cp-engine-row" data-available="true" data-enabled={enabled}>
            <div className="cp-engine-row-info">
              <span className="cp-engine-row-name">{p.name}</span>
              <span className="cp-engine-row-source">{p.source}</span>
            </div>
            <span className="cp-engine-status" data-status={enabled ? 'active' : 'disabled'}>
              {enabled ? 'Active' : 'Disabled'}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ────────────────────────────────────────────────────
   Sharing tab
   ──────────────────────────────────────────────────── */

function SharingTab({
  notebook,
  slug,
}: {
  notebook: ApiNotebookDetail;
  slug: string;
}) {
  const [visibility, setVisibility] = useState(notebook.visibility ?? 'private');
  const [copied, setCopied] = useState(false);

  const handleVisibilityChange = useCallback(
    async (v: string) => {
      setVisibility(v);
      await patchNotebook(slug, { visibility: v });
    },
    [slug],
  );

  const shareUrl = `https://commonplace.travisgilbert.me/shared/${slug}`;

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [shareUrl]);

  const options = [
    {
      value: 'private',
      label: 'Private',
      desc: 'Only you. This notebook is not accessible to anyone else.',
    },
    {
      value: 'unlisted',
      label: 'Unlisted',
      desc: 'Anyone with the link can view (read-only). Objects and connections are visible but not editable.',
    },
    {
      value: 'public',
      label: 'Public',
      desc: 'Listed in The Commons directory. Anyone can browse and fork.',
    },
  ];

  return (
    <div className="cp-nb-sharing">
      <section className="cp-nb-tuning-section">
        <h3 className="cp-nb-tuning-heading">Visibility</h3>
        <div className="cp-nb-visibility-options">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className="cp-nb-visibility-card"
              data-active={visibility === opt.value}
              onClick={() => handleVisibilityChange(opt.value)}
            >
              <span className="cp-nb-visibility-radio" data-checked={visibility === opt.value} />
              <div>
                <span className="cp-nb-visibility-label">{opt.label}</span>
                <span className="cp-nb-visibility-desc">{opt.desc}</span>
              </div>
            </button>
          ))}
        </div>
      </section>

      {visibility !== 'private' && (
        <section className="cp-nb-tuning-section">
          <h3 className="cp-nb-tuning-heading">Share Link</h3>
          <div className="cp-nb-share-link">
            <input
              type="text"
              readOnly
              value={shareUrl}
              className="cp-nb-share-input"
            />
            <button type="button" className="cp-nb-share-copy" onClick={handleCopy}>
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </section>
      )}

      <p className="cp-nb-sharing-teaser">
        Forking, collaborative editing, and comment threads are coming.
      </p>
    </div>
  );
}
