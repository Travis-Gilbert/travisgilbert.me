import type { CosmoPoint } from '@/components/theseus/explorer/useGraphData';

export interface ClusterHull {
  clusterId: number;
  /** Convex hull in cosmos.gl space coordinates (not screen). */
  hullSpace: Array<[number, number]>;
  /** Centroid in space coordinates. */
  centroidSpace: [number, number];
  /** Most common object_type among members; fallback 'cluster'. */
  dominantType: string;
  /** Member count; used to size the label and filter tiny clusters. */
  count: number;
}

/**
 * Andrew's monotone chain convex hull. Returns the hull points in
 * counterclockwise order. Linear-time after the O(n log n) sort.
 * No external dependency.
 */
export function convexHull(points: Array<[number, number]>): Array<[number, number]> {
  if (points.length <= 2) return points.slice();
  const sorted = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (
    o: [number, number],
    a: [number, number],
    b: [number, number],
  ): number => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);

  const lower: Array<[number, number]> = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
      lower.pop();
    }
    lower.push(p);
  }
  const upper: Array<[number, number]> = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
      upper.pop();
    }
    upper.push(p);
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

/**
 * Aggregate points into cluster hulls by Leiden community id.
 * Skips clusters smaller than `minMembers` (tiny clusters add label
 * noise without structural meaning). Dominant type is the mode of
 * `object_type` within the cluster.
 *
 * `positions` is a Float32Array of alternating x/y in cosmos.gl space,
 * one pair per point. `clusterIds` is -1 for "no cluster"; those points
 * are skipped.
 */
export function computeClusterHulls(
  points: CosmoPoint[],
  positions: ArrayLike<number>,
  clusterIds: Int32Array,
  minMembers = 4,
): ClusterHull[] {
  const byCluster = new Map<number, Array<{ xy: [number, number]; type: string }>>();

  const count = Math.min(points.length, clusterIds.length, positions.length / 2);
  for (let i = 0; i < count; i++) {
    const c = clusterIds[i];
    if (c < 0) continue;
    const xy: [number, number] = [positions[i * 2], positions[i * 2 + 1]];
    const entry = { xy, type: points[i].type };
    const list = byCluster.get(c);
    if (list) list.push(entry);
    else byCluster.set(c, [entry]);
  }

  const hulls: ClusterHull[] = [];
  for (const [clusterId, members] of byCluster) {
    if (members.length < minMembers) continue;

    const coords = members.map((m) => m.xy);
    const hullSpace = convexHull(coords);
    if (hullSpace.length < 3) continue;

    let sumX = 0;
    let sumY = 0;
    const typeCounts = new Map<string, number>();
    for (const m of members) {
      sumX += m.xy[0];
      sumY += m.xy[1];
      typeCounts.set(m.type, (typeCounts.get(m.type) ?? 0) + 1);
    }
    const centroidSpace: [number, number] = [sumX / members.length, sumY / members.length];

    let dominantType = 'cluster';
    let topCount = 0;
    for (const [t, c] of typeCounts) {
      if (c > topCount) {
        topCount = c;
        dominantType = t;
      }
    }

    hulls.push({
      clusterId,
      hullSpace,
      centroidSpace,
      dominantType,
      count: members.length,
    });
  }

  hulls.sort((a, b) => b.count - a.count);
  return hulls;
}
