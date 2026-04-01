/* SPEC-VIE-3: D3 spec generation for geographic and network visualizations */

import type { DataShape, GraphDecision } from '../SceneSpec';

interface D3Result {
  spec: object;
  type: 'geo_heatmap' | 'network' | 'scatter_3d' | 'custom';
  xField: string;
  yField: string;
}

export function generateD3Spec(
  dataShape: DataShape,
  data: unknown[],
  graphDecision: GraphDecision,
): D3Result {
  const type = detectD3Type(dataShape);

  switch (type) {
    case 'geo_heatmap':
      return buildGeoHeatmap(dataShape, data);
    case 'network':
      return buildNetwork(data);
    case 'scatter_3d':
      return buildScatter3D(dataShape, data);
    default:
      return {
        spec: { type: 'custom', data },
        type: 'custom',
        xField: '',
        yField: '',
      };
  }
}

function detectD3Type(shape: DataShape): D3Result['type'] {
  if (shape.has_geographic) return 'geo_heatmap';
  const numericCols = shape.columns.filter(c => c.type === 'numeric');
  if (numericCols.length >= 3) return 'scatter_3d';
  return 'custom';
}

function buildGeoHeatmap(shape: DataShape, data: unknown[]): D3Result {
  const geoCol = shape.columns.find(c => c.type === 'geographic');
  const numericCols = shape.columns.filter(c => c.type === 'numeric');
  const valueCol = numericCols.find(c => c.name !== geoCol?.name);

  // Extract lat/lon bounds
  const records = data as Record<string, unknown>[];
  const latField = shape.columns.find(c =>
    c.name.toLowerCase().includes('lat'),
  )?.name || 'lat';
  const lonField = shape.columns.find(c =>
    c.name.toLowerCase().includes('lon') || c.name.toLowerCase().includes('lng'),
  )?.name || 'lon';

  const lats = records.map(r => Number(r[latField]) || 0).filter(v => v !== 0);
  const lons = records.map(r => Number(r[lonField]) || 0).filter(v => v !== 0);

  const bounds = {
    min_lat: lats.length > 0 ? Math.min(...lats) : -90,
    max_lat: lats.length > 0 ? Math.max(...lats) : 90,
    min_lon: lons.length > 0 ? Math.min(...lons) : -180,
    max_lon: lons.length > 0 ? Math.max(...lons) : 180,
  };

  const points = records.map(r => ({
    lat: Number(r[latField]) || 0,
    lon: Number(r[lonField]) || 0,
    value: valueCol ? Number(r[valueCol.name]) || 0 : 1,
  }));

  return {
    spec: {
      type: 'geo_heatmap',
      points,
      colorScale: 'viridis',
      bounds,
    },
    type: 'geo_heatmap',
    xField: lonField,
    yField: latField,
  };
}

function buildNetwork(data: unknown[]): D3Result {
  return {
    spec: {
      type: 'network',
      nodes: [],
      links: [],
      forceConfig: {
        charge: -30,
        linkDistance: 50,
        centerStrength: 0.1,
      },
    },
    type: 'network',
    xField: '',
    yField: '',
  };
}

function buildScatter3D(shape: DataShape, data: unknown[]): D3Result {
  const numericCols = shape.columns.filter(c => c.type === 'numeric');
  const xField = numericCols[0]?.name || 'x';
  const yField = numericCols[1]?.name || 'y';
  const zField = numericCols[2]?.name || 'z';
  const labelCol = shape.columns.find(c => c.type === 'categorical' || c.type === 'text');

  const records = data as Record<string, unknown>[];
  const points = records.map(r => ({
    x: Number(r[xField]) || 0,
    y: Number(r[yField]) || 0,
    z: Number(r[zField]) || 0,
    value: Number(r[numericCols[3]?.name]) || 0,
    label: labelCol ? String(r[labelCol.name] || '') : '',
  }));

  return {
    spec: {
      type: 'scatter_3d',
      points,
      axes: { x: xField, y: yField, z: zField },
    },
    type: 'scatter_3d',
    xField,
    yField,
  };
}
