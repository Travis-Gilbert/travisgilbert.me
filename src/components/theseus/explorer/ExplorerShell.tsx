'use client';

import { useEffect, useRef, useState } from 'react';
import type { FC } from 'react';
import type { CosmographRef } from '@cosmograph/react';
import { CosmographProvider } from '@cosmograph/react';
import CosmographCanvas, { type CosmographCanvasHandle } from './CosmographCanvas';
import GraphSearch from './GraphSearch';
import GraphLegend from './GraphLegend';
import GraphTimeline from './GraphTimeline';
import GraphHistogram from './GraphHistogram';
import NodeDetailPanel, { type NodeDetailData } from './NodeDetailPanel';
import DirectiveBanner from './DirectiveBanner';
import { useGraphData, type CosmographPoint } from './useGraphData';
import { applySceneDirective } from '@/lib/theseus/cosmograph/adapter';
import { onTheseusEvent } from '@/lib/theseus/events';
import type { SceneDirective } from '@/lib/theseus-viz/SceneDirective';

/**
 * Explorer surface layout: Cosmograph fills the main area; search floats
 * top-center, legend top-right, histogram+timeline bottom, detail rail
 * right side. The directive banner appears when the panel was opened
 * from a chat scene-directive.
 */
const ExplorerShell: FC = () => {
  const { points, links, loading, error, total } = useGraphData();
  const canvasRef = useRef<CosmographCanvasHandle>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [directiveLabel, setDirectiveLabel] = useState<string | null>(null);

  useEffect(() => {
    const off = onTheseusEvent('explorer:apply-directive', ({ directive }) => {
      const cosmo: CosmographRef | null = canvasRef.current?.getCosmograph() ?? null;
      if (!cosmo) return;
      applySceneDirective(cosmo, directive as SceneDirective);
      setDirectiveLabel(
        typeof (directive as { label?: string }).label === 'string'
          ? ((directive as { label?: string }).label as string)
          : 'Focused from chat',
      );
    });
    return off;
  }, []);

  const handleDismissDirective = () => {
    setDirectiveLabel(null);
    const cosmo = canvasRef.current?.getCosmograph();
    if (cosmo && typeof (cosmo as unknown as { fitView?: () => void }).fitView === 'function') {
      (cosmo as unknown as { fitView: () => void }).fitView();
    }
  };

  const selectedNode: NodeDetailData | null =
    points.find((p: CosmographPoint) => p.id === selectedId) as NodeDetailData | undefined ?? null;

  return (
    <CosmographProvider>
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 460px',
        gridTemplateRows: 'auto 1fr auto',
        gridTemplateAreas: `
          "topbar detail"
          "canvas detail"
          "bottombar detail"
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
          justifyContent: 'space-between',
          padding: '12px 16px',
          gap: 12,
          zIndex: 3,
        }}
      >
        <div style={{ flex: '0 1 360px' }}>
          <GraphSearch />
        </div>
        <GraphLegend />
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
          <CosmographCanvas
            ref={canvasRef}
            points={points as unknown as Array<Record<string, unknown>>}
            links={links as unknown as Array<Record<string, unknown>>}
            onPointClick={setSelectedId}
          />
        )}
      </div>

      <div
        style={{
          gridArea: 'bottombar',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 12,
          padding: '12px 16px',
        }}
      >
        <GraphHistogram />
        <GraphTimeline />
      </div>

      <div style={{ gridArea: 'detail', overflow: 'hidden' }}>
        <NodeDetailPanel node={selectedNode} onClose={() => setSelectedId(null)} />
      </div>
    </div>
    </CosmographProvider>
  );
};

export default ExplorerShell;
