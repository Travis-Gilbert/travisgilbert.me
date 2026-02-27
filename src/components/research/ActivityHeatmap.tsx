'use client';

/**
 * ActivityHeatmap: calendar heatmap of research activity.
 *
 * Displays a GitHub-style contribution grid showing daily research
 * activity (sources added, links created, thread entries) over the
 * past year. Each cell is one day; color intensity maps to total
 * activity count.
 *
 * Data comes from GET /api/v1/activity/?days=365.
 */

import { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';
import type { ActivityDay } from '@/lib/research';
import { fetchResearchActivity } from '@/lib/research';

const CELL_SIZE = 13;
const CELL_GAP = 2;
const CELL_TOTAL = CELL_SIZE + CELL_GAP;

// Warm brand-tinted heatmap scale (parchment to terracotta)
const COLOR_EMPTY = '#E8E0D6';
const COLOR_SCALE = ['#D4C4B0', '#C49A4A', '#B4783A', '#B45A2D'];

const DAY_LABELS = ['', 'Mon', '', 'Wed', '', 'Fri', ''];
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface HeatmapCell {
  date: Date;
  dateStr: string;
  total: number;
  sources: number;
  links: number;
  entries: number;
  weekIndex: number;
  dayIndex: number;
}

export default function ActivityHeatmap() {
  const svgRef = useRef<SVGSVGElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; cell: HeatmapCell } | null>(null);
  const [activity, setActivity] = useState<ActivityDay[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetchResearchActivity(365).then((data) => {
      if (cancelled) return;
      setActivity(data);
      setLoaded(true);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    // Build activity lookup
    const activityMap = new Map<string, ActivityDay>();
    for (const day of activity) {
      activityMap.set(day.date, day);
    }

    // Generate 365 days of cells
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - 364);
    // Align to Sunday
    startDate.setDate(startDate.getDate() - startDate.getDay());

    const cells: HeatmapCell[] = [];
    const current = new Date(startDate);
    let weekIndex = 0;

    while (current <= today) {
      const dayIndex = current.getDay();
      const dateStr = current.toISOString().slice(0, 10);
      const act = activityMap.get(dateStr);

      cells.push({
        date: new Date(current),
        dateStr,
        total: act ? act.sources + act.links + act.entries : 0,
        sources: act?.sources ?? 0,
        links: act?.links ?? 0,
        entries: act?.entries ?? 0,
        weekIndex,
        dayIndex,
      });

      current.setDate(current.getDate() + 1);
      if (current.getDay() === 0) {
        weekIndex++;
      }
    }

    const numWeeks = weekIndex + 1;
    const marginLeft = 32;
    const marginTop = 20;
    const width = marginLeft + numWeeks * CELL_TOTAL + 10;
    const height = marginTop + 7 * CELL_TOTAL + 30;

    svg.attr('width', width).attr('height', height);

    const maxTotal = d3.max(cells, (d) => d.total) || 1;
    const colorScale = d3
      .scaleQuantize<string>()
      .domain([1, Math.max(maxTotal, 4)])
      .range(COLOR_SCALE);

    const g = svg.append('g').attr('transform', `translate(${marginLeft},${marginTop})`);

    // Day labels (Mon, Wed, Fri)
    g.selectAll('.day-label')
      .data(DAY_LABELS)
      .join('text')
      .attr('class', 'day-label')
      .attr('x', -8)
      .attr('y', (_, i) => i * CELL_TOTAL + CELL_SIZE / 2)
      .attr('text-anchor', 'end')
      .attr('dominant-baseline', 'middle')
      .attr('font-family', 'var(--font-mono)')
      .attr('font-size', '9px')
      .attr('fill', 'var(--color-ink-light)')
      .text((d) => d);

    // Month labels
    const monthBreaks: Array<{ month: number; week: number }> = [];
    let lastMonth = -1;
    for (const cell of cells) {
      const month = cell.date.getMonth();
      if (month !== lastMonth && cell.dayIndex === 0) {
        monthBreaks.push({ month, week: cell.weekIndex });
        lastMonth = month;
      }
    }

    g.selectAll('.month-label')
      .data(monthBreaks)
      .join('text')
      .attr('class', 'month-label')
      .attr('x', (d) => d.week * CELL_TOTAL)
      .attr('y', -6)
      .attr('font-family', 'var(--font-mono)')
      .attr('font-size', '9px')
      .attr('fill', 'var(--color-ink-light)')
      .text((d) => MONTH_LABELS[d.month]);

    // Cells
    const cellSelection = g
      .selectAll<SVGRectElement, HeatmapCell>('.cell')
      .data(cells)
      .join('rect')
      .attr('class', 'cell')
      .attr('x', (d) => d.weekIndex * CELL_TOTAL)
      .attr('y', (d) => d.dayIndex * CELL_TOTAL)
      .attr('width', CELL_SIZE)
      .attr('height', CELL_SIZE)
      .attr('rx', 2)
      .attr('fill', (d) => (d.total === 0 ? COLOR_EMPTY : colorScale(d.total)))
      .attr('stroke', '#F0EBE4')
      .attr('stroke-width', 1)
      .attr('cursor', 'pointer');

    cellSelection
      .on('mouseenter', function (event, d) {
        d3.select(this).attr('stroke', 'var(--color-ink-light)').attr('stroke-width', 2);
        const rect = svgRef.current!.getBoundingClientRect();
        setTooltip({
          x: event.clientX - rect.left,
          y: event.clientY - rect.top - 8,
          cell: d,
        });
      })
      .on('mouseleave', function () {
        d3.select(this).attr('stroke', '#F0EBE4').attr('stroke-width', 1);
        setTooltip(null);
      });

    // Legend
    const legendY = 7 * CELL_TOTAL + 16;
    const legendColors = [COLOR_EMPTY, ...COLOR_SCALE];

    g.append('text')
      .attr('x', 0)
      .attr('y', legendY + CELL_SIZE / 2)
      .attr('dominant-baseline', 'middle')
      .attr('font-family', 'var(--font-mono)')
      .attr('font-size', '9px')
      .attr('fill', 'var(--color-ink-light)')
      .text('Activity:');

    legendColors.forEach((color, i) => {
      g.append('rect')
        .attr('x', 56 + i * (CELL_SIZE + 2))
        .attr('y', legendY)
        .attr('width', CELL_SIZE)
        .attr('height', CELL_SIZE)
        .attr('rx', 2)
        .attr('fill', color)
        .attr('stroke', '#F0EBE4')
        .attr('stroke-width', 1);
    });

    g.append('text')
      .attr('x', 56 - 4)
      .attr('y', legendY + CELL_SIZE + 12)
      .attr('font-family', 'var(--font-mono)')
      .attr('font-size', '8px')
      .attr('fill', 'var(--color-ink-light)')
      .text('Less');

    g.append('text')
      .attr('x', 56 + legendColors.length * (CELL_SIZE + 2) - 10)
      .attr('y', legendY + CELL_SIZE + 12)
      .attr('font-family', 'var(--font-mono)')
      .attr('font-size', '8px')
      .attr('fill', 'var(--color-ink-light)')
      .text('More');

  }, [activity, loaded]);

  if (!loaded) {
    return (
      <div className="flex items-center justify-center h-[200px] text-ink-light font-mono text-sm">
        Loading activity data...
      </div>
    );
  }

  return (
    <div className="relative overflow-x-auto">
      <svg
        ref={svgRef}
        className="rounded-lg border border-border bg-surface"
      />

      {tooltip && (
        <div
          className="absolute pointer-events-none bg-surface border border-border rounded-md shadow-warm px-3 py-2 z-10 whitespace-nowrap"
          style={{
            left: tooltip.x,
            top: tooltip.y,
            transform: 'translate(-50%, -100%)',
          }}
        >
          <p className="font-mono text-[11px] text-ink font-bold">
            {new Date(tooltip.cell.dateStr + 'T12:00:00').toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </p>
          {tooltip.cell.total === 0 ? (
            <p className="text-[10px] text-ink-light font-mono">No activity</p>
          ) : (
            <div className="text-[10px] font-mono text-ink-muted mt-0.5 space-y-0.5">
              {tooltip.cell.sources > 0 && (
                <p>
                  <span className="inline-block w-2 h-2 rounded-full mr-1" style={{ backgroundColor: '#2D5F6B' }} />
                  {tooltip.cell.sources} source{tooltip.cell.sources !== 1 ? 's' : ''} added
                </p>
              )}
              {tooltip.cell.links > 0 && (
                <p>
                  <span className="inline-block w-2 h-2 rounded-full mr-1" style={{ backgroundColor: '#C49A4A' }} />
                  {tooltip.cell.links} link{tooltip.cell.links !== 1 ? 's' : ''} created
                </p>
              )}
              {tooltip.cell.entries > 0 && (
                <p>
                  <span className="inline-block w-2 h-2 rounded-full mr-1" style={{ backgroundColor: '#5A7A4A' }} />
                  {tooltip.cell.entries} thread entr{tooltip.cell.entries !== 1 ? 'ies' : 'y'}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
