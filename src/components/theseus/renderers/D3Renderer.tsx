'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { SceneDirective } from '@/lib/theseus-viz/SceneDirective';
import { getDataBuildProgress, type ConstructionPlayback } from './rendering';

const POINTS_PER_SLICE = 500;

interface D3RendererProps {
  directive: SceneDirective;
  playback: ConstructionPlayback;
  onContextSelect?: (context: string) => void;
  onError?: (error: Error) => void;
}

interface TooltipState {
  x: number;
  y: number;
  label: string;
}

function clamp(value: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, value));
}

function getBucket(playback: ConstructionPlayback): number {
  return Math.floor(getDataBuildProgress(playback) * 20);
}

export default function D3Renderer({
  directive,
  playback,
  onContextSelect,
  onError,
}: D3RendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const progressBucket = getBucket(playback);
  const d3Spec = directive.render_target.d3_spec as Record<string, unknown> | undefined;

  const layoutStyle = useMemo(() => ({
    position: 'absolute' as const,
    left: '50%',
    top: '50%',
    transform: 'translate(-50%, -50%)',
    width: directive.context_shelf.enabled && directive.context_shelf.shelf_position === 'left'
      ? '72vw'
      : '70vw',
    height: directive.context_shelf.enabled && directive.context_shelf.shelf_position === 'top'
      ? '72vh'
      : '70vh',
    zIndex: 5,
    pointerEvents: 'auto' as const,
  }), [directive.context_shelf]);

  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | undefined;

    async function render() {
      if (!containerRef.current || !d3Spec) {
        return;
      }

      try {
        const d3 = await import('d3');
        if (cancelled || !containerRef.current) {
          return;
        }

        const container = containerRef.current;
        container.innerHTML = '';
        const width = container.clientWidth;
        const height = container.clientHeight;
        if (width < 1 || height < 1) {
          return;
        }

        const progress = clamp(getDataBuildProgress(playback));
        const type = typeof d3Spec.type === 'string' ? d3Spec.type : 'custom';

        switch (type) {
          case 'geo_heatmap':
            cleanup = renderGeoHeatmap(d3, container, d3Spec, width, height, progress, setTooltip, onContextSelect);
            break;
          case 'network':
            cleanup = renderNetwork(d3, container, d3Spec, width, height, progress, setTooltip, onContextSelect);
            break;
          case 'scatter_3d':
            cleanup = renderScatter3D(d3, container, d3Spec, width, height, progress, setTooltip, onContextSelect);
            break;
          default:
            cleanup = renderCustom(container, d3Spec);
            break;
        }

        setError(null);
      } catch (renderError) {
        const message = renderError instanceof Error ? renderError.message : 'Failed to render D3 view';
        setError(message);
        onError?.(renderError instanceof Error ? renderError : new Error(message));
      }
    }

    render();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [d3Spec, onContextSelect, onError, playback, progressBucket]);

  return (
    <div style={layoutStyle}>
      <div
        ref={containerRef}
        style={{
          width: '100%',
          height: '100%',
          background: 'transparent',
        }}
      />
      {tooltip && (
        <div
          style={{
            position: 'absolute',
            left: tooltip.x,
            top: tooltip.y,
            transform: 'translate(12px, -50%)',
            padding: '8px 10px',
            borderRadius: 10,
            background: 'rgba(15,16,18,0.92)',
            border: '1px solid rgba(255,255,255,0.08)',
            color: '#E8E5E0',
            fontFamily: 'var(--vie-font-body)',
            fontSize: 12,
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            zIndex: 6,
          }}
        >
          {tooltip.label}
        </div>
      )}
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

function renderGeoHeatmap(
  d3: typeof import('d3'),
  container: HTMLDivElement,
  spec: Record<string, unknown>,
  width: number,
  height: number,
  progress: number,
  setTooltip: (value: TooltipState | null) => void,
  onContextSelect?: (context: string) => void,
) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  container.appendChild(canvas);

  const context = canvas.getContext('2d');
  if (!context) {
    return undefined;
  }

  const projection = d3.geoNaturalEarth1().fitSize(
    [width, height],
    { type: 'Sphere' } as d3.GeoPermissibleObjects,
  );
  const points = Array.isArray(spec.points) ? spec.points as Array<Record<string, unknown>> : [];
  const drawCount = Math.min(points.length, Math.ceil(progress * points.length));
  const colorScale = d3.scaleSequential(d3.interpolateTurbo).domain([0, 1]);
  const indexed = points.slice(0, Math.min(drawCount, Math.ceil((progress * 4000) / POINTS_PER_SLICE) * POINTS_PER_SLICE));

  indexed.forEach((point) => {
    const lon = Number(point.lon);
    const lat = Number(point.lat);
    const projectionPoint = projection([lon, lat]);
    if (!projectionPoint) return;

    context.globalAlpha = 0.8;
    context.fillStyle = colorScale(Number(point.value) || 0);
    context.beginPath();
    context.arc(projectionPoint[0], projectionPoint[1], 4, 0, Math.PI * 2);
    context.fill();
  });

  const handleMove = (event: MouseEvent) => {
    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    let nearest: Record<string, unknown> | null = null;
    let minDistance = Infinity;

    indexed.forEach((point) => {
      const projectionPoint = projection([Number(point.lon), Number(point.lat)]);
      if (!projectionPoint) return;
      const distance = Math.hypot(projectionPoint[0] - mouseX, projectionPoint[1] - mouseY);
      if (distance < minDistance && distance < 18) {
        nearest = point;
        minDistance = distance;
      }
    });

    if (!nearest) {
      setTooltip(null);
      return;
    }

    const point = nearest as Record<string, unknown>;
    setTooltip({
      x: mouseX,
      y: mouseY,
      label: `Value: ${String(point.value ?? 'n/a')}`,
    });
  };

  const handleLeave = () => setTooltip(null);
  const handleClick = () => {
    if (indexed.length > 0) {
      onContextSelect?.(`Mapped ${indexed.length} geographic data points`);
    }
  };

  canvas.addEventListener('mousemove', handleMove);
  canvas.addEventListener('mouseleave', handleLeave);
  canvas.addEventListener('click', handleClick);

  return () => {
    canvas.removeEventListener('mousemove', handleMove);
    canvas.removeEventListener('mouseleave', handleLeave);
    canvas.removeEventListener('click', handleClick);
  };
}

