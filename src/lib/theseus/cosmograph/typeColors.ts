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

import { readCssVar } from '@/hooks/useThemeColor';

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
