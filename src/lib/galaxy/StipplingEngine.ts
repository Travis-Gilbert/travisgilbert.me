/**
 * StipplingEngine.ts
 *
 * Converts any offscreen canvas into weighted dot target positions using
 * Lloyd's relaxation over Voronoi cells (d3-delaunay). The dots are
 * primitives to any design: the stippling engine is the universal bridge
 * between "any visualization" and "dot positions that form the shape."
 *
 * Algorithm:
 *   1. Read pixel brightness from the visual canvas
 *   2. Seed points via rejection sampling (darker pixels = more dots)
 *   3. Iteratively compute Voronoi cells and move points to
 *      brightness-weighted centroids (Lloyd's relaxation)
 *   4. Read semantic IDs from the ID canvas at each final position
 *   5. Assign phase indices from the phase template grid
 *
 * The construction sequence IS the convergence. Early iterations (3-5)
 * produce a recognizable shape; remaining iterations settle during
 * crystallization.
 */

import { Delaunay } from 'd3-delaunay';
import { mulberry32 } from '@/lib/prng';
import type { IdEntry, OffscreenRenderResult } from './renderers/types';
import { OFFSCREEN_SIZE } from './renderers/types';

export interface StippleTarget {
  x: number;
  y: number;
  /** Brightness weight (0 = dark region, 1 = bright region) */
  weight: number;
  /** Semantic node ID from the ID canvas, null if background */
  nodeId: string | null;
  /** Epistemic role from the ID legend (argument renderer only) */
  role: string | null;
  /** Construction phase index from the phase template */
  phase: number;
}

export interface StippleResult {
  targets: StippleTarget[];
  /**
   * Intermediate position snapshots for animated convergence.
   * Each entry is a flat Float32Array of [x0, y0, x1, y1, ...].
   * The construction sequence can interpolate between snapshots.
   */
  snapshots: Float32Array[];
}

export interface StippleOptions {
  /**
   * Total Lloyd's iterations. Default 10.
   * First 3-5 are shown as the construction phase.
   * Remaining settle during crystallization.
   */
  iterations?: number;
  /**
   * Capture a snapshot every N iterations. Default 0 (disabled).
   * Set to 1 to capture every iteration for animated convergence.
   */
  snapshotInterval?: number;
  /** PRNG seed for deterministic output. Default 42. */
  seed?: number;
  /**
   * Output coordinate space. Dots are placed in [0, outputWidth] x [0, outputHeight].
   * Defaults to OFFSCREEN_SIZE x OFFSCREEN_SIZE if not provided.
   */
  outputWidth?: number;
  outputHeight?: number;
}

/**
 * Run the stippling engine on dual offscreen canvases.
 *
 * @param render - The dual-canvas output from an offscreen renderer
 * @param dotCount - Number of dots to stipple (from StipplingDirector)
 * @param options - Iteration count, snapshot interval, PRNG seed
 */
