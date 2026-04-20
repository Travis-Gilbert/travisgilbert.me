'use client';

// Phase C chart: edge-type histogram.
//
// Bar chart of edge counts grouped by edges.edge_type. Click a bar to
// filter the Explorer canvas to that edge type; Shift+click multi-selects
// via vgplot's built-in toggleX interactor.
//
// The interactor publishes `clausePoint` into `edgeTypeSelection` on click
// and retracts on the same bar's second click. When the selection has at
// least one clause, the Explorer's selectionBridge LEFT JOINs the edges
// table so only nodes incident to a matching edge stay visible. When the
// selection goes idle, the canvas returns to full visibility.
//
// Colors: bar fill is --vie-terra-ink at 65% opacity (per plan). Tokens
// resolve at render time; no hex anywhere in this file (M4 / N2).

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
  xTickRotate,
  xTickSize,
  yTickSize,
  xTickPadding,
  yTickPadding,
} from '@uwdata/vgplot';
import { edgeTypeSelection } from '@/lib/theseus/mosaic/coordinator';
import { EXPLORER_TABLES } from '@/lib/theseus/mosaic/ingestExplorerData';
import ChartShell from './ChartShell';

const PLOT_HEIGHT = 56;

interface EdgeTypeHistogramProps {
  /** Pixel height of the whole strip (title + plot). Defaults to 88. */
  height?: number;
}

const EdgeTypeHistogram: FC<EdgeTypeHistogramProps> = ({ height: strip = 88 }) => {
  const buildPlot = useCallback(async () => {
    const { edges } = EXPLORER_TABLES;
    // rectY with `y: count()` aggregates by edge_type in the SQL plan
    // (count() comes from @uwdata/vgplot; the older `{ count: {} }`
    // shorthand was dropped in vgplot 0.24.2). toggleX publishes a point
    // clause into edgeTypeSelection for each bar clicked; Shift+click
    // accumulates. Re-clicking a selected bar retracts its clause.
    const element = plot(
      name('explorer-edge-type-histogram'),
      width(320),
      height(PLOT_HEIGHT),
      marginTop(6),
      marginBottom(22),
      marginLeft(28),
      marginRight(8),
      rectY(
        from(edges.name),
        {
          x: 'edge_type',
          y: count(),
          fill: 'var(--vie-terra-ink)',
          fillOpacity: 0.65,
          inset: 0.5,
        },
      ),
      toggleX({ as: edgeTypeSelection }),
      xLabel(null),
      yLabel(null),
      yAxis(null),
      xTickRotate(-30),
      xTickSize(3),
      xTickPadding(3),
      yTickSize(0),
      yTickPadding(0),
    );
    return element as HTMLElement | SVGElement;
  }, []);

  return (
    <ChartShell
      label="edge-type-histogram"
      title="Edge types"
      height={strip}
      emptyCopy="No edges yet"
      probeSql={`SELECT COUNT(*) AS n FROM ${EXPLORER_TABLES.edges.name} WHERE edge_type IS NOT NULL`}
      buildPlot={buildPlot}
    />
  );
};

export default EdgeTypeHistogram;
