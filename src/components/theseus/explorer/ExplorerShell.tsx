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
import type { InstantKgStreamHandlers } from '@/lib/theseus/instantKg';
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
 * Atlas Explorer shell — warm-dark + paper-canvas blueprint surface.
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

function entityEventToPoint(event: {
  object_id: number | null;
  label: string;
  type: string;
  color: string;
}): CosmoPoint | null {
  if (event.object_id == null) return null;
  return {
    id: String(event.object_id),
    label: event.label,
    type: event.type || TYPE_FALLBACK,
    colorHex: event.color || '#2D5F6B',
    degree: 0,
  };
}

function relationEventToLink(event: {
  source_object_id: number | null;
  target_object_id: number | null;
  edge_type: string;
  weight: number;
}): CosmoLink | null {
  if (event.source_object_id == null || event.target_object_id == null) return null;
  return {
    source: String(event.source_object_id),
    target: String(event.target_object_id),
    weight: event.weight,
    edge_type: event.edge_type,
    engine: 'glirel',
  };
}

function documentEventToPoint(event: {
  object_id: number | null;
  title: string;
  object_type: string;
  color: string;
}): CosmoPoint | null {
  if (event.object_id == null) return null;
  return {
    id: String(event.object_id),
    label: event.title,
    type: event.object_type || 'source',
    colorHex: event.color || '#C49A4A',
    degree: 0,
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
          source_object_id: event.source_object_id,
          target_object_id: event.target_object_id,
          edge_type: event.edge_type,
          weight: event.weight,
        });
        if (!link) return;
        setLiveAdditions((prev) => ({
          ...prev,
          links: [...prev.links, { ...link, engine: 'sbert_faiss' }],
        }));
      },
      onComplete(event) {
        const adapter = canvasRef.current;
        if (!adapter) return;
        const pivotPk = event.focus.pivot_object_id;
        if (pivotPk == null) {
          adapter.fitView();
          return;
        }
        const pivotId = String(pivotPk);
        const neighborIds = event.focus.neighbors
          .map((n) => (n.object_id == null ? null : String(n.object_id)))
          .filter((s): s is string => Boolean(s));

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

      {/* Atlas chrome — absolutely positioned over the canvas. */}
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

      {/* Measure strip — collapsible, hosts the three Mosaic widgets. */}
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