export function stipple(
  render: OffscreenRenderResult,
  dotCount: number,
  options: StippleOptions = {},
): StippleResult {
  const {
    iterations = 10,
    snapshotInterval = 0,
    seed = 42,
    outputWidth,
    outputHeight,
  } = options;

  const outW = outputWidth ?? OFFSCREEN_SIZE;
  const outH = outputHeight ?? OFFSCREEN_SIZE;
  const scaleX = outW / OFFSCREEN_SIZE;
  const scaleY = outH / OFFSCREEN_SIZE;

  // Read brightness from visual canvas
  const visualCtx = render.visual.getContext('2d')!;
  const imageData = visualCtx.getImageData(0, 0, OFFSCREEN_SIZE, OFFSCREEN_SIZE);
  const brightness = computeBrightness(imageData);

  // Seed points via rejection sampling
  const rng = mulberry32(seed);
  const points = seedPoints(brightness, OFFSCREEN_SIZE, OFFSCREEN_SIZE, dotCount, rng);

  // Run Lloyd's relaxation with snapshot capture
  const snapshots: Float32Array[] = [];
  if (snapshotInterval > 0) captureSnapshot(points, scaleX, scaleY, snapshots);

  for (let iter = 0; iter < iterations; iter++) {
    lloydIteration(points, brightness, OFFSCREEN_SIZE, OFFSCREEN_SIZE);

    if (snapshotInterval > 0 && (iter + 1) % snapshotInterval === 0) {
      captureSnapshot(points, scaleX, scaleY, snapshots);
    }
  }

  // Bulk-read the ID canvas once (avoids per-pixel getImageData)
  const idCtx = render.idMap.getContext('2d')!;
  const idImageData = idCtx.getImageData(0, 0, OFFSCREEN_SIZE, OFFSCREEN_SIZE);
  const idPixels = idImageData.data;
  const { phaseTemplate, idLegend } = render;
  const phaseRows = phaseTemplate.length;
  const phaseCols = phaseTemplate[0]?.length ?? 1;

  const targets: StippleTarget[] = [];
  for (let i = 0; i < points.length; i += 2) {
    const sx = points[i];
    const sy = points[i + 1];

    const cx = Math.max(0, Math.min(OFFSCREEN_SIZE - 1, Math.round(sx)));
    const cy = Math.max(0, Math.min(OFFSCREEN_SIZE - 1, Math.round(sy)));

    // Read ID color from bulk pixel data
    const pIdx = (cy * OFFSCREEN_SIZE + cx) * 4;
    const hexColor = `#${idPixels[pIdx].toString(16).padStart(2, '0')}${idPixels[pIdx + 1].toString(16).padStart(2, '0')}${idPixels[pIdx + 2].toString(16).padStart(2, '0')}`;
    const entry: IdEntry | undefined = idLegend.get(hexColor);

    // Phase from template grid
    const phaseRow = Math.min(phaseRows - 1, Math.floor((cy / OFFSCREEN_SIZE) * phaseRows));
    const phaseCol = Math.min(phaseCols - 1, Math.floor((cx / OFFSCREEN_SIZE) * phaseCols));
    const phase = phaseTemplate[phaseRow]?.[phaseCol] ?? 0;

    // Brightness weight at this position
    const bIdx = cy * OFFSCREEN_SIZE + cx;
    const weight = brightness[bIdx] ?? 0;

    targets.push({
      x: sx * scaleX,
      y: sy * scaleY,
      weight,
      nodeId: entry?.nodeId ?? null,
      role: entry?.role ?? null,
      phase,
    });
  }

  return { targets, snapshots };
}

// ---------------------------------------------------------------------------
// Brightness extraction
// ---------------------------------------------------------------------------

/**
 * Convert RGBA image data to a normalized brightness array (0 = black, 1 = white).
 * Uses luminance formula: 0.299R + 0.587G + 0.114B, normalized to [0,1].
 */
function computeBrightness(imageData: ImageData): Float32Array {
  const { data, width, height } = imageData;
  const brightness = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    brightness[i] = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  }
  return brightness;
}

// ---------------------------------------------------------------------------
// Rejection sampling
// ---------------------------------------------------------------------------

/**
 * Seed initial dot positions via rejection sampling weighted by darkness.
 * Dark pixels (low brightness) are more likely to accept a sample,
 * so more dots cluster in dark regions of the visual canvas.
 *
 * Returns a flat Float32Array of [x0, y0, x1, y1, ...].
 */
function seedPoints(
  brightness: Float32Array,
  width: number,
  height: number,
  count: number,
  rng: () => number,
): Float32Array {
  const points = new Float32Array(count * 2);
  let placed = 0;
  let attempts = 0;
  const maxAttempts = count * 50; // safety valve

  while (placed < count && attempts < maxAttempts) {
    const x = rng() * (width - 1);
    const y = rng() * (height - 1);
    const bIdx = Math.floor(y) * width + Math.floor(x);
    const b = brightness[bIdx] ?? 1;

    // Accept with probability (1 - brightness): dark = high acceptance
    if (rng() > b) {
      points[placed * 2] = x;
      points[placed * 2 + 1] = y;
      placed++;
    }
    attempts++;
  }

  // If we couldn't place enough via rejection, fill remaining with uniform random
  while (placed < count) {
    points[placed * 2] = rng() * (width - 1);
    points[placed * 2 + 1] = rng() * (height - 1);
    placed++;
  }

  return points;
}

// ---------------------------------------------------------------------------
// Lloyd's relaxation
// ---------------------------------------------------------------------------

