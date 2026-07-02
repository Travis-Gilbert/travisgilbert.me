'use client';

/**
 * Runtime token resolution for libraries that demand literal values at
 * configuration time (Monaco defineTheme, xterm ITheme). Source keeps zero
 * raw colors, px, or ms literals; everything here reads the computed styles
 * of a mounted element, so the literals come from tokens.gen.css at runtime
 * and follow light/dark automatically on remount.
 */

/** Raw custom-property value from the computed styles of an element. */
export function tokenValue(name: string, el?: HTMLElement | null): string {
  if (typeof window === 'undefined') return '';
  return getComputedStyle(el ?? document.documentElement).getPropertyValue(name).trim();
}

/**
 * Resolve a color token to a hex literal. The tokens are authored in oklch,
 * which Monaco's and xterm's color parsers do not accept, so a 1x1 canvas
 * normalizes any CSS color the browser understands into sRGB bytes.
 */
export function tokenColorHex(name: string, el?: HTMLElement | null): string | null {
  const raw = tokenValue(name, el);
  if (!raw) return null;
  return cssColorToHex(raw);
}

/**
 * Resolve a type-scale token (e.g. --text--1, a clamp() in rem) to the pixel
 * number libraries want for fontSize: mount a probe span using the token and
 * read its computed font-size.
 */
export function tokenFontSizePx(name: string, container: HTMLElement): number {
  const probe = document.createElement('span');
  probe.style.fontSize = `var(${name})`;
  probe.style.position = 'absolute';
  probe.style.visibility = 'hidden';
  container.appendChild(probe);
  const px = Number.parseFloat(getComputedStyle(probe).fontSize);
  probe.remove();
  if (Number.isFinite(px) && px > 0) return px;
  // Fallback: the document's base font size (still resolved, never hardcoded).
  return Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
}

function cssColorToHex(color: string): string | null {
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.fillStyle = color; // invalid strings leave fillStyle unchanged; detect below
  ctx.fillRect(0, 0, 1, 1);
  const data = ctx.getImageData(0, 0, 1, 1).data;
  const alpha = data[3];
  if (alpha === 0 && color !== 'transparent') return null;
  return `#${byteHex(data[0])}${byteHex(data[1])}${byteHex(data[2])}`;
}

function byteHex(value: number): string {
  return value.toString(16).padStart(2, '0');
}
