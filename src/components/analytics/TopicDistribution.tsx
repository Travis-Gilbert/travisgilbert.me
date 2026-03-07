'use client';

import { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';
import { CHART_SERIES } from '@/lib/graph/colors';
import GraphTooltip from '@/components/GraphTooltip';

interface TagData {
  tag: string;
  count: number;
}

interface TopicDistributionProps {
  data: TagData[];
}

export default function TopicDistribution({ data }: TopicDistributionProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [tooltipData, setTooltipData] = useState<{
    title: string; subtitle: string; lines: string[];
    position: { x: number; y: number }; visible: boolean;
  }>({ title: '', subtitle: '', lines: [], position: { x: 0, y: 0 }, visible: false });

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
      .attr('fill', (_, i) => CHART_SERIES[i % CHART_SERIES.length])
      .attr('fill-opacity', 0.15)
      .attr('stroke', (_, i) => CHART_SERIES[i % CHART_SERIES.length])
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

    // Hover interactions
    cell.attr('cursor', 'pointer')
      .on('mouseenter', function (event, d) {
        d3.select(this).select('rect').attr('fill-opacity', 0.3).attr('stroke-opacity', 0.7);
        const rect = svgRef.current!.getBoundingClientRect();
        const total = leaves.reduce((sum, l) => sum + l.data.count, 0);
        const pct = total > 0 ? ((d.data.count / total) * 100).toFixed(1) : '0';
        setTooltipData({
          title: d.data.tag,
          subtitle: `${d.data.count} occurrence${d.data.count !== 1 ? 's' : ''}`,
          lines: [`${pct}% of total`],
          position: { x: event.clientX - rect.left, y: event.clientY - rect.top - 12 },
          visible: true,
        });
      })
      .on('mouseleave', function () {
        d3.select(this).select('rect').attr('fill-opacity', 0.15).attr('stroke-opacity', 0.4);
        setTooltipData((prev) => ({ ...prev, visible: false }));
      });
  }, [data]);

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        className="w-full"
        viewBox="0 0 800 300"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Topic distribution treemap"
      />
      <GraphTooltip {...tooltipData} />
    </div>
  );
}
