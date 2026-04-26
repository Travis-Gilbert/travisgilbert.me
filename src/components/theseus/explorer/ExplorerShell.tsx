'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DragEvent, FC } from 'react';
import { useSearchParams } from 'next/navigation';
import CosmosGraphCanvas, {
  type CosmosGraphCanvasHandle,
} from './CosmosGraphCanvas';
import TheseusErrorBoundary from '@/components/theseus/TheseusErrorBoundary';
import ExplorerAskComposer from './ExplorerAskComposer';
import AtlasPlateLabel from './atlas/AtlasPlateLabel';
import AtlasGraphControls from './atlas/AtlasGraphControls';
import AtlasLensSwitcher from './atlas/AtlasLensSwitcher';
import AtlasScaleBar from './atlas/AtlasScaleBar';
import AtlasNodeDetail from './atlas/AtlasNodeDetail';
import GraphLegend from './GraphLegend';
import { useGraphData, type CosmoLink, type CosmoPoint } from './useGraphData';
import type {
  InstantKgChunkEvent,
  InstantKgStreamHandlers,
} from '@/lib/theseus/instantKg';
import { useEvidenceTextResolver, useLabelResolver } from './useLabelResolver';
import {
  applySceneDirective,
  applySceneDirectivePatch,
  readTopologyInterpretation,
} from '@/lib/theseus/cosmograph/adapter';
import { useWebGL2Support } from '@/lib/theseus/cosmograph/useWebGL2Support';
import { onTheseusEvent } from '@/lib/theseus/events';
import { openNodeDetail } from '@/lib/theseus/nodeDetailUrl';
import { initMosaicCoordinator } from '@/lib/theseus/mosaic/coordinator';
import { ingestExplorerData } from '@/lib/theseus/mosaic/ingestExplorerData';
import { attachSelectionBridge } from '@/lib/theseus/mosaic/selectionBridge';
import EdgeTypeHistogram from './charts/EdgeTypeHistogram';
import CommunityStrip from './charts/CommunityStrip';
import TimelineBrush from './charts/TimelineBrush';
import { useTheseus } from '@/components/theseus/TheseusShell';
import type { NodeDetailData } from './NodeDetailPanel';
import type {
  LensId,
  SceneDirective,
  TopologyInterpretation,
} from '@/lib/theseus-viz/SceneDirective';

/**
 * Atlas Explorer shell: warm-dark + paper-canvas blueprint surface.
 *
 * Layout model: the cosmos.gl canvas fills the main area; Atlas chrome
 * (plate label, ingest bar, node detail, graph controls, chat composer,
 * scale bar) floats over it via absolute positioning.
 *
 * Uses the existing CosmosGraphCanvas + ExplorerAskComposer + SceneDirector
 * pipeline unchanged; only the surrounding chrome is Atlas-specific.
 */

const TYPE_FALLBACK = 'note';

function mergePointsById(base: CosmoPoint[], additions: CosmoPoint[]): CosmoPoint[] {
  if (additions.length === 0) return base;
  const seen = new Map<string, CosmoPoint>();
  for (const p of base) {
    seen.set(String(p.id), p);
  }
  for (const p of additions) {
    seen.set(String(p.id), { ...seen.get(String(p.id)), ...p });
  }
  return Array.from(seen.values());
}

// Default kind→color fallback used for instant-KG live additions. The
// orchestrator does not ship `object_type_color` on its SSE events
// (the base /objects/ endpoint does, see useGraphData.mapNode), so the
// adapters below derive a defensible default that matches the site
// design tokens for each kind family.
const DEFAULT_LIVE_COLORS: Record<string, string> = {
  source: '#C49A4A',
  paper: '#C49A4A',
  document: '#C49A4A',
  person: '#2D5F6B',
  concept: '#2D5F6B',
  hunch: '#B45A2D',
  note: '#B45A2D',
  code: '#5A7A4A',
  script: '#5A7A4A',
  chunk: '#9CA3AF',
};

