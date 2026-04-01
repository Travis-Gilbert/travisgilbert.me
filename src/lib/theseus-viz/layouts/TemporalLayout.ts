/* SPEC-VIE-3: Timeline projection layout */

interface TemporalPoint {
  time: string | number; // ISO date or Unix timestamp
  value?: number;
  category?: string;
}

/**
 * Maps temporal data to spatial positions.
 * x = normalized time [earliest=left, latest=right]
 * y = value_field or vertical stacking by category
 * z = 0 (flat, suitable for 2D rendering)
 */
export function computeTemporalLayout(
  points: TemporalPoint[],
): [number, number, number][] {
  if (points.length === 0) return [];

  const times = points.map(p => parseTime(p.time));
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);
  const timeRange = Math.max(1, maxTime - minTime);

  // If values exist, use them for y; otherwise stack by category
  const hasValues = points.some(p => p.value !== undefined);

  if (hasValues) {
    const values = points.map(p => p.value ?? 0);
    const maxVal = Math.max(0.001, ...values.map(Math.abs));
    return points.map((p, i) => [
      ((times[i] - minTime) / timeRange) * 20 - 10,
      (values[i] / maxVal) * 10 - 5,
      0,
    ]);
  }

  // Stack by category
  const categories = [...new Set(points.map(p => p.category || 'default'))];
  const catSpacing = categories.length > 1 ? 20 / (categories.length - 1) : 0;

  return points.map((p, i) => {
    const catIdx = categories.indexOf(p.category || 'default');
    return [
      ((times[i] - minTime) / timeRange) * 20 - 10,
      categories.length > 1 ? catIdx * catSpacing - 10 : 0,
      0,
    ];
  });
}

function parseTime(time: string | number): number {
  if (typeof time === 'number') return time;
  const d = new Date(time);
  return isNaN(d.getTime()) ? 0 : d.getTime();
}