function renderNetwork(
  d3: typeof import('d3'),
  container: HTMLDivElement,
  spec: Record<string, unknown>,
  width: number,
  height: number,
  progress: number,
  setTooltip: (value: TooltipState | null) => void,
  onContextSelect?: (context: string) => void,
) {
  type NetworkNode = d3.SimulationNodeDatum & Record<string, unknown>;
  type NetworkLink = d3.SimulationLinkDatum<NetworkNode> & Record<string, unknown>;

  const nodes = Array.isArray(spec.nodes)
    ? (spec.nodes as Array<Record<string, unknown>>).map((node) => ({ ...node })) as NetworkNode[]
    : [];
  const links = Array.isArray(spec.links)
    ? (spec.links as Array<Record<string, unknown>>).map((link) => ({ ...link })) as NetworkLink[]
    : [];

  const svg = d3
    .select(container)
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .style('width', '100%')
    .style('height', '100%');

  const linkSelection = svg
    .append('g')
    .selectAll('line')
    .data(links)
    .join('line')
    .attr('stroke', 'rgba(74,138,150,0.32)')
    .attr('stroke-width', 1.2)
    .attr('stroke-dasharray', '4 4');

  const visibleNodes = nodes.slice(0, Math.max(1, Math.ceil(nodes.length * progress)));
  const nodeSelection = svg
    .append('g')
    .selectAll('circle')
    .data(visibleNodes)
    .join('circle')
    .attr('r', 7)
    .attr('fill', '#2D5F6B')
    .attr('stroke', '#E8E5E0')
    .attr('stroke-width', 0.6)
    .style('cursor', 'pointer')
    .on('mouseenter', (event: MouseEvent, node: Record<string, unknown>) => {
      setTooltip({
        x: event.offsetX,
        y: event.offsetY,
        label: String(node.label ?? node.id ?? 'node'),
      });
    })
    .on('mouseleave', () => setTooltip(null))
    .on('click', (_event: MouseEvent, node: Record<string, unknown>) => {
      onContextSelect?.(String(node.label ?? node.id ?? 'node'));
    });

  const simulation = d3
    .forceSimulation(visibleNodes)
    .force(
      'link',
      d3.forceLink(links)
        .id((node: d3.SimulationNodeDatum) => String((node as NetworkNode).id))
        .distance(80),
    )
    .force('charge', d3.forceManyBody().strength(-120))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('collision', d3.forceCollide(18));

  simulation.on('tick', () => {
    linkSelection
      .attr('x1', (link: Record<string, unknown>) => ((link.source as Record<string, unknown>).x as number) || 0)
      .attr('y1', (link: Record<string, unknown>) => ((link.source as Record<string, unknown>).y as number) || 0)
      .attr('x2', (link: Record<string, unknown>) => ((link.target as Record<string, unknown>).x as number) || 0)
      .attr('y2', (link: Record<string, unknown>) => ((link.target as Record<string, unknown>).y as number) || 0);

    nodeSelection
      .attr('cx', (node: Record<string, unknown>) => (node.x as number) || 0)
      .attr('cy', (node: Record<string, unknown>) => (node.y as number) || 0);
  });

  return () => simulation.stop();
}

