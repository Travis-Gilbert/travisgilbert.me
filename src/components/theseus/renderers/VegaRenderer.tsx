'use client';

/**
 * VegaRenderer: Statistical charts via dynamically imported vega-embed.
 *
 * Dark theme overrides match VIE design tokens.
 * Sized to 60% viewport width, centered.
 * On bar/point click: sends data value to parent for narration.
 * vega-embed is NEVER imported at bundle level (dynamic import only).
 */

import { useRef, useEffect, useState } from 'react';
import type { DataLayerSpec } from '@/lib/theseus-viz/SceneSpec';
import { clearContainer } from './domUtils';

const VEGA_THEME_OVERRIDES = {
  background: 'transparent',
  view: { stroke: 'transparent' },
  axis: {
    labelColor: '#9a958d',
    titleColor: '#e8e5e0',
    gridColor: 'rgba(255, 255, 255, 0.06)',
    domainColor: 'rgba(255, 255, 255, 0.12)',
    tickColor: 'rgba(255, 255, 255, 0.06)',
  },
  legend: {
    labelColor: '#9a958d',
    titleColor: '#e8e5e0',
  },
  title: {
    color: '#e8e5e0',
    subtitleColor: '#9a958d',
  },
  range: {
    category: ['#2D5F6B', '#C49A4A', '#7B5EA7', '#C4503C', '#4A8A96', '#5A7A4A'],
  },
};

interface VegaRendererProps {
  dataLayer: DataLayerSpec;
  onValueClick?: (value: string) => void;
}

export default function VegaRenderer({ dataLayer, onValueClick }: VegaRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    let cancelled = false;
    let vegaView: { finalize: () => void } | null = null;

    async function render() {
      try {
        const vegaEmbedModule = await import('vega-embed');
        const vegaEmbed = vegaEmbedModule.default;
        if (cancelled || !container) return;

        clearContainer(container);
        setLoading(false);

        const vegaSpec = dataLayer.vega_spec as object | undefined;
        if (!vegaSpec) {
          setError('No Vega-Lite spec provided');
          return;
        }

        const result = await vegaEmbed(container, vegaSpec as import('vega-embed').VisualizationSpec, {
          actions: false,
          theme: 'dark',
          config: VEGA_THEME_OVERRIDES,
          renderer: 'svg',
        });

        vegaView = result.view;

        if (onValueClick) {
          result.view.addEventListener('click', (_event: unknown, item: unknown) => {
            if (cancelled) return;
            const datum = (item as Record<string, unknown>)?.datum as Record<string, unknown> | undefined;
            if (datum) {
              const value =
                (datum.id as string) ||
                (datum.name as string) ||
                (datum[dataLayer.x_field] as string) ||
                JSON.stringify(datum);
              onValueClick(value);
            }
          });
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Vega render failed');
          setLoading(false);
        }
      }
    }

    render();

    return () => {
      cancelled = true;
      vegaView?.finalize();
    };
  }, [dataLayer, onValueClick]);

  return (
    <div
      style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '60vw',
        zIndex: 5,
        background: 'rgba(15, 16, 18, 0.85)',
        borderRadius: '8px',
        padding: '24px',
        pointerEvents: 'auto',
      }}
    >
      {loading && (
        <div style={statusStyle}>Loading chart...</div>
      )}
      {error && (
        <div style={{ ...statusStyle, color: '#C4503C' }}>{error}</div>
      )}
      <div ref={containerRef} style={{ width: '100%' }} />
    </div>
  );
}

const statusStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '200px',
  color: '#5c5851',
  fontFamily: "'Courier Prime', monospace",
  fontSize: '12px',
};
