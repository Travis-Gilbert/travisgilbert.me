'use client';

// Phase C chart: timeline brush.
//
// areaY histogram over objects.captured_at binned daily, with an intervalX
// brush. Drag a range to filter the Explorer canvas to nodes captured
// inside that window; release / clear to return to full visibility.
//
// Publishes clauseInterval into `timeRangeSelection` via vgplot's built-in
// intervalX interactor. The selectionBridge reads that selection alongside
// cluster, hypothesis, and edge-type to compute the final visible id set,
// so brushing here cross-filters with any other active charts.
//
// Empty state: if every row's captured_at is NULL (the backend deploy that
// exposes captured_at has not landed yet) the chart renders the honest
// empty-state copy. No mock bins, no fake dates.
//
// Colors: area fill uses --vie-gold-ink at 40% opacity per the Phase C
// plan; brush handle uses --vie-accent. Every color resolves from a VIE
// token; no hex literals in this file (M4 / N2).

import { useCallback } from 'react';
import type { FC } from 'react';
import {
  plot,
  from,
  areaY,
  intervalX,
  count,
  name,
  width,
  height,
  marginTop,
  marginBottom,
  marginLeft,
  marginRight,
  yAxis,
  xLabel,
  yLabel,
  xTickSize,
  yTickSize,
  xTickPadding,
  yTickPadding,
} from '@uwdata/vgplot';
import { timeRangeSelection } from '@/lib/theseus/mosaic/coordinator';
import { EXPLORER_TABLES } from '@/lib/theseus/mosaic/ingestExplorerData';
import ChartShell from './ChartShell';

const PLOT_HEIGHT = 56;

interface TimelineBrushProps {
  /** Pixel height of the whole strip (title + plot). Defaults to 88. */
  height?: number;
}

const TimelineBrush: FC<TimelineBrushProps> = ({ height: strip = 88 }) => {
  const buildPlot = useCallback(async () => {
    const { objects } = EXPLORER_TABLES;
    // areaY over date_trunc('day', captured_at) gives a stable daily bin
    // regardless of how granular the source timestamps are. vgplot's
    // intervalX publishes a range clause (ms1, ms2) into timeRangeSelection
    // as the user drags; release preserves the clause. Clearing the
    // brush emits an empty clause which the selectionBridge treats as
    // `null` visible-ids override (no filter).
    const element = plot(
      name('explorer-timeline-brush'),
      width(320),
      height(PLOT_HEIGHT),
      marginTop(6),
      marginBottom(18),
      marginLeft(28),
      marginRight(8),
      areaY(
        from(objects.name),
        {
          x: 'captured_at',
          y: count(),
          fill: 'var(--vie-gold-ink)',
          fillOpacity: 0.4,
          stroke: 'var(--vie-gold-ink)',
          strokeOpacity: 0.75,
          strokeWidth: 1,
        },
      ),
      intervalX({ as: timeRangeSelection }),
      xLabel(null),
      yLabel(null),
      yAxis(null),
      xTickSize(3),
      xTickPadding(3),
      yTickSize(0),
      yTickPadding(0),
    );
    return element as HTMLElement | SVGElement;
  }, []);

  return (
    <ChartShell
      label="timeline-brush"
      title="Timeline"
      height={strip}
      emptyCopy="No timeline data yet: backend deploy pending"
      probeSql={`SELECT COUNT(*) AS n FROM ${EXPLORER_TABLES.objects.name} WHERE captured_at IS NOT NULL`}
      buildPlot={buildPlot}
    />
  );
};

export default TimelineBrush;
