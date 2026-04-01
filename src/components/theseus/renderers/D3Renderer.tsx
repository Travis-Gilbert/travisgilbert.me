'use client';

/**
 * D3Renderer: HTML overlay for D3 visualizations on top of the R3F canvas.
 *
 * D3 is imported dynamically (never at bundle level).
 * Sized to 70% viewport width, centered, transparent background.
 * Data points appear progressively (500 pts per 100ms frame).
 */

import { useRef, useEffect, useState } from 'react';
import type { DataLayerSpec } from '@/lib/theseus-viz/SceneSpec';
import { clearContainer } from './domUtils';

const POINTS_PER_FRAME = 500;

interface D3RendererProps {
  dataLayer: DataLayerSpec;
  onNodeClick?: (nodeId: string) => void;
}

interface CleanupHandles {
  rafId: number | null;
  simulation: { stop: () => void } | null;
  clickHandler: { canvas: HTMLCanvasElement; handler: (e: MouseEvent) => void } | null;
}

export default function D3Renderer({ dataLayer, onNodeClick }: D3RendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;

    let cancelled = false;
    const cleanup: CleanupHandles = { rafId: null, simulation: null, clickHandler: null };

    async function render() {
      const d3 = await import('d3');
      if (cancelled || !container) return;

      clearContainer(container);
      setLoading(false);

      const spec = dataLayer.d3_spec as Record<string, unknown> | undefined;
      const vizType = spec?.type as string | undefined;

      const width = Math.min(container.clientWidth, 8192);
      const height = Math.min(container.clientHeight, 8192);
      if (width < 1 || height < 1) return;

      try {
        if (vizType === 'geo_heatmap') {
          cleanup.rafId = renderGeoHeatmap(d3, container, dataLayer, width, height, () => cancelled);
        } else if (vizType === 'network') {
          cleanup.simulation = renderNetwork(d3, container, dataLayer, width, height, onNodeClick);
        } else {
          const handles = renderScatter(d3, container, dataLayer, width, height, onNodeClick);
          cleanup.rafId = handles.rafId;
          cleanup.clickHandler = handles.clickHandler;
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'D3 render failed');
      }
    }

    render();

    return () => {
      cancelled = true;
      if (cleanup.rafId !== null) cancelAnimationFrame(cleanup.rafId);
      cleanup.simulation?.stop();
      if (cleanup.clickHandler) {
        cleanup.clickHandler.canvas.removeEventListener('click', cleanup.clickHandler.handler);
      }
    };
  }, [dataLayer, onNodeClick]);

  return (
    <div
      style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '70vw',
        height: '70vh',
        zIndex: 5,
        background: 'transparent',
        pointerEvents: 'auto',
      }}
    >
      {loading && (
        <div style={statusStyle}>Loading visualization...</div>
      )}
      {error && (
        <div style={{ ...statusStyle, color: '#C4503C' }}>{error}</div>
      )}
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
}

const statusStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#5c5851',
  fontFamily: "'Courier Prime', monospace",
  fontSize: '12px',
};

/* Returns the last rAF id for cancellation */
function renderGeoHeatmap(
  d3: typeof import('d3'),
  container: HTMLDivElement,
  dataLayer: DataLayerSpec,
  width: number,
  height: number,
  isCancelled: () => boolean,
): number {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  container.appendChild(canvas);

  const ctx = canvas.getContext('2d')!;
  const projection = d3.geoNaturalEarth1().fitSize(
    [width, height],
    { type: 'Sphere' } as unknown as d3.GeoPermissibleObjects,
  );
  const colorScale = d3.scaleSequential(d3.interpolateYlOrRd).domain([0, 1]);

  const data = dataLayer.data as Array<Record<string, unknown>>;
  const xField = dataLayer.x_field;
  const yField = dataLayer.y_field;
  const valueField = dataLayer.value_field || 'value';

  let drawn = 0;
  let lastRafId = 0;

  function drawBatch() {
    if (isCancelled() || drawn >= data.length) return;
    const end = Math.min(drawn + POINTS_PER_FRAME, data.length);
    for (let i = drawn; i < end; i++) {
      const d = data[i];
      const point = projection([Number(d[xField]), Number(d[yField])]);
      if (!point) continue;
      ctx.fillStyle = colorScale(Number(d[valueField]) || 0);
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      ctx.arc(point[0], point[1], 3, 0, Math.PI * 2);
      ctx.fill();
    }
    drawn = end;
    if (drawn < data.length) lastRafId = requestAnimationFrame(drawBatch);
  }
  lastRafId = requestAnimationFrame(drawBatch);
  return lastRafId;
}

