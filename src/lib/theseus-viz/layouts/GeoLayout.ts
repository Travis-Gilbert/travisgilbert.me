/* SPEC-VIE-3: Geographic projection layout (Web Mercator simplified) */

interface GeoPoint {
  lat: number;
  lon: number;
  value?: number;
}

/**
 * Projects geographic coordinates using simplified Web Mercator.
 * x = lon * cos(lat_center) scaled to [-10, 10]
 * z = lat scaled to [-10, 10]
 * y = value_field if present (height encodes data value), normalized to [0, 5]
 */
export function computeGeoLayout(
  points: GeoPoint[],
): [number, number, number][] {
  if (points.length === 0) return [];

  const lats = points.map(p => p.lat);
  const lons = points.map(p => p.lon);
  const values = points.map(p => p.value ?? 0);

  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  const centerLat = (minLat + maxLat) / 2;
  const cosCenter = Math.cos((centerLat * Math.PI) / 180);

  const latRange = Math.max(0.001, maxLat - minLat);
  const lonRange = Math.max(0.001, (maxLon - minLon) * cosCenter);

  const maxVal = Math.max(0.001, ...values.map(Math.abs));

  return points.map(p => {
    const x = ((p.lon - minLon) * cosCenter / lonRange) * 20 - 10;
    const z = ((p.lat - minLat) / latRange) * 20 - 10;
    const y = p.value !== undefined ? (p.value / maxVal) * 5 : 0;
    return [
      clamp(x, -15, 15),
      clamp(y, 0, 5),
      clamp(z, -15, 15),
    ];
  });
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
