'use client';

import { useEffect, useRef, useState } from 'react';
import type { FC } from 'react';
import CosmosGraphCanvas, {
  type CosmosGraphCanvasHandle,
} from './CosmosGraphCanvas';
import TheseusErrorBoundary from '@/components/theseus/TheseusErrorBoundary';
import ExplorerAskComposer from './ExplorerAskComposer';
import AtlasPlateLabel from './atlas/AtlasPlateLabel';
import AtlasIngestBar from './atlas/AtlasIngestBar';
import AtlasGraphControls from './atlas/AtlasGraphControls';
import AtlasScopeControl from './atlas/AtlasScopeControl';
import AtlasScaleBar from './atlas/AtlasScaleBar';
import AtlasNodeDetail from './atlas/AtlasNodeDetail';
import { useGraphData, type CosmoPoint } from './useGraphData';
import { useEvidenceTextResolver, useLabelResolver } from './useLabelResolver';
import {
  applySceneDirective,
  readTopologyInterpretation,
} from '@/lib/theseus/cosmograph/adapter';
import { useWebGL2Support } from '@/lib/theseus/cosmograph/useWebGL2Support';
import { onTheseusEvent } from '@/lib/theseus/events';
import { initMosaicCoordinator } from '@/lib/theseus/mosaic/coordinator';
import { ingestExplorerData } from '@/lib/theseus/mosaic/ingestExplorerData';
import { attachSelectionBridge } from '@/lib/theseus/mosaic/selectionBridge';
import EdgeTypeHistogram from './charts/EdgeTypeHistogram';
import CommunityStrip from './charts/CommunityStrip';
import TimelineBrush from './charts/TimelineBrush';
import { useTheseus } from '@/components/theseus/TheseusShell';
import type { NodeDetailData } from './NodeDetailPanel';
import type {
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
const ExplorerShell: FC = () => {
  const { atlasFilters } = useTheseus();
  const { points, links, loading, error, total } = useGraphData({
    activeKinds: atlasFilters.activeKinds,
    surfaces: atlasFilters.surfaces,
    scope: atlasFilters.scope,
  });
  const webgl2Support = useWebGL2Support();
  const canvasRef = useRef<CosmosGraphCanvasHandle>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [directiveLabel, setDirectiveLabel] = useState<string | null>(null);
  const [directiveTopology, setDirectiveTopology] =
    useState<TopologyInterpretation | null>(null);
  const [measureOpen, setMeasureOpen] = useState(false);
  const [labelsOn, setLabelsOn] = useState(true);
  const [zoomLevel, setZoomLevel] = useState<number | undefined>(undefined);

  const resolveLabelText = useLabelResolver(points);
  const resolveEvidenceText = useEvidenceTextResolver(points);

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

  return (
    <div className="atlas-canvas" style={{ flex: 1, minHeight: 0 }}>
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
        surfaceLabel={atlasFilters.surfaceLabel}
        directiveActive={Boolean(directiveLabel)}
        onDismissDirective={handleDismissDirective}
      />

      <AtlasScopeControl
        scope={atlasFilters.scope}
        onChange={atlasFilters.setScope}
      />

      <AtlasIngestBar />

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
