'use client';

import { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';
import { NODE_COLORS } from '@/lib/graph/colors';
import GraphTooltip from '@/components/GraphTooltip';

interface DataPoint {
  month: string;
  cumulative: number;
}

interface WritingTimelineProps {
  data: DataPoint[];
}

export default function WritingTimeline({ data }: WritingTimelineProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [tooltipData, setTooltipData] = useState<{
    title: string; subtitle: string; lines: string[];
    position: { x: number; y: number }; visible: boolean;
  }>({ title: '', subtitle: '', lines: [], position: { x: 0, y: 0 }, visible: false });

  useEffect(() => {
    if (!svgRef.current || data.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = 800;
    const height = 240;
    const margin = { top: 20, right: 20, bottom: 30, left: 40 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const parseMonth = d3.timeParse('%Y-%m');
    const parsed = data.map((d) => ({
      date: parseMonth(d.month)!,
      value: d.cumulative,
    }));

    const x = d3.scaleTime()
      .domain(d3.extent(parsed, (d) => d.date) as [Date, Date])
      .range([0, innerW]);

    const y = d3.scaleLinear()
      .domain([0, d3.max(parsed, (d) => d.value) ?? 1])
      .nice()
      .range([innerH, 0]);

    const area = d3.area<typeof parsed[0]>()
      .x((d) => x(d.date))
      .y0(innerH)
      .y1((d) => y(d.value))
      .curve(d3.curveBasis);

    const line = d3.line<typeof parsed[0]>()
      .x((d) => x(d.date))
      .y((d) => y(d.value))
      .curve(d3.curveBasis);

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    // Area fill
    g.append('path')
      .datum(parsed)
      .attr('d', area)
      .attr('fill', NODE_COLORS.essay)
      .attr('fill-opacity', 0.12);

    // Line stroke
    g.append('path')
      .datum(parsed)
      .attr('d', line)
      .attr('fill', 'none')
      .attr('stroke', NODE_COLORS.essay)
      .attr('stroke-width', 1.5);

    // X axis
    g.append('g')
      .attr('transform', `translate(0,${innerH})`)
      .call(
        d3.axisBottom(x)
          .ticks(6)
          .tickFormat((d) => d3.timeFormat('%b %y')(d as Date))
      )
      .attr('font-size', '10px')
      .attr('font-family', 'var(--font-metadata)');

    // Y axis
    g.append('g')
      .call(d3.axisLeft(y).ticks(5))
      .attr('font-size', '10px')
      .attr('font-family', 'var(--font-metadata)');

    // Hover crosshair + tooltip
    const crosshairLine = g.append('line')
      .attr('y1', 0)
      .attr('y2', innerH)
      .attr('stroke', 'var(--color-ink-light)')
      .attr('stroke-width', 0.5)
      .attr('stroke-dasharray', '3 3')
      .attr('opacity', 0);

    const crosshairDot = g.append('circle')
      .attr('r', 4)
      .attr('fill', NODE_COLORS.essay)
      .attr('stroke', '#F0EBE4')
      .attr('stroke-width', 1.5)
      .attr('opacity', 0);

    const bisect = d3.bisector((d: typeof parsed[0]) => d.date).left;

    g.append('rect')
      .attr('width', innerW)
      .attr('height', innerH)
      .attr('fill', 'transparent')
      .on('mousemove', function (event) {
        const [mx] = d3.pointer(event);
        const dateAtCursor = x.invert(mx);
        const idx = bisect(parsed, dateAtCursor, 1);
        const d0 = parsed[idx - 1];
        const d1 = parsed[idx];
        if (!d0) return;
        const closest = d1 && (dateAtCursor.getTime() - d0.date.getTime() > d1.date.getTime() - dateAtCursor.getTime()) ? d1 : d0;

        const cx = x(closest.date);
        const cy = y(closest.value);

        crosshairLine.attr('x1', cx).attr('x2', cx).attr('opacity', 1);
        crosshairDot.attr('cx', cx).attr('cy', cy).attr('opacity', 1);

        const rect = svgRef.current!.getBoundingClientRect();
        const svgX = rect.width * ((margin.left + cx) / width);
        const svgY = rect.height * ((margin.top + cy) / height);
        const monthLabel = d3.timeFormat('%B %Y')(closest.date);
        setTooltipData({
          title: monthLabel,
          subtitle: `${closest.value} essay${closest.value !== 1 ? 's' : ''} cumulative`,
          lines: [],
          position: { x: svgX, y: svgY - 12 },
          visible: true,
        });
      })
      .on('mouseleave', function () {
        crosshairLine.attr('opacity', 0);
        crosshairDot.attr('opacity', 0);
        setTooltipData((prev) => ({ ...prev, visible: false }));
      });
  }, [data]);

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        className="w-full"
        viewBox="0 0 800 240"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Essay publication timeline"
      />
      <GraphTooltip {...tooltipData} />
    </div>
  );
}
