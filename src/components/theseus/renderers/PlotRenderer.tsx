'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import type { Markish } from '@observablehq/plot';
import type { SceneDirective } from '@/lib/theseus-viz/SceneDirective';
import { getProgressBucket, type ConstructionPlayback } from './rendering';
import {
  vegaLiteToPlot,
  sliceTranslationData,
  type PlotTranslation,
} from '@/lib/theseus-viz/vegaToPlot';

const VegaRenderer = dynamic(() => import('./VegaRenderer'), { ssr: false });

interface PlotRendererProps {
  directive: SceneDirective;
  playback: ConstructionPlayback;
  onContextSelect?: (context: string) => void;
  onError?: (error: Error) => void;
}

/** Post-process the Plot SVG to match dark theme axis colors. */
function applyAxisColors(svg: SVGElement): void {
  for (const el of svg.querySelectorAll('[aria-label="x-axis"] line, [aria-label="x-axis"] path')) {
    (el as SVGElement).setAttribute('stroke', 'rgba(255,255,255,0.12)');
  }
  for (const el of svg.querySelectorAll('[aria-label="y-axis"] line')) {
    (el as SVGElement).setAttribute('stroke', 'rgba(255,255,255,0.06)');
  }
  for (const el of svg.querySelectorAll('text')) {
    const parent = el.closest('[aria-label]');
    const label = parent?.getAttribute('aria-label') ?? '';
    if (label.toLowerCase().includes('title')) continue;
    el.setAttribute('fill', '#9a958d');
  }
}

export default function PlotRenderer({
  directive,
  playback,
  onContextSelect,
  onError,
}: PlotRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [renderFailed, setRenderFailed] = useState(false);

  const vegaSpec = directive.render_target.vega_spec as Record<string, unknown> | undefined;
  const progressBucket = getProgressBucket(playback);

  const translation = useMemo<PlotTranslation | null>(() => {
    if (!vegaSpec) return null;
    const result = vegaLiteToPlot(vegaSpec);
    if (!result.supported) return null;
    return result;
  }, [vegaSpec]);

  // Fallback when translation is unsupported OR a runtime render error occurred
  const translationFailed = !!vegaSpec && translation === null;
  const useFallback = translationFailed || renderFailed;

  useEffect(() => {
    if (!containerRef.current || !translation || useFallback) return;

    let cancelled = false;

    async function render() {
      try {
        const Plot = await import('@observablehq/plot');
        if (cancelled || !containerRef.current) return;

        const progress = Math.max(0.05, progressBucket / 20);
        const sliced = sliceTranslationData(translation!, progress);

        const marks = sliced.marks.map((descriptor) => {
          const markFn = (Plot as unknown as Record<string, (...args: unknown[]) => unknown>)[descriptor.markFn];
          if (typeof markFn !== 'function') return null;
          return markFn(descriptor.data, descriptor.channels);
        }).filter(Boolean);

        const svg = Plot.plot({
          marks: marks as Markish[],
          title: sliced.title,
          width: sliced.width,
          height: sliced.height ?? 360,
          style: {
            background: 'transparent',
            color: '#e8e5e0',
            fontFamily: 'var(--vie-font-body)',
            fontSize: '12px',
          },
          x: { line: true },
          y: { grid: true },
          color: { legend: true },
        });

        if (cancelled || !containerRef.current) {
          (svg as unknown as ChildNode).remove?.();
          return;
        }

        // Only run querySelectorAll theming on final render
        if (progressBucket >= 20) {
          applyAxisColors(svg as unknown as SVGElement);
        }

        const el = containerRef.current;
        while (el.firstChild) el.removeChild(el.firstChild);
        el.appendChild(svg as unknown as Node);

        setError(null);
      } catch (renderError) {
        if (cancelled) return;
        const message = renderError instanceof Error
          ? renderError.message
          : 'Failed to render Observable Plot chart';
        setError(message);
        setRenderFailed(true);
        onError?.(renderError instanceof Error ? renderError : new Error(message));
      }
    }

    render();

    return () => {
      cancelled = true;
    };
  }, [translation, progressBucket, useFallback, onError]);

  const handleContainerClick = useMemo(() => {
    if (!onContextSelect) return undefined;
    return (event: React.MouseEvent) => {
      const target = event.target as Element;
      const titleEl = target.querySelector('title') ?? target.closest('[title]');
      const content = titleEl?.textContent ?? titleEl?.getAttribute('title');
      if (content) onContextSelect(content);
    };
  }, [onContextSelect]);

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

  if (useFallback) {
    return (
      <VegaRenderer
        directive={directive}
        playback={playback}
        onContextSelect={onContextSelect}
        onError={onError}
      />
    );
  }

  return (
    <div style={layoutStyle}>
      <div
        ref={containerRef}
        onClick={handleContainerClick}
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
