'use client';

import { useEffect, useRef, useState } from 'react';
import type { FC } from 'react';
import CosmosGraphCanvas, {
  type CosmosGraphCanvasHandle,
} from './CosmosGraphCanvas';
import TheseusErrorBoundary from '@/components/theseus/TheseusErrorBoundary';
import GraphLegend from './GraphLegend';
import NodeDetailPanel, { type NodeDetailData } from './NodeDetailPanel';
import DirectiveBanner from './DirectiveBanner';
import ExplorerAskComposer from './ExplorerAskComposer';
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
import type {
  SceneDirective,
  TopologyInterpretation,
} from '@/lib/theseus-viz/SceneDirective';

function pickGridAreas(hasDetail: boolean, hasCharts: boolean): string {
  if (hasDetail && hasCharts) return `"canvas detail" "charts charts"`;
  if (hasDetail) return `"canvas detail"`;
  if (hasCharts) return `"canvas" "charts"`;
  return `"canvas"`;
}

const ExplorerShell: FC = () => {
  const { points, links, loading, error, total } = useGraphData();
  const webgl2Support = useWebGL2Support();
  const canvasRef = useRef<CosmosGraphCanvasHandle>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [directiveLabel, setDirectiveLabel] = useState<string | null>(null);
  const [directiveTopology, setDirectiveTopology] = useState<TopologyInterpretation | null>(null);

  const resolveLabelText = useLabelResolver(points);
  const resolveEvidenceText = useEvidenceTextResolver(points);

  useEffect(() => {
    const off = onTheseusEvent('explorer:apply-directive', ({ directive }) => {
      const typed = directive as SceneDirective;
      applySceneDirective(canvasRef.current, typed, {
        resolveLabelText,
      });
      const maybeLabel = (directive as { label?: string }).label;
      setDirectiveLabel(typeof maybeLabel === 'string' ? maybeLabel : 'Focused from chat');
      setDirectiveTopology(readTopologyInterpretation(typed));
    });
    return off;
  }, [resolveLabelText]);

  // Phase C: Mosaic Coordinator init + DuckDB ingestion + Selection bridge.
  // Runs once after the graph data lands; survives StrictMode double-mount
  // via the disposed flag (init + ingest are idempotent on the singletons).
  // If WebGL2 is unsupported the canvas never mounts so the bridge step
  // is skipped; init + ingest still run so Mosaic widgets (charts added
  // by later phases) still work.
  useEffect(() => {
    if (loading || error) return;
    if (points.length === 0) return;
    let disposed = false;
    let disposeBridge: (() => void) | null = null;
    void (async () => {
      try {
        await initMosaicCoordinator();
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('[ExplorerShell] Mosaic coordinator init failed', err);
        return;
      }
      if (disposed) return;
      try {
        await ingestExplorerData(points, links);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('[ExplorerShell] Explorer ingest failed; canvas will run unfiltered', err);
        return;
      }
      if (disposed) return;
      if (webgl2Support !== 'supported') {
        // eslint-disable-next-line no-console
        console.info('[ExplorerShell] mosaic initialized, canvas unavailable');
        return;
      }
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

  const handleDismissDirective = () => {
    setDirectiveLabel(null);
    setDirectiveTopology(null);
    canvasRef.current?.cancelConstruction();
    canvasRef.current?.clearEncoding();
    canvasRef.current?.clearFocalLabels();
    canvasRef.current?.fitView();
  };

  const selectedNode: NodeDetailData | null =
    (points.find((p: CosmoPoint) => p.id === selectedId) as NodeDetailData | undefined) ?? null;

  const showCharts =
    !loading && !error && points.length > 0 && webgl2Support === 'supported';
  const gridAreas = pickGridAreas(Boolean(selectedNode), showCharts);

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: selectedNode ? '1fr 420px' : '1fr',
        gridTemplateRows: showCharts ? '1fr 96px' : '1fr',
        gridTemplateAreas: gridAreas,
        height: '100%',
        width: '100%',
        background: 'var(--color-hero-ground)',
        position: 'relative',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 12,
          right: selectedNode ? 432 : 12,
          zIndex: 3,
          transition: 'right 180ms ease-out',
        }}
      >
        <GraphLegend points={points} />
      </div>

      <div style={{ gridArea: 'canvas', position: 'relative' }}>
        <ExplorerAskComposer
          canvasAdapter={canvasRef}
          resolveLabelText={resolveLabelText}
          resolveEvidenceText={resolveEvidenceText}
        />
        {directiveLabel && (
          <DirectiveBanner
            label={directiveLabel}
            topology={directiveTopology}
            onDismiss={handleDismissDirective}
          />
        )}
        {loading && (
          <div
            aria-busy="true"
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-hero-text)',
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              zIndex: 2,
            }}
          >
            Loading graph ({total.nodes || '...'} nodes)
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
              color: 'var(--color-error)',
              fontFamily: 'var(--font-body)',
              fontSize: 14,
              zIndex: 2,
              padding: 24,
              textAlign: 'center',
            }}
          >
            <strong style={{ marginBottom: 8 }}>Graph failed to load.</strong>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-ink-muted)' }}>
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
              color: 'var(--color-hero-text)',
              fontFamily: 'var(--font-body)',
              fontSize: 14,
              textAlign: 'center',
              padding: 24,
            }}
          >
            No graph data yet. Drop files anywhere on this surface to ingest.
          </div>
        )}
        {!loading && !error && points.length > 0 && webgl2Support === 'supported' && (
          <TheseusErrorBoundary label="explorer-canvas">
            <CosmosGraphCanvas
              ref={canvasRef}
              points={points}
              links={links}
              onPointClick={setSelectedId}
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
              color: 'var(--color-hero-text)',
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
                color: 'var(--color-ink-muted)',
                maxWidth: 480,
              }}
            >
              Explorer needs WebGL2 to render the graph.{' '}
              <a
                href="https://developer.mozilla.org/docs/Web/API/WebGL2RenderingContext"
                target="_blank"
                rel="noreferrer"
                style={{ color: 'var(--color-terracotta)', textDecoration: 'underline' }}
              >
                See browser support
              </a>
              .
            </span>
          </div>
        )}
        {!loading && !error && points.length > 0 && webgl2Support === 'supported' && (
          <div
            style={{
              position: 'absolute',
              left: 16,
              bottom: 16,
              zIndex: 3,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--color-ink-muted)',
            }}
          >
            <button
              type="button"
              onClick={() => canvasRef.current?.fitView()}
              style={{
                fontFamily: 'inherit',
                fontSize: 'inherit',
                letterSpacing: 'inherit',
                textTransform: 'inherit',
                color: 'var(--color-hero-text)',
                background: 'color-mix(in srgb, var(--color-hero-ground) 70%, transparent)',
                border: '1px solid color-mix(in srgb, var(--color-hero-text) 30%, transparent)',
                padding: '5px 10px',
                borderRadius: 4,
                cursor: 'pointer',
              }}
            >
              Fit view
            </button>
            <span>drag to pan · scroll to zoom · click a node</span>
          </div>
        )}
      </div>

      {selectedNode && (
        <div style={{ gridArea: 'detail', overflow: 'hidden' }}>
          <NodeDetailPanel node={selectedNode} onClose={() => setSelectedId(null)} />
        </div>
      )}

      {showCharts && (
        <div
          style={{
            gridArea: 'charts',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            borderTop: '1px solid var(--cp-surface-border, var(--color-border))',
            background: 'var(--color-hero-ground)',
            overflow: 'hidden',
          }}
        >
          <div style={{ borderRight: '1px solid var(--cp-surface-border, var(--color-border))' }}>
            <EdgeTypeHistogram />
          </div>
          <div style={{ borderRight: '1px solid var(--cp-surface-border, var(--color-border))' }}>
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
