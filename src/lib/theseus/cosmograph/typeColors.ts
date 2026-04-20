'use client';

// Map object-type strings to theme-aware colour values.
//
// Cosmograph accepts per-point colour via `pointColorByFn`, which runs in a
// hot path (called for every visible point every frame). The CSS variable
// itself cannot be passed to Cosmograph's WebGL layer directly; we resolve
// it to a hex string at call time via `getComputedStyle(document.body)`.
//
// `resolveTypeColor` caches resolved values per theme (light/dark). When
// `useThemeColor` bumps its `themeVersion` counter, pass it through to
// invalidate the cache.

import { hexToRgb, readCssVar } from '@/hooks/useThemeColor';

/** Object types Theseus emits; every value maps to a --vie-type-* CSS var. */
export const TYPE_TOKEN: Record<string, string> = {
  source:  '--vie-type-source',
  person:  '--vie-type-person',
  concept: '--vie-type-concept',
  claim:   '--vie-type-claim',
  hunch:   '--vie-type-hunch',
  tension: '--vie-type-tension',
  note:    '--vie-type-note',
};

const DEFAULT_COLOR = '#6A5E52';

const cache = new Map<string, string>();
let cachedThemeVersion = -1;

export function resolveTypeColor(type: string | undefined, themeVersion = 0): string {
  if (themeVersion !== cachedThemeVersion) {
    cache.clear();
    cachedThemeVersion = themeVersion;
  }
  const key = type ?? '__default__';
  const existing = cache.get(key);
  if (existing) return existing;

  const token = type ? TYPE_TOKEN[type] : undefined;
  const resolved = token ? readCssVar(token) : DEFAULT_COLOR;
  const value = resolved || DEFAULT_COLOR;
  cache.set(key, value);
  return value;
}

/** Drop cached resolutions. Call this when the document theme flips and the
 *  themeVersion hook is unavailable at the call site. */
export function resetTypeColorCache(): void {
  cache.clear();
  cachedThemeVersion = -1;
}

/**
 * Parses a CSS color string (hex #RGB/#RRGGBB or `rgb(..)`/`rgba(..)`) into
 * a normalized [r, g, b, a] quad on 0..1. Falls back to the default type
 * color if the input is unrecognizable. All CSS vars must be readable
 * before this is called; SSR-safe (returns default).
 */
export function cssColorToRgba(
  value: string,
  alpha = 1,
): [number, number, number, number] {
  const v = value.trim();
  if (!v) return fallbackRgba(alpha);
  if (v.startsWith('#')) {
    try {
      const [r, g, b] = hexToRgb(v);
      if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) {
        return fallbackRgba(alpha);
      }
      return [r / 255, g / 255, b / 255, alpha];
    } catch {
      return fallbackRgba(alpha);
    }
  }
  // Accept rgb(a)() forms emitted by getComputedStyle on some tokens.
  const m = v.match(/rgba?\(([^)]+)\)/i);
  if (m) {
    const parts = m[1].split(/[\s,/]+/).filter(Boolean).map((p) => parseFloat(p));
    if (parts.length >= 3
      && !Number.isNaN(parts[0]) && !Number.isNaN(parts[1]) && !Number.isNaN(parts[2])) {
      const a = parts.length >= 4 && !Number.isNaN(parts[3]) ? parts[3] : alpha;
      return [parts[0] / 255, parts[1] / 255, parts[2] / 255, a];
    }
  }
  return fallbackRgba(alpha);
}

function fallbackRgba(alpha: number): [number, number, number, number] {
  // DEFAULT_COLOR is a static hex constant; hexToRgb can throw only if
  // someone changes it to an invalid literal. In that (developer-visible)
  // case, fall through to a neutral tone resolved from the same constant
  // at parse time to keep the canvas from crashing the render loop.
  try {
    const [r, g, b] = hexToRgb(DEFAULT_COLOR);
    return [r / 255, g / 255, b / 255, alpha];
  } catch {
    const v = readCssVar('--color-rough');
    if (v && v.startsWith('#')) {
      try {
        const [r, g, b] = hexToRgb(v);
        return [r / 255, g / 255, b / 255, alpha];
      } catch {
        // fall through
      }
    }
    return [0, 0, 0, alpha];
  }
}

/**
 * Resolve an object type to its VIE-token color as an RGBA float quad.
 * Canvas-facing helper that short-circuits the two-step resolve+convert
 * pattern the renderer would otherwise repeat per point. Subscribes to
 * `themeVersion` via the shared cache in `resolveTypeColor`.
 */
export function resolveTypeColorRgba(
  type: string | undefined,
  themeVersion = 0,
  alpha = 1,
): [number, number, number, number] {
  const hex = resolveTypeColor(type, themeVersion);
  return cssColorToRgba(hex, alpha);
}

/**
 * Read a CSS variable and return it as an RGBA float quad. Used for
 * hover-ring and other VIE-token colors the canvas consumes outside of
 * the type palette. Returns the fallback type color if the var is unset.
 */
export function cssVarToRgba(
  cssVarName: string,
  alpha = 1,
): [number, number, number, number] {
  const raw = readCssVar(cssVarName);
  return cssColorToRgba(raw || DEFAULT_COLOR, alpha);
}

/**
 * Mix a base RGBA quad toward a CSS-variable color by `mixFactor` (0..1).
 * At mixFactor = 0 the base is returned unchanged; at 1 the token color
 * fully replaces it. Alpha is preserved from the base. Used for the
 * hypothesis color-mix nudge (M4: token-derived, never hardcoded).
 *
 * Cached per (tokenVar, mixFactor, themeVersion) so a full re-encode of
 * the point pool does not re-read + re-parse the CSS var on every node.
 */
const tokenColorCache = new Map<string, [number, number, number, number]>();
let tokenCacheThemeVersion = -1;

function resolveTokenQuad(tokenVar: string, themeVersion: number): [number, number, number, number] {
  if (themeVersion !== tokenCacheThemeVersion) {
    tokenColorCache.clear();
    tokenCacheThemeVersion = themeVersion;
  }
  const cached = tokenColorCache.get(tokenVar);
  if (cached) return cached;
  const quad = cssVarToRgba(tokenVar, 1);
  tokenColorCache.set(tokenVar, quad);
  return quad;
}

export function mixTowardTokenRgba(
  base: [number, number, number, number],
  tokenVar: string,
  mixFactor: number,
  themeVersion = 0,
): [number, number, number, number] {
  const m = Math.max(0, Math.min(1, mixFactor));
  if (m === 0) return base;
  const [tr, tg, tb] = resolveTokenQuad(tokenVar, themeVersion);
  // Linear RGB mix. The base quad is already normalized 0..1 from
  // resolveTypeColorRgba, so this is a straight lerp on the 0..1 plane.
  const r = base[0] * (1 - m) + tr * m;
  const g = base[1] * (1 - m) + tg * m;
  const b = base[2] * (1 - m) + tb * m;
  return [r, g, b, base[3]];
}
