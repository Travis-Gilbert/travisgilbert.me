'use client';

/**
 * SourceConstellation: radial layout grouping sources by type.
 *
 * Arranges sources in concentric rings around a central content node,
 * with each ring representing a source type. Sources with more
 * connections sit closer to the center. The result looks like a
 * constellation diagram showing the gravitational pull of sources
 * toward content.
 *
 * Data comes from GET /api/v1/graph/ (same as SourceGraph).
 */

import { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';
import type { GraphResponse, GraphNode } from '@/lib/research';
import { fetchSourceGraph } from '@/lib/research';

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

const TYPE_LABELS: Record<string, string> = {
  book: 'Books',
  article: 'Articles',
  paper: 'Papers',
  video: 'Videos',
  podcast: 'Podcasts',
  dataset: 'Datasets',
  document: 'Documents',
  report: 'Reports',
  map: 'Maps',
  archive: 'Archives',
  interview: 'Interviews',
  website: 'Websites',
  other: 'Other',
};

interface ConstellationNode {
  id: string;
  label: string;
  sourceType: string;
  creator: string;
  connectionCount: number;
  angle: number;
  radius: number;
}

export default function SourceConstellation() {
  const svgRef = useRef<SVGSVGElement>(null);
  const [data, setData] = useState<GraphResponse | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [selected, setSelected] = useState<ConstellationNode | null>(null);
  const [dimensions, setDimensions] = useState({ width: 700, height: 700 });

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
        const w = container.clientWidth;
        const size = Math.min(w, 700);
        setDimensions({ width: size, height: size });
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

    // Group by source type
    const groups = new Map<string, GraphNode[]>();
    for (const node of sourceNodes) {
      const type = node.sourceType || 'other';
      if (!groups.has(type)) groups.set(type, []);
      groups.get(type)!.push(node);
    }

    const sortedTypes = [...groups.keys()].sort();
    const { width, height } = dimensions;
    const cx = width / 2;
    const cy = height / 2;
    const maxRadius = Math.min(width, height) / 2 - 60;
    const minRadius = 40;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const g = svg.append('g').attr('transform', `translate(${cx},${cy})`);

    // Concentric ring guides
    const ringCount = 4;
    for (let i = 1; i <= ringCount; i++) {
      const r = minRadius + ((maxRadius - minRadius) * i) / ringCount;
      g.append('circle')
        .attr('r', r)
        .attr('fill', 'none')
        .attr('stroke', 'var(--color-border-light)')
        .attr('stroke-dasharray', '2 4')
        .attr('opacity', 0.5);
    }

    // Center label
    g.append('text')
      .text('SOURCES')
      .attr('text-anchor', 'middle')
      .attr('dy', 4)
      .attr('font-family', 'var(--font-mono)')
      .attr('font-size', '10px')
      .attr('letter-spacing', '0.1em')
      .attr('fill', 'var(--color-ink-light)');

    // Place each type group as a wedge
    const angleStep = (2 * Math.PI) / sortedTypes.length;
    const constellation: ConstellationNode[] = [];

    sortedTypes.forEach((type, typeIdx) => {
      const nodes = groups.get(type)!;
      const baseAngle = typeIdx * angleStep - Math.PI / 2;

      // Sort by connection count (more connections = closer to center)
      const sorted = [...nodes].sort(
        (a, b) => (connectionCounts.get(b.id) || 0) - (connectionCounts.get(a.id) || 0)
      );

      // Type label at the outer ring
      const labelAngle = baseAngle;
      const labelR = maxRadius + 30;
      g.append('text')
        .text(TYPE_LABELS[type] || type)
        .attr('x', Math.cos(labelAngle) * labelR)
        .attr('y', Math.sin(labelAngle) * labelR)
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .attr('font-family', 'var(--font-mono)')
        .attr('font-size', '9px')
        .attr('fill', TYPE_COLORS[type] || '#6A5E52')
        .attr('letter-spacing', '0.05em')
        .attr('text-transform', 'uppercase');

      sorted.forEach((node, nodeIdx) => {
        const count = connectionCounts.get(node.id) || 1;
        // More connections = closer to center
        const radiusFraction = 1 - Math.min(count / 8, 0.8);
        const r = minRadius + radiusFraction * (maxRadius - minRadius);
        // Spread nodes within the type wedge
        const spread = angleStep * 0.6;
        const nodeAngle = baseAngle + (nodeIdx / Math.max(sorted.length - 1, 1) - 0.5) * spread;

        constellation.push({
          id: node.id,
          label: node.label,
          sourceType: type,
          creator: node.creator || '',
          connectionCount: count,
          angle: nodeAngle,
          radius: r,
        });
      });
    });

    // Draw source nodes
    const nodeGroups = g
      .selectAll<SVGGElement, ConstellationNode>('.constellation-node')
      .data(constellation)
      .join('g')
      .attr('class', 'constellation-node')
      .attr('transform', (d) => {
        const x = Math.cos(d.angle) * d.radius;
        const y = Math.sin(d.angle) * d.radius;
        return `translate(${x},${y})`;
      })
      .attr('cursor', 'pointer');

    nodeGroups
      .append('circle')
      .attr('r', (d) => Math.min(3 + d.connectionCount * 1.5, 10))
      .attr('fill', (d) => TYPE_COLORS[d.sourceType] || '#6A5E52')
      .attr('stroke', '#F0EBE4')
      .attr('stroke-width', 1)
      .attr('opacity', 0.8);

    // Connection lines to center (faint)
    nodeGroups
      .append('line')
      .attr('x1', 0)
      .attr('y1', 0)
      .attr('x2', (d) => -Math.cos(d.angle) * d.radius)
      .attr('y2', (d) => -Math.sin(d.angle) * d.radius)
      .attr('stroke', (d) => TYPE_COLORS[d.sourceType] || '#6A5E52')
      .attr('stroke-width', 0.5)
      .attr('stroke-opacity', 0.1);

    // Interactions
    nodeGroups
      .on('mouseenter', function (_, d) {
        d3.select(this).select('circle').attr('opacity', 1).attr('stroke-width', 2);
      })
      .on('mouseleave', function () {
        d3.select(this).select('circle').attr('opacity', 0.8).attr('stroke-width', 1);
      })
      .on('click', function (_, d) {
        setSelected(d);
      });

  }, [data, dimensions]);

  if (!loaded) {
    return (
      <div className="flex items-center justify-center h-[500px] text-ink-light font-mono text-sm">
        Loading constellation...
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
        className="rounded-lg border border-border bg-surface mx-auto"
      />

      {selected && (
        <div className="absolute top-4 right-4 w-64 bg-surface border border-border rounded-lg shadow-warm p-4 z-10">
          <div className="flex items-start justify-between mb-2">
            <span
              className="inline-block text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded"
              style={{
                backgroundColor: TYPE_COLORS[selected.sourceType] + '20',
                color: TYPE_COLORS[selected.sourceType],
              }}
            >
              {selected.sourceType}
            </span>
            <button
              onClick={() => setSelected(null)}
              className="text-ink-light hover:text-ink text-lg leading-none"
              aria-label="Close"
            >
              &times;
            </button>
          </div>
          <h3 className="font-title text-sm font-bold text-ink leading-tight">
            {selected.label}
          </h3>
          {selected.creator && (
            <p className="text-[11px] text-ink-light font-body-alt mt-0.5">{selected.creator}</p>
          )}
          <p className="text-[10px] font-mono text-ink-light mt-2">
            {selected.connectionCount} connection{selected.connectionCount !== 1 ? 's' : ''}
          </p>
        </div>
      )}
    </div>
  );
}
