'use client';

// Inline-text layout helpers backed by pretext.
//
// For Theseus chat, the first pretext use case is height measurement
// without DOM reflow: when a streamed message grows word by word, we can
// ask pretext for the predicted height at the composer's max-width and
// reserve that space in the scroll viewport. This keeps the scroll
// anchor stable even as new lines wrap.
//
// Canvas-rendered inline text (line-by-line materialisation with citation
// anchors) is a later refinement; this file ships the measurement path and
// the parse-into-runs helper that TextPart consumes.

import { prepare, layout, type PreparedText } from '@chenglou/pretext';
import { PROSE_FONT, PROSE_LINE_HEIGHT } from './fonts';
import type { InlineSegment } from '@/components/theseus/chat/parts/CitationPart';

// Tiny cache keyed by font+text so repeated renders during streaming do
// not re-segment and re-measure the full block. Keys are font+'\u0001'+text.
const prepareCache = new Map<string, PreparedText>();
const CACHE_LIMIT = 200;

function cacheSet(key: string, value: PreparedText): void {
  if (prepareCache.size >= CACHE_LIMIT) {
    const firstKey = prepareCache.keys().next().value;
    if (firstKey !== undefined) prepareCache.delete(firstKey);
  }
  prepareCache.set(key, value);
}

/** Measure the predicted height of a text block at a given width, using
 *  pretext's cached word-width arithmetic. Returns 0 if called during SSR. */
export function measureTextHeight(
  text: string,
  width: number,
  font: string = PROSE_FONT,
  lineHeight: number = PROSE_LINE_HEIGHT,
): { height: number; lineCount: number } {
  if (typeof document === 'undefined') return { height: 0, lineCount: 0 };
  if (!text || width <= 0) return { height: 0, lineCount: 0 };

  const key = `${font}\u0001${text}`;
  let prepared = prepareCache.get(key);
  if (!prepared) {
    prepared = prepare(text, font);
    cacheSet(key, prepared);
  }
  const { height, lineCount } = layout(prepared, width, lineHeight);
  return { height, lineCount };
}

/** Strip citation anchors so pretext measures the visible text only. */
export function flattenForMeasurement(segments: InlineSegment[]): string {
  let out = '';
  for (const seg of segments) {
    if (seg.kind === 'text') out += seg.value;
    else out += seg.anchor;
  }
  return out;
}

/** Drop the pretext cache. Useful on theme-driven font changes. */
export function resetPretextCache(): void {
  prepareCache.clear();
}
