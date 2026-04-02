'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { SceneDirective } from '@/lib/theseus-viz/SceneDirective';
import { getDataBuildProgress, type ConstructionPlayback } from './rendering';

const VEGA_THEME_OVERRIDES = {
  background: 'transparent',
  view: { stroke: 'transparent' },
  axis: {
    labelColor: '#9a958d',
    titleColor: '#e8e5e0',
    gridColor: 'rgba(255,255,255,0.06)',
    domainColor: 'rgba(255,255,255,0.12)',
    tickColor: 'rgba(255,255,255,0.12)',
  },
  text: { color: '#e8e5e0' },
  title: { color: '#e8e5e0', subtitleColor: '#9a958d' },
  legend: { labelColor: '#9a958d', titleColor: '#e8e5e0' },
};

interface VegaRendererProps {
  directive: SceneDirective;
  playback: ConstructionPlayback;
  onContextSelect?: (context: string) => void;
  onError?: (error: Error) => void;
}

function getBucket(playback: ConstructionPlayback): number {
  return Math.floor(getDataBuildProgress(playback) * 20);
}

function cloneWithProgress(spec: Record<string, unknown>, progress: number): Record<string, unknown> {
  const next = structuredClone(spec);
  const data = next.data as Record<string, unknown> | undefined;
  const values = Array.isArray(data?.values) ? data.values : null;

  if (!values) {
    return next;
  }

  const count = Math.max(1, Math.ceil(values.length * progress));
  data!.values = values.slice(0, count);
  return next;
}

export default function VegaRenderer({
  directive,
  playback,
  onContextSelect,
  onError,
}: VegaRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const progressBucket = getBucket(playback);
  const vegaSpec = directive.render_target.vega_spec as Record<string, unknown> | undefined;

  const layoutStyle = useMemo(() => ({
    position: 'absolute' as const,
    left: '50%',
    top: '50%',
    transform: 'translate(-50%, -50%)',
    width: directive.context_shelf.enabled && directive.context_shelf.shelf_position === 'left'
      ? '62vw'
      : '60vw',
    zIndex: 5,
    pointerEvents: 'auto' as const,
  }), [directive.context_shelf]);

  useEffect(() => {
    if (!containerRef.current || !vegaSpec) {
      return;
    }
    const activeSpec = vegaSpec;

    let cancelled = false;
    let finalized = false;
    let finalize: (() => void) | undefined;

    async function render() {
      try {
        const module = await import('vega-embed');
        if (cancelled || !containerRef.current) {
          return;
        }

        containerRef.current.innerHTML = '';
        const preparedSpec = cloneWithProgress(activeSpec, Math.max(0.05, getDataBuildProgress(playback)));
        const result = await module.default(
          containerRef.current,
          preparedSpec as import('vega-embed').VisualizationSpec,
          {
            actions: false,
            renderer: 'svg',
            theme: 'dark',
            config: VEGA_THEME_OVERRIDES,
          },
        );

        finalize = () => {
          if (finalized) return;
          finalized = true;
          result.view.finalize();
        };

        result.view.addEventListener('click', (_event: unknown, item: unknown) => {
          const datum = (item as Record<string, unknown>)?.datum as Record<string, unknown> | undefined;
          if (!datum) {
            return;
          }

          const summary =
            typeof datum.id === 'string'
              ? datum.id
              : typeof datum.name === 'string'
                ? datum.name
                : JSON.stringify(datum);

          onContextSelect?.(summary);
        });

        setError(null);
      } catch (renderError) {
        const message = renderError instanceof Error ? renderError.message : 'Failed to render Vega chart';
        setError(message);
        onError?.(renderError instanceof Error ? renderError : new Error(message));
      }
    }

    render();

    return () => {
      cancelled = true;
      finalize?.();
    };
  }, [onContextSelect, onError, playback, progressBucket, vegaSpec]);

  return (
    <div style={layoutStyle}>
      <div
        ref={containerRef}
        style={{
          width: '100%',
          padding: '20px',
          borderRadius: 18,
          background: 'rgba(15,16,18,0.42)',
          border: '1px solid rgba(255,255,255,0.06)',
          backdropFilter: 'blur(18px)',
        }}
      />
      {error && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#C4503C',
            fontFamily: 'var(--vie-font-body)',
            fontSize: 14,
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}