function colorForKind(kind: string | null | undefined): string {
  const k = (kind || '').toLowerCase();
  return DEFAULT_LIVE_COLORS[k] || '#9CA3AF';
}

function entityEventToPoint(event: {
  object_id: number | null;
  title: string;
  object_type_slug: string;
}): CosmoPoint | null {
  if (event.object_id == null) return null;
  const kind = event.object_type_slug || TYPE_FALLBACK;
  return {
    id: String(event.object_id),
    label: event.title,
    type: kind,
    colorHex: colorForKind(kind),
    degree: 0,
  };
}

function relationEventToLink(event: {
  edge: { source: number; target: number; edge_type: string; engine: string };
  glirel_confidence?: number;
  similarity?: number;
}): CosmoLink | null {
  if (event.edge?.source == null || event.edge?.target == null) return null;
  // Confidence floor varies by event source: GLiREL ships glirel_confidence
  // (relation_extracted) and the SBERT cross-doc path ships similarity
  // (cross_doc_edge). Either lands on weight; the canvas treats it as
  // the link's strength for force/render scaling.
  const weight =
    typeof event.glirel_confidence === 'number'
      ? event.glirel_confidence
      : typeof event.similarity === 'number'
        ? event.similarity
        : 0.5;
  return {
    source: String(event.edge.source),
    target: String(event.edge.target),
    weight,
    edge_type: event.edge.edge_type,
    engine: event.edge.engine || 'instant_kg',
  };
}

function documentEventToPoint(event: {
  object_id: number | null;
  title: string;
  object_type_slug: string;
}): CosmoPoint | null {
  if (event.object_id == null) return null;
  const kind = event.object_type_slug || 'source';
  return {
    id: String(event.object_id),
    label: event.title,
    type: kind,
    colorHex: colorForKind(kind),
    degree: 0,
  };
}

function chunkEventToPointAndLink(
  event: InstantKgChunkEvent,
): { point: CosmoPoint; link: CosmoLink } | null {
  if (event.object_id == null || event.parent_object_id == null) return null;
  const label = event.title || `Chunk ${event.chunk_index}`;
  return {
    point: {
      id: String(event.object_id),
      label,
      type: event.object_type_slug || 'chunk',
      colorHex: colorForKind(event.object_type_slug || 'chunk'),
      degree: 1,
    },
    link: {
      source: String(event.object_id),
      target: String(event.parent_object_id),
      weight: 1.0,
      edge_type: event.edge?.edge_type || 'part_of',
      engine: event.edge?.engine || 'instant_kg',
    },
  };
}

