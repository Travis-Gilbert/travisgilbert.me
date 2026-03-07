'use client';

import { useRef, useEffect } from 'react';
import * as d3 from 'd3';

interface DataPoint {
  month: string;
  cumulative: number;
}

interface WritingTimelineProps {
  data: DataPoint[];
}

export default function WritingTimeline({ data }: WritingTimelineProps) {
  const svgRef = useRef<SVGSVGElement>(null);

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
      .attr('fill', '#B45A2D')
      .attr('fill-opacity', 0.12);

    // Line stroke
    g.append('path')
      .datum(parsed)
      .attr('d', line)
      .attr('fill', 'none')
      .attr('stroke', '#B45A2D')
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
  }, [data]);

  return (
    <svg
      ref={svgRef}
      className="w-full"
      viewBox="0 0 800 240"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="Essay publication timeline"
    />
  );
}
