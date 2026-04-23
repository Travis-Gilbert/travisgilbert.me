'use client';

import {
  count,
  from,
  height,
  intervalX,
  marginBottom,
  marginLeft,
  marginRight,
  marginTop,
  name,
  plot,
  rectY,
  ruleY,
  width,
  xLabel,
  xTickPadding,
  xTickRotate,
  xTickSize,
  yAxis,
  yLabel,
  yTickPadding,
  yTickSize,
} from '@uwdata/vgplot';
import { simulationBrushSelection } from './coordinator';
import { SIMULATION_TABLES_FOR } from './ingestSimulationPrimitives';

const BUDGET_PLOT_HEIGHT = 120;
const HISTOGRAM_PLOT_HEIGHT = 120;

export async function buildBudgetChart(
  sceneId: string,
  slot: string,
  constraintLimit: number | null,
): Promise<HTMLElement | SVGElement> {
  const table = SIMULATION_TABLES_FOR(sceneId).metricBySlot(slot);
  const marks: Array<(plotInstance: unknown) => void> = [
    rectY(
      from(table.name),
      {
        x: 'primitive_id',
        y: 'value',
        fill: 'var(--vie-gold-ink)',
        fillOpacity: 0.68,
        inset: 0.5,
      },
    ),
  ];
  if (typeof constraintLimit === 'number' && Number.isFinite(constraintLimit)) {
    marks.push(
      ruleY([constraintLimit], {
        stroke: 'var(--paper-pencil)',
        strokeOpacity: 0.9,
        strokeWidth: 1,
      }),
    );
  }

  const element = plot(
    name(`simulation-budget-${sceneId}-${slot}`),
    width(320),
    height(BUDGET_PLOT_HEIGHT),
    marginTop(6),
    marginBottom(30),
    marginLeft(34),
    marginRight(8),
    ...marks,
    xLabel(null),
    yLabel(null),
    yAxis(null),
    xTickRotate(-28),
    xTickSize(3),
    xTickPadding(3),
    yTickSize(0),
    yTickPadding(0),
  );
  return element as HTMLElement | SVGElement;
}

export async function buildMetadataHistogram(
  sceneId: string,
  slot: string,
): Promise<HTMLElement | SVGElement> {
  const table = SIMULATION_TABLES_FOR(sceneId).metricBySlot(slot);
  const element = plot(
    name(`simulation-histogram-${sceneId}-${slot}`),
    width(320),
    height(HISTOGRAM_PLOT_HEIGHT),
    marginTop(6),
    marginBottom(24),
    marginLeft(34),
    marginRight(8),
    rectY(
      from(table.name),
      {
        x: 'value',
        y: count(),
        fill: 'var(--vie-teal-ink)',
        fillOpacity: 0.64,
        inset: 0.5,
      },
    ),
    intervalX({ as: simulationBrushSelection }),
    xLabel(null),
    yLabel(null),
    yAxis(null),
    xTickSize(3),
    xTickPadding(3),
    yTickSize(0),
    yTickPadding(0),
  );
  return element as HTMLElement | SVGElement;
}