const ExplorerShell: FC = () => {
  const { atlasFilters } = useTheseus();
  const {
    points: basePoints,
    links: baseLinks,
    loading,
    error,
    total,
  } = useGraphData({
    activeKinds: atlasFilters.activeKinds,
    surfaces: atlasFilters.surfaces,
    scope: atlasFilters.scope,
  });
  const [liveAdditions, setLiveAdditions] = useState<{
    points: CosmoPoint[];
    links: CosmoLink[];
  }>({ points: [], links: [] });
  const [shellDragOver, setShellDragOver] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  // Mirror liveAdditions into a ref so the instantKgHandlers useMemo can
  // read the current set inside onComplete without taking liveAdditions
  // as a dependency (which would re-build the handlers every event and
  // restart the SSE subscription on the parent).
  const liveAdditionsRef = useRef<{ points: CosmoPoint[]; links: CosmoLink[] }>({
    points: [],
    links: [],
  });
  useEffect(() => {
    liveAdditionsRef.current = liveAdditions;
  }, [liveAdditions]);
  const points = useMemo(
    () => mergePointsById(basePoints, liveAdditions.points),
    [basePoints, liveAdditions.points],
  );
  const links = useMemo(
    () => [...baseLinks, ...liveAdditions.links],
    [baseLinks, liveAdditions.links],
  );
  const webgl2Support = useWebGL2Support();
  const canvasRef = useRef<CosmosGraphCanvasHandle>(null);
  const nodeDoubleClickedRef = useRef(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [directiveLabel, setDirectiveLabel] = useState<string | null>(null);
  const [directiveTopology, setDirectiveTopology] =
    useState<TopologyInterpretation | null>(null);
  const [measureOpen, setMeasureOpen] = useState(false);
  const [labelsOn, setLabelsOn] = useState(true);
  const [zoomLevel, setZoomLevel] = useState<number | undefined>(undefined);
  const [lens, setLens] = useState<LensId>('flow');
  const searchParams = useSearchParams();
  const focusPk = searchParams?.get('focus') ?? null;
  const focusAppliedRef = useRef<string | null>(null);
  // Hydrate the dimming pass when the user navigates back from Lens.
  // The Stage 4 onComplete handler appends `?live_additions=<id1,id2,...>`;
  // re-seeding placeholder points lets the dimming layer keep them
  // visible if the bulk graph load has not yet observed them. The
  // hydratedRef gate keeps this a one-shot mount-time effect so it
  // never cascades on subsequent param mutations.
  const liveAdditionsParam = searchParams?.get('live_additions') ?? '';
  const liveAdditionsHydratedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!liveAdditionsParam) return;
    if (liveAdditionsHydratedRef.current === liveAdditionsParam) return;
    const ids = liveAdditionsParam.split(',').filter(Boolean);
    if (ids.length === 0) return;
    liveAdditionsHydratedRef.current = liveAdditionsParam;
    // Mount-time URL hydration; the hydratedRef gate prevents cascade.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLiveAdditions((prev) => ({
      points: mergePointsById(
        prev.points,
        ids.map((id) => ({
          id,
          label: '',
          type: TYPE_FALLBACK,
          colorHex: '#9CA3AF',
          degree: 0,
        })),
      ),
      links: prev.links,
    }));
  }, [liveAdditionsParam]);

  const resolveLabelText = useLabelResolver(points);
  const resolveEvidenceText = useEvidenceTextResolver(points);

  const handleLensChange = useCallback((next: LensId) => {
    canvasRef.current?.setLens(next);
    setLens(next);
  }, []);

  // Instant-KG SSE handlers. Each event mutates the live additions state
  // so the cosmos.gl canvas rebuilds via the existing pushDataToGraph
  // path on the next prop update. The post-complete handler emits a
  // SceneDirectivePatch that focuses the highest-PPR new entity and
  // queues a 3-stop camera tour through its strongest neighbors.
  const instantKgHandlers = useMemo<InstantKgStreamHandlers>(
    () => ({
      onDocument(event) {
        const point = documentEventToPoint(event);
        if (!point) return;
        setLiveAdditions((prev) => ({
          ...prev,
          points: mergePointsById(prev.points, [point]),
        }));
      },
      onChunk(event) {
        const wrapped = chunkEventToPointAndLink(event);
        if (!wrapped) return;
        setLiveAdditions((prev) => ({
          points: mergePointsById(prev.points, [wrapped.point]),
          links: [...prev.links, wrapped.link],
        }));
      },
      onEntity(event) {
        const point = entityEventToPoint(event);
        if (!point) return;
        setLiveAdditions((prev) => ({
          ...prev,
          points: mergePointsById(prev.points, [point]),
        }));
      },
      onRelation(event) {
        const link = relationEventToLink(event);
        if (!link) return;
        setLiveAdditions((prev) => ({
          ...prev,
          links: [...prev.links, link],
        }));
      },
      onCrossDocEdge(event) {
        const link = relationEventToLink({
          edge: event.edge,
          similarity: event.similarity,
        });
        if (!link) return;
        setLiveAdditions((prev) => ({
          ...prev,
          links: [...prev.links, { ...link, engine: 'sbert_faiss' }],
        }));
      },
      onComplete(event) {
        const adapter = canvasRef.current;
        const pivotPk = event.focus.pivot_object_id;
        const pivotId = pivotPk == null ? null : String(pivotPk);
        const neighborIds = event.focus.neighbors
          .map((n) => (n.object_id == null ? null : String(n.object_id)))
          .filter((s): s is string => Boolean(s));

        if (adapter && pivotId) {
          applySceneDirectivePatch(adapter, {
            focus: { ids: [pivotId, ...neighborIds] },
            camera: {
              kind: 'waypoints',
              waypoints: [
                { nodeId: pivotId, dwellMs: 1200, distanceFactor: 0.7, transitionMs: 600 },
                ...neighborIds.map((nodeId) => ({
                  nodeId,
                  dwellMs: 800,
                  distanceFactor: 1.1,
                  transitionMs: 600,
                })),
              ],
            },
          });

          const newIds = [pivotId, ...neighborIds];
          if (newIds.length > 0 && typeof adapter.revealEvidence === 'function') {
            adapter.revealEvidence(newIds, { staggerMs: 80, durationMs: 600 });
          }
        } else if (adapter && pivotId == null) {
          adapter.fitView();
        }

        // Post-ingest hand-off: push ?view=lens&node=<pivot>&live_additions=...
        // and emit theseus:switch-panel so the Stage 6 Lens panel mounts. The
        // live_additions URL param lets a back-to-Explorer navigation
        // re-hydrate the focus dimming over the just-ingested subgraph.
        if (event.lens_target?.object_id != null && typeof window !== 'undefined') {
          const lensId = String(event.lens_target.object_id);
          const additions = liveAdditionsRef.current.points.map((p) => p.id).join(',');
          const url = new URL(window.location.href);
          url.searchParams.set('view', 'lens');
          url.searchParams.set('node', lensId);
          if (additions) {
            url.searchParams.set('live_additions', additions);
          }
          window.history.pushState({}, '', url.toString());
          window.dispatchEvent(
            new CustomEvent('theseus:switch-panel', { detail: { panel: 'lens' } }),
          );
        }
      },
      onError() {
        // Composer surfaces the error in chat. Nothing extra to do here.
      },
    }),
    [],
  );

  // Per-node double-click opens the Reflex node detail tab. Empty-canvas
  // double-click continues to toggle the atlas lens. The two paths are
  // mutually exclusive: onPointDoubleClick (cosmos.gl synthesized event)
  // sets nodeDoubleClickedRef.current=true; the DOM dblclick listener
  // early returns when that flag is set so the lens toggle does not
  // fire on top of a node open.
  useEffect(() => {
    const container = document.querySelector('.atlas-canvas');
    if (!container) return;
    function onDblClick(event: Event) {
      if (nodeDoubleClickedRef.current) return;
      if (lens === 'atlas') return;
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (target.tagName !== 'CANVAS') return;
      handleLensChange('atlas');
    }
    container.addEventListener('dblclick', onDblClick);
    return () => container.removeEventListener('dblclick', onDblClick);
  }, [lens, handleLensChange]);

  // Keyboard `L` opens the focused node in the Tier 2 Lens. The handler
  // reads the canvas's `getFocusedId()` first (covers programmatic focus
  // applied by ExplorerAskComposer) and falls back to `selectedId` (set
  // by user click). Pushes `?view=lens&node=<id>` and dispatches the
  // theseus:switch-panel event so PanelManager mounts the Lens panel.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'l' && e.key !== 'L') return;
      // Skip when typing in an input / contentEditable so the chat
      // composer doesn't lose its `l` keystroke.
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable) {
          return;
        }
      }
      const focusedId =
        canvasRef.current?.getFocusedId?.() ?? selectedId ?? null;
      if (!focusedId) return;
      const url = new URL(window.location.href);
      url.searchParams.set('view', 'lens');
      url.searchParams.set('node', focusedId);
      window.history.pushState({}, '', url.toString());
      window.dispatchEvent(
        new CustomEvent('theseus:switch-panel', { detail: { panel: 'lens' } }),
      );
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId]);

  // Honor ?focus=<pk> on mount so the Reflex page's "Back to Explorer"
  // link lands on a focused node. Runs once per (focus, points) pair so
  // the user can pan / zoom away after the initial focus without it
  // snapping back. Skips when points are empty (graph still loading).
  useEffect(() => {
    if (!focusPk) return;
    if (points.length === 0) return;
    if (focusAppliedRef.current === focusPk) return;
    const found = points.find((p: CosmoPoint) => String(p.id) === String(focusPk));
    if (!found) return;
    applySceneDirectivePatch(canvasRef.current, {
      focus: { ids: [String(found.id)] },
      camera: { kind: 'zoom', nodeId: String(found.id), durationMs: 800, distanceFactor: 3 },
    });
    // One-shot mount-time focus driven by URL: cascading-renders concern
    // does not apply because focusAppliedRef gates re-entry.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedId(String(found.id));
    focusAppliedRef.current = focusPk;
  }, [focusPk, points]);

  useEffect(() => {
    const off = onTheseusEvent('explorer:apply-directive', ({ directive }) => {
      const typed = directive as SceneDirective;
      applySceneDirective(canvasRef.current, typed, { resolveLabelText });
      const maybeLabel = (directive as { label?: string }).label;
      setDirectiveLabel(typeof maybeLabel === 'string' ? maybeLabel : 'Focused from chat');
      setDirectiveTopology(readTopologyInterpretation(typed));
    });
    return off;
  }, [resolveLabelText]);

  // Phase C: Mosaic Coordinator init + DuckDB ingestion + Selection bridge.
  useEffect(() => {
    if (loading || error) return;
    if (points.length === 0) return;
    let disposed = false;
    let disposeBridge: (() => void) | null = null;
    void (async () => {
      try {
        await initMosaicCoordinator();
      } catch (err) {
        console.warn('[ExplorerShell] Mosaic coordinator init failed', err);
        return;
      }
      if (disposed) return;
      try {
        await ingestExplorerData(points, links);
      } catch (err) {
        console.warn('[ExplorerShell] Explorer ingest failed', err);
        return;
      }
      if (disposed) return;
      if (webgl2Support !== 'supported') return;
      const adapter = canvasRef.current;
      if (!adapter) return;
      disposeBridge = attachSelectionBridge(adapter);
    })();
    return () => {
      disposed = true;
      if (disposeBridge) {
        disposeBridge();
        disposeBridge = null;
      }
    };
  }, [points, links, loading, error, webgl2Support]);

  function handleDismissDirective() {
    setDirectiveLabel(null);
    setDirectiveTopology(null);
    canvasRef.current?.cancelConstruction();
    canvasRef.current?.clearEncoding();
    canvasRef.current?.clearFocalLabels();
    canvasRef.current?.fitView();
  }

  function handleFit() {
    canvasRef.current?.fitView();
  }
  function handleReset() {
    canvasRef.current?.clearEncoding();
    canvasRef.current?.clearFocalLabels();
    canvasRef.current?.fitView();
  }
  function handleOpenCmdK() {
    // Defer to the shell-level palette by synthesizing the shortcut.
    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }),
    );
  }

  // Subscribe to the canvas's zoom stream so AtlasScaleBar can show
  // the live level. The subscription must be re-attached whenever the
  // canvas handle reboots (webgl support flipping, dataset swap). We
  // key the effect on webgl2Support + canRenderCanvas proxy.
  useEffect(() => {
    const adapter = canvasRef.current;
    if (!adapter) return;
    setZoomLevel(adapter.getZoom());
    const off = adapter.onZoomChange((z) => setZoomLevel(z));
    return off;
    // canRenderCanvas is derived below; we depend on its upstream
    // inputs so the subscription re-runs once the canvas mounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, error, points.length, webgl2Support]);

  const selectedNode: NodeDetailData | null =
    (points.find((p: CosmoPoint) => p.id === selectedId) as NodeDetailData | undefined) ?? null;

  const canRenderCanvas =
    !loading && !error && points.length > 0 && webgl2Support === 'supported';
  // Baseline plate label reflects the active scope (corpus / personal /
  // combined). Directive label and selection take precedence when set.
  const plateTitle = directiveLabel ?? (selectedNode?.label ?? atlasFilters.scopeLabel);

  // Drop zone: dropping files anywhere on the canvas surface forwards
  // them to the composer's pendingFiles state so the user can review or
  // remove attachments before submitting. The composer owns the actual
  // streamInstantKg dispatch via its existing routing fork.
  const handleShellDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      if (!event.dataTransfer.files || event.dataTransfer.files.length === 0) return;
      event.preventDefault();
      setShellDragOver(false);
      const files = Array.from(event.dataTransfer.files);
      setPendingFiles(files);
    },
    [],
  );

  return (
    <div
      className={`atlas-canvas${shellDragOver ? ' shell-drag-over' : ''}`}
      style={{ flex: 1, minHeight: 0 }}
      onDragOver={(e: DragEvent<HTMLDivElement>) => {
        if (e.dataTransfer.types.includes('Files')) {
          e.preventDefault();
          setShellDragOver(true);
        }
      }}
      onDragLeave={() => setShellDragOver(false)}
      onDrop={handleShellDrop}
    >
      {loading && (
        <div
          aria-busy="true"
          aria-live="polite"
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            color: 'var(--paper-ink-2)',
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            zIndex: 2,
          }}
        >
          <span
            aria-hidden="true"
            className="atlas-loading-pulse"
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: 'var(--paper-ink)',
              opacity: 0.6,
            }}
          />
          <span>Loading {atlasFilters.scopeLabel}</span>
          <span style={{ opacity: 0.65 }}>
            {total.nodes ? `${total.nodes} nodes` : 'preparing'}
          </span>
        </div>
      )}
      {error && (
        <div
          role="alert"
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--vie-error)',
            fontFamily: 'var(--font-body)',
            fontSize: 14,
            zIndex: 2,
            padding: 24,
            textAlign: 'center',
          }}
        >
          <strong style={{ marginBottom: 8 }}>Graph failed to load.</strong>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--paper-ink-3)' }}>
            {error}
          </span>
        </div>
      )}
      {!loading && !error && points.length === 0 && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--paper-ink-2)',
            fontFamily: 'var(--font-body)',
            fontSize: 14,
            textAlign: 'center',
            padding: 24,
          }}
        >
          No graph data yet. Drop files anywhere on this surface to ingest.
        </div>
      )}

      {canRenderCanvas && (
        <TheseusErrorBoundary label="explorer-canvas">
          <CosmosGraphCanvas
            ref={canvasRef}
            points={points}
            links={links}
            onPointClick={setSelectedId}
            onPointDoubleClick={(pointId) => {
              nodeDoubleClickedRef.current = true;
              window.setTimeout(() => {
                nodeDoubleClickedRef.current = false;
              }, 50);
              openNodeDetail(pointId);
            }}
            labelsOn={labelsOn}
          />
        </TheseusErrorBoundary>
      )}
      {!loading && !error && points.length > 0 && webgl2Support === 'unsupported' && (
        <div
          role="alert"
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--paper-ink-2)',
            fontFamily: 'var(--font-body)',
            fontSize: 14,
            textAlign: 'center',
            padding: 24,
            gap: 10,
            zIndex: 2,
          }}
        >
          <strong>Your browser doesn&rsquo;t support WebGL2.</strong>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              color: 'var(--paper-ink-3)',
              maxWidth: 480,
            }}
          >
            Explorer needs WebGL2 to render the graph.
          </span>
        </div>
      )}

      {/* Atlas chrome: absolutely positioned over the canvas. */}
      <AtlasPlateLabel
        title={plateTitle}
        nodes={points.length}
        edges={links.length}
        edgesTotal={total.edges}
        surfaceLabel={atlasFilters.surfaceLabel}
        directiveActive={Boolean(directiveLabel)}
        onDismissDirective={handleDismissDirective}
      />

      {canRenderCanvas && <AtlasScaleBar zoom={zoomLevel} />}

      {canRenderCanvas && (
        <AtlasGraphControls
          onFit={handleFit}
          onReset={handleReset}
          onOpenCmdK={handleOpenCmdK}
          onToggleMeasure={() => setMeasureOpen((v) => !v)}
          measureOpen={measureOpen}
          onToggleLabels={() => setLabelsOn((v) => !v)}
          labelsOn={labelsOn}
        />
      )}

      {canRenderCanvas && (
        <AtlasLensSwitcher lens={lens} onChange={handleLensChange} />
      )}

      {canRenderCanvas && points.length > 0 && (
        <div
          style={{
            position: 'absolute',
            top: 14,
            left: 14,
            zIndex: 4,
            pointerEvents: 'auto',
          }}
        >
          <GraphLegend points={points} />
        </div>
      )}

      {selectedNode && (
        <AtlasNodeDetail node={selectedNode} onClose={() => setSelectedId(null)} />
      )}

      {/* Forward-to-Lens button surfaces only when a node is focused. */}
      {selectedId && (
        <button
          type="button"
          className="atlas-focus-to-lens"
          onClick={() => {
            const url = new URL(window.location.href);
            url.searchParams.set('view', 'lens');
            url.searchParams.set('node', selectedId);
            window.history.pushState({}, '', url.toString());
            window.dispatchEvent(
              new CustomEvent('theseus:switch-panel', {
                detail: { panel: 'lens' },
              }),
            );
          }}
          style={{
            position: 'absolute',
            top: 14,
            right: 14,
            zIndex: 5,
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            padding: '6px 12px',
            background: 'var(--paper)',
            border: '1px solid var(--paper-rule)',
            color: 'var(--paper-ink)',
            cursor: 'pointer',
          }}
          title="Press L to open the focused node in the Lens close-read view"
        >
          Open in Lens
        </button>
      )}

      {/* Ask composer wraps in .atlas-chat for the paper floating card. */}
      <div
        className="atlas-chat"
        style={{
          // The ExplorerAskComposer renders its own input/submit; the
          // paper card chrome comes from the .atlas-chat wrapper.
          padding: '4px 4px 0',
        }}
      >
        <ExplorerAskComposer
          canvasAdapter={canvasRef}
          resolveLabelText={resolveLabelText}
          resolveEvidenceText={resolveEvidenceText}
          onInstantKg={instantKgHandlers}
          pendingFiles={pendingFiles}
          onConsumePendingFiles={() => setPendingFiles([])}
        />
      </div>

      {/* Measure strip: collapsible, hosts the three Mosaic widgets. */}
      {canRenderCanvas && measureOpen && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: 128,
            borderTop: '1px solid var(--paper-rule)',
            background: 'rgba(243, 239, 230, 0.85)',
            backdropFilter: 'blur(6px)',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            zIndex: 5,
          }}
        >
          <div style={{ borderRight: '1px solid var(--paper-rule)' }}>
            <EdgeTypeHistogram />
          </div>
          <div style={{ borderRight: '1px solid var(--paper-rule)' }}>
            <CommunityStrip />
          </div>
          <div>
            <TimelineBrush />
          </div>
        </div>
      )}
    </div>
  );
};

export default ExplorerShell;