/**
 * One iteration of Lloyd's relaxation: compute Voronoi cells via d3-delaunay,
 * then move each point to the brightness-weighted centroid of its cell.
 *
 * Uses Delaunay.from() which efficiently builds from a flat coordinate array.
 * The points array is mutated in place for zero allocation.
 */
function lloydIteration(
  points: Float32Array,
  brightness: Float32Array,
  width: number,
  height: number,
): void {
  const n = points.length / 2;
  if (n === 0) return;

  // Build Delaunay triangulation from flat coordinate array
  const delaunay = Delaunay.from(
    { length: n },
    (_, i) => points[i * 2],
    (_, i) => points[i * 2 + 1],
  );
  const voronoi = delaunay.voronoi([0, 0, width, height]);

  // For each cell, compute the brightness-weighted centroid
  for (let i = 0; i < n; i++) {
    const cell = voronoi.cellPolygon(i);
    if (!cell) continue;

    const centroid = weightedCentroid(cell, brightness, width, height);
    points[i * 2] = centroid.x;
    points[i * 2 + 1] = centroid.y;
  }
}

/**
 * Compute the brightness-weighted centroid of a Voronoi cell polygon.
 *
 * Samples pixels within the polygon's bounding box, accumulates
 * position weighted by (1 - brightness), returns the weighted average.
 * Dark pixels pull the centroid more strongly.
 *
 * For small cells (< 4px across), falls back to geometric centroid
 * to avoid division-by-zero or sampling artifacts.
 */
function weightedCentroid(
  polygon: ArrayLike<ArrayLike<number>>,
  brightness: Float32Array,
  width: number,
  height: number,
): { x: number; y: number } {
  // Bounding box of the polygon
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < polygon.length; i++) {
    const px = polygon[i][0];
    const py = polygon[i][1];
    if (px < minX) minX = px;
    if (px > maxX) maxX = px;
    if (py < minY) minY = py;
    if (py > maxY) maxY = py;
  }

  const x0 = Math.max(0, Math.floor(minX));
  const y0 = Math.max(0, Math.floor(minY));
  const x1 = Math.min(width - 1, Math.ceil(maxX));
  const y1 = Math.min(height - 1, Math.ceil(maxY));

  // For very small cells, use geometric centroid
  if (x1 - x0 < 4 && y1 - y0 < 4) {
    let cx = 0;
    let cy = 0;
    for (let i = 0; i < polygon.length - 1; i++) {
      cx += polygon[i][0];
      cy += polygon[i][1];
    }
    const len = polygon.length - 1; // last point repeats first in d3
    return { x: cx / Math.max(1, len), y: cy / Math.max(1, len) };
  }

  // Sample pixels in bounding box, accumulate weighted position
  // Step size: sample every 2 pixels for performance (cells are small enough)
  const step = Math.max(1, Math.floor(Math.min(x1 - x0, y1 - y0) / 8));
  let sumX = 0;
  let sumY = 0;
  let sumW = 0;

  for (let py = y0; py <= y1; py += step) {
    for (let px = x0; px <= x1; px += step) {
      const bIdx = py * width + px;
      const b = brightness[bIdx] ?? 1;
      const w = 1 - b; // dark = heavy weight
      if (w <= 0) continue;

      sumX += px * w;
      sumY += py * w;
      sumW += w;
    }
  }

  if (sumW < 0.001) {
    // All pixels in cell are bright (white); use geometric centroid
    let cx = 0;
    let cy = 0;
    for (let i = 0; i < polygon.length - 1; i++) {
      cx += polygon[i][0];
      cy += polygon[i][1];
    }
    const len = polygon.length - 1;
    return { x: cx / Math.max(1, len), y: cy / Math.max(1, len) };
  }

  return {
    x: Math.max(0, Math.min(width - 1, sumX / sumW)),
    y: Math.max(0, Math.min(height - 1, sumY / sumW)),
  };
}

// ---------------------------------------------------------------------------
// Snapshot capture
// ---------------------------------------------------------------------------

function captureSnapshot(
  points: Float32Array,
  scaleX: number,
  scaleY: number,
  snapshots: Float32Array[],
): void {
  const scaled = new Float32Array(points.length);
  for (let i = 0; i < points.length; i += 2) {
    scaled[i] = points[i] * scaleX;
    scaled[i + 1] = points[i + 1] * scaleY;
  }
  snapshots.push(scaled);
}
