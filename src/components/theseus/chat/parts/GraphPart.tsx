'use client';

import { useEffect, useMemo, useRef } from 'react';
import type { FC } from 'react';
import CosmosGraphCanvas, {
  type CosmosGraphCanvasHandle,
} from '@/components/theseus/explorer/CosmosGraphCanvas';
import {
  mapNode,
  mapEdge,
  type CosmoLink,
} from '@/components/theseus/explorer/useGraphData';
import { useLabelResolver } from '@/components/theseus/explorer/useLabelResolver';
import { applySceneDirective } from '@/lib/theseus/cosmograph/adapter';
import { dispatchTheseusEvent } from '@/lib/theseus/events';
import { normalizeDirective } from '@/lib/theseus/sceneDirector/directive';
import type { SceneDirective } from '@/lib/theseus-viz/SceneDirective';

interface GraphPartProps {
  directive: SceneDirective;
  points: Array<Record<string, unknown>>;
  links?: Array<Record<string, unknown>>;
}

/**
 * Inline evidence subgraph rendered inside a chat message. Reuses the
 * Explorer's CosmosGraphCanvas to show the directive's focal + context
 * nodes at ~320px tall. Click "Expand in Explorer" to hand the full
 * directive to the main canvas via the cross-panel event bus.
 */
const GraphPart: FC<GraphPartProps> = ({ directive, points, links }) => {
  const canvasRef = useRef<CosmosGraphCanvasHandle>(null);

  const cosmoPoints = useMemo(() => points.map(mapNode), [points]);
  const cosmoLinks = useMemo<CosmoLink[]>(
    () => (links ?? []).map(mapEdge).filter((l): l is CosmoLink => l !== null),
    [links],
  );

  const resolveLabelText = useLabelResolver(cosmoPoints);

  useEffect(() => {
    if (!canvasRef.current) return;
    applySceneDirective(canvasRef.current, directive, {
      resolveLabelText,
    });
  }, [directive, resolveLabelText]);

  const handleExpand = () => {
    const normalized = normalizeDirective(directive);
    dispatchTheseusEvent('theseus:switch-panel', {
      panel: 'explorer',
      source: 'chat-directive',
    });
    window.requestAnimationFrame(() => {
      dispatchTheseusEvent('explorer:apply-directive', {
        directive: normalized,
        source: 'chat',
      });
    });
  };

  return (
    <div
      className="aui-graph-part"
      style={{
        position: 'relative',
        height: 320,
        background: 'var(--color-hero-ground)',
        border: '1px solid var(--color-border)',
        borderRadius: 6,
        overflow: 'hidden',
        boxShadow: 'var(--shadow-warm-sm)',
      }}
    >
      {cosmoPoints.length > 0 ? (
        <CosmosGraphCanvas
          ref={canvasRef}
          points={cosmoPoints}
          links={cosmoLinks}
        />
      ) : (
        <div
          aria-busy="true"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: 'var(--color-hero-text)',
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}
        >
          Preparing graph
        </div>
      )}
      <button
        type="button"
        onClick={handleExpand}
        style={{
          position: 'absolute',
          right: 10,
          bottom: 10,
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--color-hero-text)',
          background: 'color-mix(in srgb, var(--color-hero-ground) 70%, transparent)',
          border: '1px solid color-mix(in srgb, var(--color-hero-text) 30%, transparent)',
          padding: '4px 8px',
          borderRadius: 4,
          cursor: 'pointer',
        }}
      >
        ↗ Expand in Explorer
      </button>
    </div>
  );
};

export default GraphPart;
