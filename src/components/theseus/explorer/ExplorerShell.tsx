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
import { useGraphData, type CosmoPoint } from './useGraphData';
import { applySceneDirective } from '@/lib/theseus/cosmograph/adapter';
import { onTheseusEvent } from '@/lib/theseus/events';
import type { SceneDirective } from '@/lib/theseus-viz/SceneDirective';

const ExplorerShell: FC = () => {
  const { points, links, loading, error, total } = useGraphData();
  const canvasRef = useRef<CosmosGraphCanvasHandle>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [directiveLabel, setDirectiveLabel] = useState<string | null>(null);

  useEffect(() => {
    const off = onTheseusEvent('explorer:apply-directive', ({ directive }) => {
      applySceneDirective(canvasRef.current, directive as SceneDirective);
      const maybeLabel = (directive as { label?: string }).label;
      setDirectiveLabel(typeof maybeLabel === 'string' ? maybeLabel : 'Focused from chat');
    });
    return off;
  }, []);

  const handleDismissDirective = () => {
    setDirectiveLabel(null);
    canvasRef.current?.clearFocus();
    canvasRef.current?.fitView();
  };

  const selectedNode: NodeDetailData | null =
    (points.find((p: CosmoPoint) => p.id === selectedId) as NodeDetailData | undefined) ?? null;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 460px',
        gridTemplateRows: 'auto 1fr',
        gridTemplateAreas: `
          "topbar detail"
          "canvas detail"
        `,
        height: '100%',
        width: '100%',
        background: 'var(--color-hero-ground)',
        position: 'relative',
      }}
    >
      <div
        style={{
          gridArea: 'topbar',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          padding: '12px 16px',
          gap: 12,
          zIndex: 3,
        }}
      >
        <GraphLegend points={points} />
      </div>

      <div style={{ gridArea: 'canvas', position: 'relative' }}>
        {directiveLabel && (
          <DirectiveBanner label={directiveLabel} onDismiss={handleDismissDirective} />
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
        {!loading && !error && points.length > 0 && (
          <TheseusErrorBoundary label="explorer-canvas">
            <CosmosGraphCanvas
              ref={canvasRef}
              points={points}
              links={links}
              onPointClick={setSelectedId}
            />
          </TheseusErrorBoundary>
        )}
      </div>

      <div style={{ gridArea: 'detail', overflow: 'hidden' }}>
        <NodeDetailPanel node={selectedNode} onClose={() => setSelectedId(null)} />
      </div>
    </div>
  );
};

export default ExplorerShell;
