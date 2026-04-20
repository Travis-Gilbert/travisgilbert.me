'use client';

// Phase C chart: community strip.
//
// Bar chart of node counts grouped by leiden_community from the `objects`
// table. Click a bar to filter the canvas to that community. Shift+click
// multi-selects via vgplot's toggleX.
//
// Publishes clausePoint into `clusterSelection`. The selectionBridge reads
// that selection alongside timeRange and hypothesis to compute the final
// visible id set, so clicks here cross-filter with timeline brushes.
//
// Empty state: if every row's leiden_community is NULL (community
// detection has not yet run on the active graph), the chart renders its
// honest empty-state copy. No mock bars, no fake clusters.

import { useCallback } from 'react';
import type { FC } from 'react';
import {
  plot,
  from,
  rectY,
  toggleX,
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
import { clusterSelection } from '@/lib/theseus/mosaic/coordinator';
import { EXPLORER_TABLES } from '@/lib/theseus/mosaic/ingestExplorerData';
import ChartShell from './ChartShell';

const PLOT_HEIGHT = 56;

interface CommunityStripProps {
  height?: number;
}

const CommunityStrip: FC<CommunityStripProps> = ({ height: strip = 88 }) => {
  const buildPlot = useCallback(async () => {
    const { objects } = EXPLORER_TABLES;
    const element = plot(
      name('explorer-community-strip'),
      width(320),
      height(PLOT_HEIGHT),
      marginTop(6),
      marginBottom(18),
      marginLeft(28),
      marginRight(8),
      rectY(
        from(objects.name),
        {
          // Coerce to VARCHAR so the x scale renders bars at discrete
          // categorical positions and the clause carries a matching
          // literal for the selectionBridge SQL.
          x: 'leiden_community',
          y: count(),
          fill: 'var(--vie-teal-ink)',
          fillOpacity: 0.65,
          inset: 0.5,
        },
      ),
      toggleX({ as: clusterSelection }),
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
      label="community-strip"
      title="Communities"
      height={strip}
      emptyCopy="No communities yet: backend deploy pending"
      probeSql={`SELECT COUNT(*) AS n FROM ${EXPLORER_TABLES.objects.name} WHERE leiden_community IS NOT NULL`}
      buildPlot={buildPlot}
    />
  );
};

export default CommunityStrip;
