/**
 * Pretext-powered label rendering for the galaxy canvas.
 *
 * Uses @chenglou/pretext for DOM-free text measurement so labels
 * wrap naturally and can be positioned precisely on the canvas
 * without triggering layout reflow.
 */

import {
  prepareWithSegments,
  layoutWithLines,
  type PreparedTextWithSegments,
} from '@chenglou/pretext';

const LABEL_FONT = '11px "JetBrains Mono", monospace';
const LABEL_LINE_HEIGHT = 14;
const LABEL_MAX_WIDTH = 160;
const LABEL_PADDING_X = 6;
const LABEL_PADDING_Y = 4;

// Cache prepared text to avoid re-measuring on every frame
const preparedCache = new Map<string, PreparedTextWithSegments>();

function getPrepared(text: string): PreparedTextWithSegments {
  let prepared = preparedCache.get(text);
  if (!prepared) {
    prepared = prepareWithSegments(text, LABEL_FONT);
    preparedCache.set(text, prepared);
    if (preparedCache.size > 200) {
      const first = preparedCache.keys().next().value;
      if (first !== undefined) preparedCache.delete(first);
    }
  }
  return prepared;
}

export interface CanvasLabel {
  x: number;
  y: number;
  text: string;
  alpha: number;
}

/**
 * Render labels on a canvas context using Pretext for measurement.
 * Labels get a dark backing rectangle and support multiline wrapping.
 */
export function renderPretextLabels(
  ctx: CanvasRenderingContext2D,
  labels: CanvasLabel[],
): void {
  for (const label of labels) {
    if (label.alpha < 0.01) continue;

    const text = label.text.toUpperCase();
    const prepared = getPrepared(text);
    const result = layoutWithLines(prepared, LABEL_MAX_WIDTH, LABEL_LINE_HEIGHT);

    // LayoutLine.text gives us each wrapped line directly
    const lines = result.lines;
    let maxLineWidth = 0;
    ctx.font = LABEL_FONT;
    for (const line of lines) {
      const w = ctx.measureText(line.text).width;
      if (w > maxLineWidth) maxLineWidth = w;
    }

    const blockWidth = maxLineWidth + LABEL_PADDING_X * 2;
    const blockHeight = result.height + LABEL_PADDING_Y * 2;
    const bx = label.x - blockWidth / 2;
    const by = label.y - blockHeight - 4;

    // Dark backing
    ctx.beginPath();
    ctx.fillStyle = `rgba(15,16,18,${label.alpha * 0.7})`;
    ctx.roundRect(bx, by, blockWidth, blockHeight, 3);
    ctx.fill();

    // Render each line
    ctx.fillStyle = `rgba(232,229,224,${label.alpha})`;
    ctx.font = LABEL_FONT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(
        lines[i].text,
        label.x,
        by + LABEL_PADDING_Y + i * LABEL_LINE_HEIGHT,
      );
    }
  }
}

/**
 * Greedy collision avoidance: push overlapping labels downward.
 * Uses pretext for accurate text measurement.
 */
export function resolveCollisions(
  labels: CanvasLabel[],
  padding: number = 8,
): CanvasLabel[] {
  const placed: Array<{ x: number; y: number; w: number; h: number }> = [];

  return labels.map((label) => {
    const text = label.text.toUpperCase();
    const prepared = getPrepared(text);
    const result = layoutWithLines(prepared, LABEL_MAX_WIDTH, LABEL_LINE_HEIGHT);
    let maxLineW = 0;
    for (const line of result.lines) {
      if (line.width > maxLineW) maxLineW = line.width;
    }
    const textWidth = maxLineW + LABEL_PADDING_X * 2;
    const textHeight = result.height + LABEL_PADDING_Y * 2;

    let finalY = label.y;
    let attempts = 0;

    while (attempts < 12) {
      const overlaps = placed.some(
        (p) =>
          Math.abs(label.x - p.x) < (textWidth + p.w) / 2 + padding &&
          Math.abs(finalY - p.y) < (textHeight + p.h) / 2 + 4,
      );
      if (!overlaps) break;
      finalY += textHeight + 4;
      attempts++;
    }

    placed.push({ x: label.x, y: finalY, w: textWidth, h: textHeight });
    return { ...label, y: finalY };
  });
}

/**
 * Clear the prepared text cache (call on resize or theme change).
 */
export function clearLabelCache(): void {
  preparedCache.clear();
}
