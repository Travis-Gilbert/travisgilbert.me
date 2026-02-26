'use client';

import { useEffect, useState } from 'react';

/**
 * Reads a CSS custom property value from :root (document.documentElement).
 * Must be called in a client-side context (useEffect, event handler).
 */
export function readCssVar(name: string): string {
  if (typeof document === 'undefined') return '';
  return getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
}

/**
 * Converts a hex color string (#RGB or #RRGGBB) to an [R, G, B] tuple.
 */
export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  if (h.length === 3) {
    return [
      parseInt(h[0] + h[0], 16),
      parseInt(h[1] + h[1], 16),
      parseInt(h[2] + h[2], 16),
    ];
  }
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

/** Maps tint name to the CSS custom property name (for getComputedStyle reads) */
export const TINT_CSS_VAR: Record<string, string> = {
  terracotta: '--color-terracotta',
  teal: '--color-teal',
  gold: '--color-gold',
  neutral: '--color-rough',
};

/** Maps tint name to a CSS variable reference (for inline styles that auto-update) */
export const TINT_CSS_REF: Record<string, string> = {
  terracotta: 'var(--color-terracotta)',
  teal: 'var(--color-teal)',
  gold: 'var(--color-gold)',
  neutral: 'var(--color-rough)',
};

/**
 * Returns a counter that increments whenever html[data-theme] changes.
 * Add to useEffect dependency arrays to trigger canvas redraws on theme switch.
 */
export function useThemeVersion(): number {
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.attributeName === 'data-theme') {
          setVersion((v) => v + 1);
          break;
        }
      }
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    return () => observer.disconnect();
  }, []);

  return version;
}
