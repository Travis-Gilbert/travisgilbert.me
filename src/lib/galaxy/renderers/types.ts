/**
 * Shared types for offscreen renderers that feed the stippling engine.
 *
 * Every renderer produces two canvases:
 *   - visual: high-contrast shapes (hard edges, flat fills, no AA)
 *     used by StipplingEngine for brightness-weighted dot placement
 *   - idMap: flat-color regions where each unique color encodes a
 *     semantic node/section ID, read after stippling to tag each dot
 *
 * The dual-canvas pattern is load-bearing for downstream interactions:
 * Jenga, argument structure, and Challenge all depend on dots knowing
 * which evidence node they belong to.
 */

export interface IdEntry {
  nodeId: string;
  /** Epistemic role, present on ArgumentRenderer output */
  role?: 'conclusion' | 'premise' | 'evidence';
}

export interface OffscreenRenderResult {
  /** High-contrast visualization for stippling (hard edges, flat fills) */
  visual: OffscreenCanvas;
  /** Flat-color semantic regions, one color per node/section */
  idMap: OffscreenCanvas;
  /** Maps hex color strings from idMap to semantic IDs */
  idLegend: Map<string, IdEntry>;
  /**
   * Low-resolution grid of phase indices controlling reveal order.
   * 8x8 for simple layouts (comparison, explanation).
   * 16x16 for complex layouts (argument tree, hierarchy).
   * Each cell value is a zero-based phase index.
   */
  phaseTemplate: number[][];
}

/** Canvas resolution for offscreen renders. 512 is sufficient; stippling samples brightness. */
export const OFFSCREEN_SIZE = 512;

/**
 * Generate a deterministic hex color for an index (for ID maps).
 * Skips black (#000000) which is reserved for background/empty.
 * Colors are visually arbitrary since no human sees them.
 */
export function indexToHex(index: number): string {
  const value = index + 1; // skip 0 (black = background)
  const r = (value >> 16) & 0xff;
  const g = (value >> 8) & 0xff;
  const b = value & 0xff;
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

/**
 * Read the hex color at a pixel coordinate from an OffscreenCanvas.
 * Returns '#000000' for background/empty pixels.
 */
export function readIdColor(
  ctx: OffscreenCanvasRenderingContext2D,
  x: number,
  y: number,
): string {
  const pixel = ctx.getImageData(Math.round(x), Math.round(y), 1, 1).data;
  return `#${pixel[0].toString(16).padStart(2, '0')}${pixel[1].toString(16).padStart(2, '0')}${pixel[2].toString(16).padStart(2, '0')}`;
}

/**
 * Create a pair of offscreen canvases at OFFSCREEN_SIZE.
 * Visual canvas gets a black background (dark = fewer dots).
 * ID canvas gets a black background (black = no semantic region).
 */
export function createCanvasPair(): {
  visual: OffscreenCanvas;
  visualCtx: OffscreenCanvasRenderingContext2D;
  idMap: OffscreenCanvas;
  idCtx: OffscreenCanvasRenderingContext2D;
} {
  const visual = new OffscreenCanvas(OFFSCREEN_SIZE, OFFSCREEN_SIZE);
  const visualCtx = visual.getContext('2d')!;
  visualCtx.fillStyle = '#000000';
  visualCtx.fillRect(0, 0, OFFSCREEN_SIZE, OFFSCREEN_SIZE);
  // Disable anti-aliasing: hard edges help stippling quality
  visualCtx.imageSmoothingEnabled = false;

  const idMap = new OffscreenCanvas(OFFSCREEN_SIZE, OFFSCREEN_SIZE);
  const idCtx = idMap.getContext('2d')!;
  idCtx.fillStyle = '#000000';
  idCtx.fillRect(0, 0, OFFSCREEN_SIZE, OFFSCREEN_SIZE);
  idCtx.imageSmoothingEnabled = false;

  return { visual, visualCtx, idMap, idCtx };
}

/**
 * Create a uniform phase template (all dots in phase 0).
 */
export function uniformPhaseTemplate(size: number): number[][] {
  return Array.from({ length: size }, () => Array(size).fill(0) as number[]);
}

/**
 * Create a left-to-right sweep phase template.
 */
export function leftToRightPhaseTemplate(size: number, phases: number): number[][] {
  return Array.from({ length: size }, () =>
    Array.from({ length: size }, (_, col) => Math.floor((col / size) * phases)),
  );
}

/**
 * Create a center-outward radial phase template.
 */
export function centerOutwardPhaseTemplate(size: number, phases: number): number[][] {
  const center = (size - 1) / 2;
  const maxDist = center * Math.SQRT2;
  return Array.from({ length: size }, (_, row) =>
    Array.from({ length: size }, (_, col) => {
      const dist = Math.sqrt((row - center) ** 2 + (col - center) ** 2);
      return Math.min(phases - 1, Math.floor((dist / maxDist) * phases));
    }),
  );
}

/**
 * Create a bottom-to-top phase template (for argument trees).
 */
export function bottomToTopPhaseTemplate(size: number, phases: number): number[][] {
  return Array.from({ length: size }, (_, row) =>
    Array.from({ length: size }, () =>
      Math.min(phases - 1, Math.floor(((size - 1 - row) / (size - 1)) * phases)),
    ),
  );
}
