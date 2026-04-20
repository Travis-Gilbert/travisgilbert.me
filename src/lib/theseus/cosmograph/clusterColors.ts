'use client';

// Hybrid warm-cluster gradient color resolver.
//
// The Explorer canvas fills points by cluster key on a continuous warm
// ramp (d3's interpolateWarm). The "cluster key" is resolved in two tiers:
//
//   1. leiden_community when present (the community-detection algorithm's
//      integer label). These are semantically meaningful groups.
//   2. k_core_number when leiden is missing. Every node's depth in the
//      graph's dense core; 96% coverage in typical graphs. Not semantic
//      communities but a genuine structural stratification.
//
// Both tiers share one warm ramp: the leiden clusters occupy the low end
// (ordinals 0..N_leiden-1) and the k-core shells extend from there
// (ordinals N_leiden..N_leiden+N_kcore-1). Nodes with neither signal fall
// to the dim note token at 60% alpha (claim M7 honest pending visual).
//
// We deliberately DO NOT use a VIE token for the ramp endpoints. The
// gradient encodes algorithmic output (community ids / core depth) rather
// than brand identity. If vie-design decides to theme the ramp later,
// introduce `--vie-cluster-warm-start` / `--vie-cluster-warm-end` tokens
// and read them inside this module; the consumer API does not change.

import { interpolateWarm } from 'd3-scale-chromatic';
import { scaleSequential } from 'd3-scale';
import { cssColorToRgba, resolveTypeColorRgba } from './typeColors';
import type { CosmoPoint } from '@/components/theseus/explorer/useGraphData';

type SequentialScale = (t: number) => string;

// Memoize the scale by `totalOrdinals` so repeated calls during the
// same data load reuse one scale instance. The d3-scale-chromatic ramp
// itself is a static function, but `scaleSequential` creates a closure
// with its own domain state; we only rebuild when totalOrdinals shifts.
const scaleCache = new Map<number, SequentialScale>();

function getWarmScale(totalOrdinals: number): SequentialScale {
  const key = Math.max(1, totalOrdinals);
  const existing = scaleCache.get(key);
  if (existing) return existing;
  const scale = scaleSequential(interpolateWarm)
    .domain([0, Math.max(1, totalOrdinals - 1)]);
  scaleCache.set(key, scale);
  return scale;
}

/**
 * Per-data-load cluster context. Built once from the full points list at
 * ingest time, then passed to color and position resolvers so every lookup
 * runs in O(1) against shared maps.
 */
export interface ClusterContext {
  /** Distinct leiden_community id → ordinal index starting at 0. */
  readonly leidenOrdinal: Map<number, number>;
  /** Distinct k_core_number value → ordinal index starting at leidenOrdinal.size. */
  readonly kCoreOrdinal: Map<number, number>;
  /** leidenOrdinal.size + kCoreOrdinal.size. Used as the warm-ramp domain. */
  readonly totalOrdinals: number;
}

/**
 * Build the cluster context from a points array. Distinct leiden ids get
 * the low ordinals (occupying the early warm-ramp colors), k-core values
 * that aren't covered by leiden get the later ordinals. Order within each
 * tier is insertion order (by first occurrence in the points list), which
 * is stable across identical data loads.
 */
export function buildClusterContext(points: CosmoPoint[]): ClusterContext {
  const leidenOrdinal = new Map<number, number>();
  const kCoreOrdinal = new Map<number, number>();
  for (const p of points) {
    const lc = p.leiden_community;
    if (typeof lc === 'number' && Number.isFinite(lc)) {
      if (!leidenOrdinal.has(lc)) leidenOrdinal.set(lc, leidenOrdinal.size);
    }
  }
  const leidenBase = leidenOrdinal.size;
  for (const p of points) {
    // Only allocate a k-core ordinal for nodes that did NOT receive a
    // leiden ordinal. Avoids giving one node two possible colors.
    if (typeof p.leiden_community === 'number' && Number.isFinite(p.leiden_community)) continue;
    const kc = p.k_core_number;
    if (typeof kc === 'number' && Number.isFinite(kc)) {
      if (!kCoreOrdinal.has(kc)) kCoreOrdinal.set(kc, leidenBase + kCoreOrdinal.size);
    }
  }
  return {
    leidenOrdinal,
    kCoreOrdinal,
    totalOrdinals: leidenOrdinal.size + kCoreOrdinal.size,
  };
}

/**
 * Return a node's ordinal index on the shared warm ramp, or `null` if the
 * node has neither leiden nor k-core coverage (pending visual).
 */
export function resolveClusterOrdinal(
  point: CosmoPoint,
  context: ClusterContext,
): number | null {
  const lc = point.leiden_community;
  if (typeof lc === 'number' && Number.isFinite(lc)) {
    const ord = context.leidenOrdinal.get(lc);
    if (ord !== undefined) return ord;
  }
  const kc = point.k_core_number;
  if (typeof kc === 'number' && Number.isFinite(kc)) {
    const ord = context.kCoreOrdinal.get(kc);
    if (ord !== undefined) return ord;
  }
  return null;
}

/**
 * Resolve a node's hybrid cluster key to a warm-gradient RGBA float quad.
 * Nodes with neither leiden nor k-core coverage fall through to the dim
 * note token at reduced alpha (claim M7 honest pending visual).
 */
export function resolveHybridClusterColorRgba(
  point: CosmoPoint,
  context: ClusterContext,
  alpha = 1,
  themeVersion = 0,
): [number, number, number, number] {
  const ordinal = resolveClusterOrdinal(point, context);
  if (ordinal == null) {
    return resolveTypeColorRgba('note', themeVersion, Math.min(0.6, alpha));
  }
  const scale = getWarmScale(context.totalOrdinals);
  const css = scale(ordinal);
  return cssColorToRgba(css, alpha);
}

/** Test / hot-reload helper: drop the memoized scale. */
export function resetClusterColorCache(): void {
  scaleCache.clear();
}
