'use client';

import { useEffect, useRef, useState } from 'react';
import type { FC } from 'react';
import { Cosmograph, prepareCosmographData } from '@cosmograph/react';
import type { CosmographRef } from '@cosmograph/react';
import { DEFAULT_COSMOGRAPH_CONFIG } from '@/lib/theseus/cosmograph/config';
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
 * Inline evidence subgraph. Renders a small Cosmograph canvas (~320px
 * tall) showing the directive's focal + context nodes and their local
 * edges. Click "Expand in Explorer" to hand the full directive to the
 * main canvas via the cross-panel event bus.
 */
const GraphPart: FC<GraphPartProps> = ({ directive, points, links }) => {
  const cosmoRef = useRef<CosmographRef>(null);
  const [prepared, setPrepared] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Cosmograph's data prep requires pointIdBy + pointIndexBy. We
      // assume the caller has added a sequential integer `index` column
      // on each point (useGraphData does this; ad-hoc call sites must too).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const prepConfig = {
        points: {
          pointIdBy: 'id',
          pointIndexBy: 'index',
          pointColorBy: 'type',
          pointLabelBy: 'label',
        },
        links: { linkSourceBy: 'source', linkTargetsBy: ['target'] },
      } as any;
      const result = await prepareCosmographData(prepConfig, points, links ?? []);
      if (!cancelled && result) {
        setPrepared(result as unknown as Record<string, unknown>);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [points, links]);

  useEffect(() => {
    if (!cosmoRef.current) return;
    applySceneDirective(cosmoRef.current, directive);
  }, [directive, prepared]);

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
        background: 'var(--color-hero-ground)',
        border: '1px solid var(--color-border)',
        borderRadius: 6,
        overflow: 'hidden',
        boxShadow: 'var(--shadow-warm-sm)',
        position: 'relative',
      }}
    >
      <div style={{ width: '100%', height: 320 }}>
        {prepared ? (
          <Cosmograph
            ref={cosmoRef}
            {...DEFAULT_COSMOGRAPH_CONFIG}
            {...(prepared as object)}
            fitViewOnInit
            simulationDecay={300}
            showDynamicLabels={false}
            pointSize={6}
            spaceSize={2048}
            enableRightClickRepulsion={false}
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
      </div>
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
