/* SPEC-VIE-3: Vega-Lite spec generation for data-driven visualizations */

import type { DataShape, GraphDecision } from '../SceneSpec';

interface VegaResult {
  spec: object;
  chartType: 'heatmap' | 'scatter' | 'bar' | 'line' | 'custom';
  xField: string;
  yField: string;
}

export function generateVegaSpec(
  dataShape: DataShape,
  data: unknown[],
  graphDecision: GraphDecision,
): VegaResult {
  const chartType = detectChartType(dataShape);
  const { xField, yField, colorField } = selectFields(dataShape, chartType);

  const spec = buildSpec(chartType, xField, yField, colorField, data);

  return { spec, chartType, xField, yField };
}

function detectChartType(shape: DataShape): VegaResult['chartType'] {
  if (shape.has_temporal && shape.has_numeric) return 'line';
  if (shape.has_categorical && shape.has_numeric) return 'bar';
  if (shape.columns.filter(c => c.type === 'numeric').length >= 2) return 'scatter';
  if (shape.columns.filter(c => c.type === 'numeric').length >= 1 &&
      shape.columns.filter(c => c.type === 'categorical').length >= 1) return 'heatmap';
  return 'custom';
}

function selectFields(
  shape: DataShape,
  chartType: VegaResult['chartType'],
): { xField: string; yField: string; colorField?: string } {
  const temporal = shape.columns.find(c => c.type === 'temporal');
  const numeric = shape.columns.filter(c => c.type === 'numeric');
  const categorical = shape.columns.find(c => c.type === 'categorical');

  switch (chartType) {
    case 'line':
      return {
        xField: temporal?.name || numeric[0]?.name || 'x',
        yField: numeric.find(c => c.name !== temporal?.name)?.name || numeric[0]?.name || 'y',
        colorField: categorical?.name,
      };
    case 'bar':
      return {
        xField: categorical?.name || 'category',
        yField: numeric[0]?.name || 'value',
      };
    case 'scatter':
      return {
        xField: numeric[0]?.name || 'x',
        yField: numeric[1]?.name || 'y',
        colorField: categorical?.name,
      };
    case 'heatmap':
      return {
        xField: (categorical || numeric[0])?.name || 'x',
        yField: numeric[0]?.name || 'y',
      };
    default:
      return { xField: 'x', yField: 'y' };
  }
}

function buildSpec(
  chartType: VegaResult['chartType'],
  xField: string,
  yField: string,
  colorField: string | undefined,
  data: unknown[],
): object {
  const baseSpec = {
    $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
    data: { values: data },
    width: 'container' as const,
    height: 300,
  };

  switch (chartType) {
    case 'line':
      return {
        ...baseSpec,
        mark: 'line',
        encoding: {
          x: { field: xField, type: 'temporal' },
          y: { field: yField, type: 'quantitative' },
          ...(colorField ? { color: { field: colorField, type: 'nominal' } } : {}),
        },
      };

    case 'bar':
      return {
        ...baseSpec,
        mark: 'bar',
        encoding: {
          x: { field: xField, type: 'nominal' },
          y: { field: yField, type: 'quantitative', aggregate: 'sum' },
        },
      };

    case 'scatter':
      return {
        ...baseSpec,
        mark: 'point',
        encoding: {
          x: { field: xField, type: 'quantitative' },
          y: { field: yField, type: 'quantitative' },
          ...(colorField ? { color: { field: colorField, type: 'nominal' } } : {}),
        },
      };

    case 'heatmap':
      return {
        ...baseSpec,
        mark: 'rect',
        encoding: {
          x: { field: xField, bin: true, type: 'quantitative' },
          y: { field: yField, bin: true, type: 'quantitative' },
          color: { aggregate: 'count', type: 'quantitative', scale: { scheme: 'viridis' } },
        },
      };

    default:
      return {
        ...baseSpec,
        mark: 'point',
        encoding: {
          x: { field: xField, type: 'quantitative' },
          y: { field: yField, type: 'quantitative' },
        },
      };
  }
}
