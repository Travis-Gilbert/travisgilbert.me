'use client';

// Canvas-rendered inline text via pretext.
//
// `inline.ts` handles DOM-oriented height measurement for the chat composer.
// This sibling file exposes a `renderLabelToCanvas` helper that the Explorer
// canvas uses to stamp focal-node labels directly onto a 2D overlay without
// routing through the DOM. Pretext gives us analysis plus line-by-line
// layout; we feed each line through `ctx.fillText` at the computed vertical
// offset so the result lays out identically to a CSS-flowed block of the
// same width.
//
// All colors must arrive already resolved from VIE tokens; this helper does
// not reach into `getComputedStyle` itself.

import { prepareWithSegments, layoutWithLines, type PreparedTextWithSegments } from '@chenglou/pretext';
import { PROSE_FONT, PROSE_LINE_HEIGHT } from './fonts';

// Bounded FIFO cache: Map preserves insertion order, so `keys().next()`
// yields the oldest entry. Good enough for streaming-label workloads.
const preparedCache = new Map<string, PreparedTextWithSegments>();
const PREPARED_CACHE_LIMIT = 128;

function getPrepared(text: string, font: string): PreparedTextWithSegments {
  const key = `${font}\u0001${text}`;
  const existing = preparedCache.get(key);
  if (existing) return existing;
  const prepared = prepareWithSegments(text, font);
  if (preparedCache.size >= PREPARED_CACHE_LIMIT) {
    const oldest = preparedCache.keys().next().value;
    if (oldest !== undefined) preparedCache.delete(oldest);
  }
  preparedCache.set(key, prepared);
  return prepared;
}

export interface RenderLabelOptions {
  /** CSS font shorthand; must match the prepare() call. Default PROSE_FONT. */
  font?: string;
  /** Line-height in px (pretext units). Default PROSE_LINE_HEIGHT. */
  lineHeight?: number;
  /** Fill style (already-resolved color string). */
  color: string;
  /** Max width in CSS px for wrapping. */
  maxWidth: number;
  /** Horizontal anchor: 'center' wraps around x, 'start' draws left-aligned. */
  align?: 'center' | 'start';
  /** Baseline offset: 'top' draws below y, 'middle' centers vertically. */
  baseline?: 'top' | 'middle';
}

export interface RenderLabelResult {
  /** Total block height at maxWidth (px). */
  height: number;
  lineCount: number;
}

/**
 * Draw a single text label at (x, y) on a 2D canvas context, wrapping at
 * `maxWidth`. Returns the measured block height so callers can lay multiple
 * labels out vertically. Assumes `ctx.save()` / `ctx.restore()` is handled
 * by the caller when it needs to isolate state; this function only mutates
 * `font`, `fillStyle`, `textBaseline`, and `textAlign`.
 */
export function renderLabelToCanvas(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  options: RenderLabelOptions,
): RenderLabelResult {
  if (!text || options.maxWidth <= 0) return { height: 0, lineCount: 0 };

  const font = options.font ?? PROSE_FONT;
  const lineHeight = options.lineHeight ?? PROSE_LINE_HEIGHT;
  const align = options.align ?? 'center';
  const baseline = options.baseline ?? 'top';

  const prepared = getPrepared(text, font);
  const laid = layoutWithLines(prepared, options.maxWidth, lineHeight);

  ctx.font = font;
  ctx.fillStyle = options.color;
  ctx.textBaseline = 'top';
  ctx.textAlign = align === 'center' ? 'center' : 'left';

  const topY = baseline === 'middle' ? y - laid.height / 2 : y;
  for (let i = 0; i < laid.lines.length; i++) {
    const line = laid.lines[i];
    if (!line) continue;
    const lineY = topY + i * lineHeight;
    ctx.fillText(line.text, x, lineY);
  }

  return { height: laid.height, lineCount: laid.lineCount };
}

/** Drop cached preparations. Call on theme / font change. */
export function resetPretextCanvasCache(): void {
  preparedCache.clear();
}