function renderNetwork(
  d3: typeof import('d3'),
  container: HTMLDivElement,
  dataLayer: DataLayerSpec,
  width: number,
  height: number,
  onNodeClick?: (id: string) => void,
): { stop: () => void } {
  const spec = dataLayer.d3_spec as Record<string, unknown> | undefined;
  const data = dataLayer.data as Array<Record<string, unknown>>;

  const nodes = ((spec?.nodes as unknown[]) || data.slice(0, Math.ceil(data.length / 2))).map(
    (d: unknown) => ({ ...(d as object) }),
  ) as Array<Record<string, unknown> & { x?: number; y?: number; id?: string }>;

  const links = ((spec?.links as unknown[]) || []).map(
    (d: unknown) => ({ ...(d as object) }),
  ) as Array<Record<string, unknown> & { source: string; target: string }>;

  const svg = d3
    .select(container)
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .style('width', '100%')
    .style('height', '100%');

  const simulation = d3
    .forceSimulation(nodes as d3.SimulationNodeDatum[])
    .force(
      'link',
      d3
        .forceLink(links as d3.SimulationLinkDatum<d3.SimulationNodeDatum>[])
        .id((d: d3.SimulationNodeDatum) => (d as Record<string, unknown>).id as string)
        .distance(60),
    )
    .force('charge', d3.forceManyBody().strength(-80))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('collision', d3.forceCollide(12));

  const link = svg
    .append('g')
    .selectAll('line')
    .data(links)
    .join('line')
    .attr('stroke', '#4A8A96')
    .attr('stroke-opacity', 0.4)
    .attr('stroke-width', 1);

  const node = svg
    .append('g')
    .selectAll('circle')
    .data(nodes)
    .join('circle')
    .attr('r', 6)
    .attr('fill', '#2D5F6B')
    .attr('stroke', '#e8e5e0')
    .attr('stroke-width', 0.5)
    .style('cursor', 'pointer')
    .on('click', (_event: MouseEvent, d: Record<string, unknown>) => {
      if (onNodeClick && d.id) onNodeClick(d.id as string);
    });

  node
    .append('title')
    .text((d: Record<string, unknown>) => (d.label || d.id || '') as string);

  simulation.on('tick', () => {
    link
      .attr('x1', (d: Record<string, unknown>) => ((d.source as Record<string, unknown>).x as number) || 0)
      .attr('y1', (d: Record<string, unknown>) => ((d.source as Record<string, unknown>).y as number) || 0)
      .attr('x2', (d: Record<string, unknown>) => ((d.target as Record<string, unknown>).x as number) || 0)
      .attr('y2', (d: Record<string, unknown>) => ((d.target as Record<string, unknown>).y as number) || 0);

    node
      .attr('cx', (d: Record<string, unknown>) => (d.x as number) || 0)
      .attr('cy', (d: Record<string, unknown>) => (d.y as number) || 0);
  });

  return simulation;
}

function renderScatter(
  d3: typeof import('d3'),
  container: HTMLDivElement,
  dataLayer: DataLayerSpec,
  width: number,
  height: number,
  onNodeClick?: (id: string) => void,
): { rafId: number; clickHandler: { canvas: HTMLCanvasElement; handler: (e: MouseEvent) => void } | null } {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  container.appendChild(canvas);

  const ctx = canvas.getContext('2d')!;
  const data = dataLayer.data as Array<Record<string, unknown>>;
  const xField = dataLayer.x_field;
  const yField = dataLayer.y_field;
  const valueField = dataLayer.value_field;

  const xExtent = d3.extent(data, (d) => Number(d[xField])) as [number, number];
  const yExtent = d3.extent(data, (d) => Number(d[yField])) as [number, number];
  const xScale = d3.scaleLinear().domain(xExtent).range([40, width - 20]);
  const yScale = d3.scaleLinear().domain(yExtent).range([height - 30, 20]);

  const colorScale = valueField
    ? d3.scaleSequential(d3.interpolateViridis).domain(
        d3.extent(data, (d) => Number(d[valueField])) as [number, number],
      )
    : () => '#4A8A96';

  let drawn = 0;
  let lastRafId = 0;

  function drawBatch() {
    if (drawn >= data.length) return;
    const end = Math.min(drawn + POINTS_PER_FRAME, data.length);
    for (let i = drawn; i < end; i++) {
      const d = data[i];
      const x = xScale(Number(d[xField]));
      const y = yScale(Number(d[yField]));
      ctx.fillStyle = (valueField ? colorScale(Number(d[valueField])) : '#4A8A96') as string;
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    drawn = end;
    if (drawn < data.length) lastRafId = requestAnimationFrame(drawBatch);
  }
  lastRafId = requestAnimationFrame(drawBatch);

  let clickHandler: { canvas: HTMLCanvasElement; handler: (e: MouseEvent) => void } | null = null;

  if (onNodeClick) {
    const handler = (event: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const mx = event.clientX - rect.left;
      const my = event.clientY - rect.top;

      let nearest: Record<string, unknown> | null = null;
      let minDist = Infinity;
      for (const d of data) {
        const px = xScale(Number(d[xField]));
        const py = yScale(Number(d[yField]));
        const dist = Math.sqrt((px - mx) ** 2 + (py - my) ** 2);
        if (dist < minDist && dist < 20) {
          minDist = dist;
          nearest = d;
        }
      }
      if (nearest?.id) onNodeClick(nearest.id as string);
    };
    canvas.addEventListener('click', handler);
    clickHandler = { canvas, handler };
  }

  return { rafId: lastRafId, clickHandler };
}
