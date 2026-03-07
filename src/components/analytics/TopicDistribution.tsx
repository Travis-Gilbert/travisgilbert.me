'use client';

import { useRef, useEffect } from 'react';
import * as d3 from 'd3';

interface TagData {
  tag: string;
  count: number;
}

interface TopicDistributionProps {
  data: TagData[];
}

const COLORS = ['#B45A2D', '#2D5F6B', '#C49A4A', '#5A7A4A'];

export default function TopicDistribution({ data }: TopicDistributionProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (!svgRef.current || data.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = 800;
    const height = 300;

    const root = d3.hierarchy({ children: data } as { children: TagData[] })
      .sum((d: unknown) => (d as TagData).count ?? 0);

    d3.treemap<{ children: TagData[] }>()
      .size([width, height])
      .padding(2)(root as d3.HierarchyNode<{ children: TagData[] }>);

    const leaves = (root as d3.HierarchyNode<{ children: TagData[] }>).leaves() as (d3.HierarchyRectangularNode<unknown> & { data: TagData })[];

    const g = svg.append('g');

    const cell = g.selectAll('g')
      .data(leaves)
      .join('g')
      .attr('transform', (d) => `translate(${d.x0},${d.y0})`);

    cell.append('rect')
      .attr('width', (d) => d.x1 - d.x0)
      .attr('height', (d) => d.y1 - d.y0)
      .attr('fill', (_, i) => COLORS[i % COLORS.length])
      .attr('fill-opacity', 0.15)
      .attr('stroke', (_, i) => COLORS[i % COLORS.length])
      .attr('stroke-opacity', 0.4)
      .attr('rx', 2);

    cell.append('text')
      .attr('x', 4)
      .attr('y', 14)
      .attr('font-size', '10px')
      .attr('font-family', 'var(--font-metadata)')
      .attr('fill', 'var(--color-ink)')
      .text((d) => {
        const w = d.x1 - d.x0;
        return w > 50 ? `${d.data.tag} (${d.data.count})` : '';
      });
  }, [data]);

  return (
    <svg
      ref={svgRef}
      className="w-full"
      viewBox="0 0 800 300"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="Topic distribution treemap"
    />
  );
}
