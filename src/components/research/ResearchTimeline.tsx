'use client';

/**
 * ResearchTimeline: horizontal timeline of source encounters.
 *
 * Displays sources along a time axis based on their dateEncountered
 * or creation date, grouped by source type. Sources are positioned
 * by date on the X axis and stacked by type on the Y axis.
 *
 * Data comes from GET /api/v1/graph/ (reuses the graph endpoint
 * since it includes source metadata).
 */

import { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';
import type { GraphResponse, GraphNode } from '@/lib/research';
import { fetchSourceGraph } from '@/lib/research';

// Brand colors by source type (shared with SourceGraph)
const TYPE_COLORS: Record<string, string> = {
  book: '#C49A4A',
  article: '#B45A2D',
  paper: '#6B4A8A',
  video: '#A44A3A',
  podcast: '#5A7A4A',
  dataset: '#2D5F6B',
  document: '#8A7A5A',
  report: '#5A6A7A',
  map: '#4A7A5A',
  archive: '#7A6A4A',
  interview: '#6A5A7A',
  website: '#5A7A8A',
  other: '#6A5E52',
  essay: '#B45A2D',
  field_note: '#2D5F6B',
};

interface TimelineNode {
  id: string;
  label: string;
  type: string;
  sourceType: string;
  creator: string;
  connectionCount: number;
}

export default function ResearchTimeline() {
  const svgRef = useRef<SVGSVGElement>(null);
  const [data, setData] = useState<GraphResponse | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; node: TimelineNode } | null>(null);
  const [dimensions, setDimensions] = useState({ width: 900, height: 400 });

  useEffect(() => {
    let cancelled = false;
    fetchSourceGraph().then((d) => {
      if (cancelled) return;
      setData(d);
      setLoaded(true);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const updateSize = () => {
      const container = svgRef.current?.parentElement;
      if (container) {
        setDimensions({
          width: container.clientWidth,
          height: Math.max(300, Math.min(container.clientWidth * 0.45, 450)),
        });
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  useEffect(() => {
    if (!data || !svgRef.current) return;

    const sourceNodes = data.nodes.filter((n) => n.type === 'source');
    if (sourceNodes.length === 0) return;

    // Count connections per source
    const connectionCounts = new Map<string, number>();
    for (const edge of data.edges) {
      connectionCounts.set(edge.source, (connectionCounts.get(edge.source) || 0) + 1);
      connectionCounts.set(edge.target, (connectionCounts.get(edge.target) || 0) + 1);
    }

    // Get unique source types for Y axis
    const sourceTypes = [...new Set(sourceNodes.map((n) => n.sourceType || 'other'))].sort();

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const { width, height } = dimensions;
    const margin = { top: 24, right: 40, bottom: 40, left: 90 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    // X scale: distribute nodes evenly (no real dates, use index)
    const xScale = d3.scaleLinear().domain([0, sourceNodes.length - 1]).range([0, innerWidth]);

    // Y scale: source type bands
    const yScale = d3.scaleBand().domain(sourceTypes).range([0, innerHeight]).padding(0.3);

    // Y axis
    g.append('g')
      .call(d3.axisLeft(yScale))
      .selectAll('text')
      .attr('font-family', 'var(--font-mono)')
      .attr('font-size', '10px')
      .attr('fill', 'var(--color-ink-light)');

    g.selectAll('.domain, .tick line').attr('stroke', 'var(--color-border)');

    // Horizontal grid lines
    g.selectAll('.grid-line')
      .data(sourceTypes)
      .join('line')
      .attr('class', 'grid-line')
      .attr('x1', 0)
      .attr('x2', innerWidth)
      .attr('y1', (d) => (yScale(d) ?? 0) + yScale.bandwidth() / 2)
      .attr('y2', (d) => (yScale(d) ?? 0) + yScale.bandwidth() / 2)
      .attr('stroke', 'var(--color-border-light)')
      .attr('stroke-dasharray', '3 3');

    // Timeline baseline
    g.append('line')
      .attr('x1', 0)
      .attr('x2', innerWidth)
      .attr('y1', innerHeight + 12)
      .attr('y2', innerHeight + 12)
      .attr('stroke', 'var(--color-border)')
      .attr('stroke-width', 2);

    // Source dots
    const nodeGroups = g
      .selectAll<SVGGElement, GraphNode>('.source-node')
      .data(sourceNodes)
      .join('g')
      .attr('class', 'source-node')
      .attr('transform', (d, i) => {
        const x = xScale(i);
        const y = (yScale(d.sourceType || 'other') ?? 0) + yScale.bandwidth() / 2;
        return `translate(${x},${y})`;
      })
      .attr('cursor', 'pointer');

    nodeGroups
      .append('circle')
      .attr('r', (d) => {
        const count = connectionCounts.get(d.id) || 1;
        return Math.min(4 + count * 2, 12);
      })
      .attr('fill', (d) => TYPE_COLORS[d.sourceType || 'other'] || '#6A5E52')
      .attr('stroke', '#F0EBE4')
      .attr('stroke-width', 1.5)
      .attr('opacity', 0.85);

    // Hover interactions
    nodeGroups
      .on('mouseenter', function (event, d) {
        d3.select(this).select('circle').attr('opacity', 1).attr('stroke-width', 2.5);
        const rect = svgRef.current!.getBoundingClientRect();
        setTooltip({
          x: event.clientX - rect.left,
          y: event.clientY - rect.top - 12,
          node: {
            id: d.id,
            label: d.label,
            type: d.type,
            sourceType: d.sourceType || 'other',
            creator: d.creator || '',
            connectionCount: connectionCounts.get(d.id) || 0,
          },
        });
      })
      .on('mouseleave', function () {
        d3.select(this).select('circle').attr('opacity', 0.85).attr('stroke-width', 1.5);
        setTooltip(null);
      });

  }, [data, dimensions]);

  if (!loaded) {
    return (
      <div className="flex items-center justify-center h-[300px] text-ink-light font-mono text-sm">
        Loading timeline...
      </div>
    );
  }

  if (!data || data.nodes.filter((n) => n.type === 'source').length === 0) {
    return (
      <div className="flex items-center justify-center h-[200px] text-ink-light font-body-alt text-sm">
        No sources to display yet.
      </div>
    );
  }

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        width={dimensions.width}
        height={dimensions.height}
        className="rounded-lg border border-border bg-surface"
      />

      {tooltip && (
        <div
          className="absolute pointer-events-none bg-surface border border-border rounded-md shadow-warm px-3 py-2 z-10"
          style={{
            left: tooltip.x,
            top: tooltip.y,
            transform: 'translate(-50%, -100%)',
          }}
        >
          <p className="font-title text-sm font-bold text-ink leading-tight">
            {tooltip.node.label}
          </p>
          {tooltip.node.creator && (
            <p className="text-[11px] text-ink-light font-body-alt">{tooltip.node.creator}</p>
          )}
          <p className="text-[10px] font-mono text-ink-light mt-1">
            <span
              className="inline-block w-2 h-2 rounded-full mr-1"
              style={{ backgroundColor: TYPE_COLORS[tooltip.node.sourceType] }}
            />
            {tooltip.node.sourceType} · {tooltip.node.connectionCount} connection{tooltip.node.connectionCount !== 1 ? 's' : ''}
          </p>
        </div>
      )}
    </div>
  );
}
