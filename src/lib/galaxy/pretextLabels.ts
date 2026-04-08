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
import { TYPE_COLORS } from '@/components/theseus/renderers/rendering';

const LABEL_FONT = '11px "JetBrains Mono", monospace';
const LABEL_LINE_HEIGHT = 14;
const LABEL_MAX_WIDTH = 160;
const LABEL_PADDING_X = 6;
const LABEL_PADDING_Y = 4;

// Cache prepared text per font to avoid re-measuring on every frame.
// Key format: "font||text" to prevent cross-font cache hits.
const preparedCache = new Map<string, PreparedTextWithSegments>();
const MAX_CACHE_SIZE = 400;

function getPrepared(text: string, font: string = LABEL_FONT): PreparedTextWithSegments {
  const key = `${font}||${text}`;
  let prepared = preparedCache.get(key);
  if (!prepared) {
    prepared = prepareWithSegments(text, font);
    preparedCache.set(key, prepared);
    if (preparedCache.size > MAX_CACHE_SIZE) {
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

// ---------------------------------------------------------------------------
// Click Card: canvas-rendered info card at arbitrary position
// ---------------------------------------------------------------------------

const CARD_FONT_TITLE = '600 13px "IBM Plex Sans", sans-serif';
const CARD_FONT_BODY = '400 13px "IBM Plex Sans", sans-serif';
const CARD_FONT_BADGE = '400 10px "JetBrains Mono", monospace';
const CARD_LINE_HEIGHT = 20; // 13px * 1.55 rounded
const CARD_MAX_WIDTH = 320;
const CARD_PADDING_X = 16;
const CARD_PADDING_Y = 12;
const CARD_BORDER_RADIUS = 14;
const CARD_MAX_LINES = 4;

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export interface ClickCardData {
  canvasX: number;
  canvasY: number;
  title: string;
  snippet: string;
  objectType: string;
  score: number;
  alpha: number;
}

/**
 * Render a click-card on the canvas at the given canvas coordinates.
 * The card has a glass-morphism background, type badge, title, and snippet.
 * Positioning flips to avoid viewport overflow.
 */
export function renderClickCard(
  ctx: CanvasRenderingContext2D,
  card: ClickCardData,
  viewportWidth: number,
  viewportHeight: number,
): void {
  if (card.alpha < 0.01) return;

  const a = card.alpha;

  // Measure title
  ctx.font = CARD_FONT_TITLE;
  const titleText = card.title || 'Untitled';
  const titleWidth = Math.min(ctx.measureText(titleText).width, CARD_MAX_WIDTH - CARD_PADDING_X * 2);

  // Badge text
  const badgeText = card.objectType.toUpperCase();
  ctx.font = CARD_FONT_BADGE;
  const badgeWidth = ctx.measureText(badgeText).width + 12;
  const badgeHeight = 18;

  // Score text
  const scoreText = `${Math.round(card.score * 100)}%`;
  const scoreWidth = ctx.measureText(scoreText).width;

  // Measure snippet lines using pretext for proper wrapping
  const snippetMaxW = CARD_MAX_WIDTH - CARD_PADDING_X * 2;
  let snippetLines: string[] = [];
  if (card.snippet) {
    const prepared = getPrepared(card.snippet, CARD_FONT_BODY);
    const result = layoutWithLines(prepared, snippetMaxW, CARD_LINE_HEIGHT);
    snippetLines = result.lines.slice(0, CARD_MAX_LINES).map((l) => l.text);
    // Truncate last line if we hit max
    if (result.lines.length > CARD_MAX_LINES && snippetLines.length > 0) {
      const last = snippetLines[snippetLines.length - 1];
      snippetLines[snippetLines.length - 1] = last.slice(0, -3) + '...';
    }
  }

  // Card dimensions
  const contentWidth = Math.max(titleWidth, badgeWidth + 8 + scoreWidth, snippetMaxW);
  const cardWidth = Math.min(CARD_MAX_WIDTH, contentWidth + CARD_PADDING_X * 2);
  const titleRowHeight = 20;
  const badgeRowHeight = badgeHeight + 6;
  const snippetHeight = snippetLines.length * CARD_LINE_HEIGHT;
  const cardHeight = CARD_PADDING_Y + titleRowHeight + badgeRowHeight + snippetHeight + CARD_PADDING_Y;

  // Position: offset right+up from dot, flip if overflow
  let cx = card.canvasX;
  let cy = card.canvasY - cardHeight;
  if (cx + cardWidth > viewportWidth) cx = card.canvasX - cardWidth - 16;
  if (cy < 0) cy = card.canvasY + 16;

  // Scale animation (appear from 0.85)
  const scaleVal = 0.85 + a * 0.15;
  const scaleCenterX = cx + cardWidth / 2;
  const scaleCenterY = cy + cardHeight / 2;

  ctx.save();
  ctx.translate(scaleCenterX, scaleCenterY);
  ctx.scale(scaleVal, scaleVal);
  ctx.translate(-scaleCenterX, -scaleCenterY);

  // Background
  ctx.beginPath();
  ctx.roundRect(cx, cy, cardWidth, cardHeight, CARD_BORDER_RADIUS);
  ctx.fillStyle = `rgba(15, 16, 18, ${0.82 * a})`;
  ctx.fill();

  // Border
  ctx.strokeStyle = `rgba(255, 255, 255, ${0.08 * a})`;
  ctx.lineWidth = 1;
  ctx.stroke();

  let cursorY = cy + CARD_PADDING_Y;

  // Title
  ctx.font = CARD_FONT_TITLE;
  ctx.fillStyle = `rgba(232, 229, 224, ${a})`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  const maxTitleChars = Math.floor((cardWidth - CARD_PADDING_X * 2) / 7);
  const displayTitle = titleText.length > maxTitleChars
    ? titleText.slice(0, maxTitleChars - 3) + '...'
    : titleText;
  ctx.fillText(displayTitle, cx + CARD_PADDING_X, cursorY);
  cursorY += titleRowHeight;

  // Type badge + score
  const badgeColor = TYPE_COLORS[card.objectType] ?? '#9A958D';
  ctx.beginPath();
  ctx.roundRect(cx + CARD_PADDING_X, cursorY, badgeWidth, badgeHeight, 4);
  const [br, bg, bb] = hexToRgb(badgeColor);
  ctx.fillStyle = `rgba(${br}, ${bg}, ${bb}, ${0.3 * a})`;
  ctx.fill();

  ctx.font = CARD_FONT_BADGE;
  ctx.fillStyle = `rgba(232, 229, 224, ${0.9 * a})`;
  ctx.fillText(badgeText, cx + CARD_PADDING_X + 6, cursorY + 4);

  // Score
  ctx.fillStyle = `rgba(156, 149, 141, ${0.7 * a})`;
  ctx.fillText(scoreText, cx + CARD_PADDING_X + badgeWidth + 8, cursorY + 4);
  cursorY += badgeRowHeight;

  // Snippet lines
  if (snippetLines.length > 0) {
    ctx.font = CARD_FONT_BODY;
    ctx.fillStyle = `rgba(156, 149, 141, ${0.85 * a})`;
    for (const line of snippetLines) {
      ctx.fillText(line, cx + CARD_PADDING_X, cursorY);
      cursorY += CARD_LINE_HEIGHT;
    }
  }

  ctx.restore();
}

// ---------------------------------------------------------------------------
// Inline Response: streaming text overlay on the galaxy canvas
// ---------------------------------------------------------------------------

const RESPONSE_FONT = '400 14px "IBM Plex Sans", sans-serif';
const RESPONSE_LINE_HEIGHT = 22;
const RESPONSE_MAX_WIDTH = 360;
const RESPONSE_PADDING_X = 14;
const RESPONSE_PADDING_Y = 10;
const RESPONSE_BORDER_RADIUS = 12;

export interface InlineResponseData {
  canvasX: number;
  canvasY: number;
  text: string;
  alpha: number;
  visibleChars?: number;
}

/**
 * Render a streaming text response on the canvas at the given coordinates.
 * When `visibleChars` is set, only that many characters are shown (for
 * typewriter style streaming animation). The response bubble clamps to
 * stay within the viewport with a 16px margin.
 *
 * Returns the rendered dimensions so callers can reserve space or
 * coordinate layout with other canvas elements.
 */
export function renderInlineResponse(
  ctx: CanvasRenderingContext2D,
  response: InlineResponseData,
  viewportWidth: number,
  viewportHeight: number,
): { width: number; height: number } {
  if (response.alpha < 0.01 || !response.text) {
    return { width: 0, height: 0 };
  }

  const a = response.alpha;
  const displayText =
    response.visibleChars != null
      ? response.text.slice(0, response.visibleChars)
      : response.text;

  if (!displayText) return { width: 0, height: 0 };

  // Measure and wrap text using pretext
  const contentMaxW = RESPONSE_MAX_WIDTH - RESPONSE_PADDING_X * 2;
  const prepared = getPrepared(displayText, RESPONSE_FONT);
  const result = layoutWithLines(prepared, contentMaxW, RESPONSE_LINE_HEIGHT);
  const lines = result.lines;

  // Determine widest line
  let maxLineWidth = 0;
  ctx.font = RESPONSE_FONT;
  for (const line of lines) {
    const w = ctx.measureText(line.text).width;
    if (w > maxLineWidth) maxLineWidth = w;
  }

  const bubbleWidth = Math.min(
    RESPONSE_MAX_WIDTH,
    maxLineWidth + RESPONSE_PADDING_X * 2,
  );
  const bubbleHeight = result.height + RESPONSE_PADDING_Y * 2;

  // Position with viewport clamping (16px margin on all sides)
  const margin = 16;
  let cx = Math.max(margin, Math.min(response.canvasX, viewportWidth - bubbleWidth - margin));
  let cy = Math.max(margin, Math.min(response.canvasY, viewportHeight - bubbleHeight - margin));

  // Background
  ctx.beginPath();
  ctx.roundRect(cx, cy, bubbleWidth, bubbleHeight, RESPONSE_BORDER_RADIUS);
  ctx.fillStyle = `rgba(15, 16, 18, ${0.72 * a})`;
  ctx.fill();

  // Border
  ctx.strokeStyle = `rgba(255, 255, 255, ${0.06 * a})`;
  ctx.lineWidth = 1;
  ctx.stroke();

  // Render text lines
  ctx.font = RESPONSE_FONT;
  ctx.fillStyle = `rgba(232, 229, 224, ${a})`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(
      lines[i].text,
      cx + RESPONSE_PADDING_X,
      cy + RESPONSE_PADDING_Y + i * RESPONSE_LINE_HEIGHT,
    );
  }

  return { width: bubbleWidth, height: bubbleHeight };
}

/**
 * Clear the prepared text cache (call on resize or theme change).
 */
export function clearLabelCache(): void {
  preparedCache.clear();
}

// ---------------------------------------------------------------------------
// Adaptive Nav Buttons (Batch 3): pretext-style label rendering on top of
// the dot-density buttons formed by navAttractors. The button "background"
// is the recruited dot cluster itself; this renderer only draws the floating
// label (and a subtle pill outline once formation is essentially complete).
// ---------------------------------------------------------------------------

const NAV_BUTTON_FONT = '500 11px "JetBrains Mono", monospace';

// Iconoir 24x24 viewBox stroke paths. stroke='currentColor', fill='none',
// strokeWidth=1.5, round caps and joins.
const ICONOIR_PATHS: Record<string, string[]> = {
  search: [
    'M15.5 15.5L19 19',
    'M5 11a6 6 0 1012 0 6 6 0 00-12 0z',
  ],
  stack: [
    'M6.5 12.5L12 15l5.5-2.5',
    'M6.5 15.5L12 18l5.5-2.5',
    'M12 6L2.5 9 12 12 21.5 9 12 6z',
  ],
  grid: [
    'M4.5 4.5h6v6h-6zM13.5 4.5h6v6h-6zM4.5 13.5h6v6h-6zM13.5 13.5h6v6h-6z',
  ],
  bolt: [
    'M13 3L4 14h7l-1 7 9-11h-7l1-7z',
  ],
  link: [
    'M14 11.9975C14 9.79131 12.21 8.00244 10 8.00244H6C3.79 8.00244 2 9.79131 2 11.9975C2 14.2036 3.79 15.9925 6 15.9925H7',
    'M10 11.9975C10 14.2036 11.79 15.9925 14 15.9925H18C20.21 15.9925 22 14.2036 22 11.9975C22 9.79131 20.21 8.00244 18 8.00244H17',
  ],
  reply: [
    'M9 14L4 9l5-5',
    'M4 9h10a6 6 0 016 6v0a6 6 0 01-6 6h-3',
  ],
  magnify: [
    'M15.5 15.5L19 19',
    'M5 11a6 6 0 1012 0 6 6 0 00-12 0z',
    'M8 11h6M11 8v6',
  ],
};

const NAV_ICON_SIZE = 16;
const NAV_ICON_GAP = 6;

// Cache Path2D objects per icon id so we don't reparse SVG paths every frame.
const iconPathCache: Map<string, Path2D[]> = new Map();
function getIconPaths(id: string): Path2D[] | null {
  const cached = iconPathCache.get(id);
  if (cached) return cached;
  const raw = ICONOIR_PATHS[id];
  if (!raw) return null;
  const built = raw.map((d) => new Path2D(d));
  iconPathCache.set(id, built);
  return built;
}

export interface NavButtonRenderData {
  /** Canvas x of the button center. */
  cx: number;
  /** Canvas y of the button center. */
  cy: number;
  width: number;
  height: number;
  label: string;
  /** Optional icon id (matches keys in ICONOIR_PATHS). */
  iconId?: string;
  /** 0..1 formation alpha (already eased by tickAttractorPhysics). */
  alpha: number;
  isHovered: boolean;
  /** 0..1 prediction probability. Batch 4 will populate; pass 1.0 for now. */
  prominence: number;
}

/**
 * Render nav button labels (and high-formation pill borders) on top of the
 * recruited dot clusters. Two passes: borders first, then labels, so the
 * border-vs-label z-order stays consistent across all buttons.
 *
 * Note on letter spacing: the spec calls for 0.08em tracking, which native
 * canvas does not support without manual per-glyph layout. We accept native
 * spacing here as the cost/benefit favors simplicity over a marginal visual
 * improvement.
 */
export function renderNavButtons(
  ctx: CanvasRenderingContext2D,
  buttons: NavButtonRenderData[],
): void {
  // Pass 1: pill borders (only when formation is effectively complete).
  for (const b of buttons) {
    if (b.alpha < 0.1) continue;
    if (b.alpha <= 0.9) continue;

    const radius = b.height / 2;
    const x = b.cx - b.width / 2;
    const y = b.cy - b.height / 2;
    const strokeAlpha = (b.isHovered ? 0.15 : 0.08) * b.alpha;

    ctx.beginPath();
    ctx.roundRect(x, y, b.width, b.height, radius);
    ctx.strokeStyle = `rgba(255, 255, 255, ${strokeAlpha})`;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Pass 2: icons + labels.
  ctx.font = NAV_BUTTON_FONT;
  ctx.textBaseline = 'middle';
  for (const b of buttons) {
    if (b.alpha < 0.1) continue;

    const text = b.label.toUpperCase();
    const fillColor = b.isHovered
      ? `rgba(245, 243, 240, ${b.alpha})`
      : `rgba(232, 229, 224, ${b.alpha})`;

    const iconPaths = b.iconId ? getIconPaths(b.iconId) : null;

    if (iconPaths) {
      // Measure label so we can center the icon+label group together.
      ctx.textAlign = 'left';
      const labelWidth = ctx.measureText(text).width;
      const totalInnerWidth = NAV_ICON_SIZE + NAV_ICON_GAP + labelWidth;
      const groupLeftX = b.cx - totalInnerWidth / 2;
      const iconX = groupLeftX;
      const labelX = groupLeftX + NAV_ICON_SIZE + NAV_ICON_GAP;

      // Draw icon (24x24 viewBox scaled to NAV_ICON_SIZE).
      ctx.save();
      ctx.translate(iconX, b.cy - NAV_ICON_SIZE / 2);
      ctx.scale(NAV_ICON_SIZE / 24, NAV_ICON_SIZE / 24);
      ctx.strokeStyle = fillColor;
      // Compensate for the scale so the visual stroke stays at 1.5px.
      ctx.lineWidth = 1.5 * (24 / NAV_ICON_SIZE);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (const path of iconPaths) {
        ctx.stroke(path);
      }
      ctx.restore();

      // Draw label.
      ctx.fillStyle = fillColor;
      ctx.fillText(text, labelX, b.cy);
    } else {
      ctx.textAlign = 'center';
      ctx.fillStyle = fillColor;
      ctx.fillText(text, b.cx, b.cy);
    }
  }
}