function renderScatter3D(
  d3: typeof import('d3'),
  container: HTMLDivElement,
  spec: Record<string, unknown>,
  width: number,
  height: number,
  progress: number,
  setTooltip: (value: TooltipState | null) => void,
  onContextSelect?: (context: string) => void,
) {
  const points = Array.isArray(spec.points) ? spec.points as Array<Record<string, unknown>> : [];
  const visiblePoints = points.slice(0, Math.max(1, Math.ceil(points.length * progress)));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  container.appendChild(canvas);

  const context = canvas.getContext('2d');
  if (!context) {
    return undefined;
  }

  const xExtent = d3.extent(visiblePoints, (point) => Number(point.x)) as [number, number];
  const yExtent = d3.extent(visiblePoints, (point) => Number(point.y)) as [number, number];
  const zExtent = d3.extent(visiblePoints, (point) => Number(point.z)) as [number, number];
  const xScale = d3.scaleLinear().domain(xExtent).range([48, width - 48]);
  const yScale = d3.scaleLinear().domain(yExtent).range([height - 48, 48]);
  const radiusScale = d3.scaleLinear().domain(zExtent).range([3, 8]);

  visiblePoints.forEach((point) => {
    context.beginPath();
    context.fillStyle = 'rgba(74,138,150,0.78)';
    context.arc(
      xScale(Number(point.x)),
      yScale(Number(point.y)),
      radiusScale(Number(point.z)),
      0,
      Math.PI * 2,
    );
    context.fill();
  });

  const handleMove = (event: MouseEvent) => {
    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    let nearest: Record<string, unknown> | null = null;
    let minDistance = Infinity;

    visiblePoints.forEach((point) => {
      const px = xScale(Number(point.x));
      const py = yScale(Number(point.y));
      const distance = Math.hypot(px - mouseX, py - mouseY);
      if (distance < minDistance && distance < 18) {
        nearest = point;
        minDistance = distance;
      }
    });

    if (!nearest) {
      setTooltip(null);
      return;
    }

    const point = nearest as Record<string, unknown>;
    setTooltip({
      x: mouseX,
      y: mouseY,
      label: String(point.label ?? `${point.x}, ${point.y}, ${point.z}`),
    });
  };

  const handleLeave = () => setTooltip(null);
  const handleClick = () => {
    if (visiblePoints.length > 0) {
      onContextSelect?.(String(visiblePoints[0].label ?? 'scatter data'));
    }
  };

  canvas.addEventListener('mousemove', handleMove);
  canvas.addEventListener('mouseleave', handleLeave);
  canvas.addEventListener('click', handleClick);

  return () => {
    canvas.removeEventListener('mousemove', handleMove);
    canvas.removeEventListener('mouseleave', handleLeave);
    canvas.removeEventListener('click', handleClick);
  };
}

function renderCustom(
  container: HTMLDivElement,
  spec: Record<string, unknown>,
) {
  const pre = document.createElement('pre');
  pre.textContent = JSON.stringify(spec, null, 2);
  pre.style.margin = '0';
  pre.style.padding = '16px';
  pre.style.borderRadius = '16px';
  pre.style.background = 'rgba(15,16,18,0.72)';
  pre.style.border = '1px solid rgba(255,255,255,0.06)';
  pre.style.color = '#E8E5E0';
  pre.style.font = '12px "Courier Prime", monospace';
  pre.style.maxHeight = '100%';
  pre.style.overflow = 'auto';
  container.appendChild(pre);
  return undefined;
}
