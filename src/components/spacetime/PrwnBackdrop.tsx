'use client';

/**
 * Mulberry32 PRWN data-grid backdrop (charcoal, single-tone).
 *
 * Mirrors the main site's DotGrid: a regular 20px-spaced grid where
 * ~20% of cells render `0`/`1` glyphs and the rest render dots, all
 * in a single warm-charcoal tone (matches DotGrid's default RGB
 * [160, 154, 144] / charcoal ink).
 *
 * Two opacity fields multiply on top of the base:
 *   1. A "compute fade" at the top of the viewport — the upper band
 *      fades out so the topmost row of dots reads as a thinning
 *      transmission rather than a hard edge.
 *   2. A corner-weight Gaussian field anchored on the upper-right and
 *      bottom-left, so density visibly clusters in those corners.
 *
 * Pure canvas; deterministic per viewport size.
 */

import { useEffect, useRef } from 'react';

const SPACING = 20;
const DOT_RADIUS = 0.85;
const BINARY_DENSITY = 0.2;

// Single charcoal tone, matching DotGrid's warm-grey default.
const DOT_R = 160;
const DOT_G = 154;
const DOT_B = 144;

function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Max of two Gaussian bumps centred on UR (1,0) and BL (0,1). */
function cornerWeight(nx: number, ny: number): number {
  const sigma = 0.55;
  const dxUR = nx - 1;
  const dyUR = ny;
  const ur = Math.exp(-(dxUR * dxUR + dyUR * dyUR) / (2 * sigma * sigma));
  const dxBL = nx;
  const dyBL = ny - 1;
  const bl = Math.exp(-(dxBL * dxBL + dyBL * dyBL) / (2 * sigma * sigma));
  return Math.max(0.18, Math.max(ur, bl));
}

/** Top fade: dots near the top of the viewport ramp from 0 to full. */
function topFade(ny: number): number {
  const fadeStart = 0.0;
  const fadeEnd = 0.18;
  if (ny <= fadeStart) return 0;
  if (ny >= fadeEnd) return 1;
  const t = (ny - fadeStart) / (fadeEnd - fadeStart);
  return t * t * (3 - 2 * t); // smoothstep
}

export default function PrwnBackdrop() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const draw = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const w = Math.max(1, Math.min(window.innerWidth, 8192));
      const h = Math.max(1, Math.min(window.innerHeight, 8192));
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.font = '9px var(--font-mono), "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const cols = Math.ceil(w / SPACING);
      const rows = Math.ceil(h / SPACING);
      const offsetX = (w - (cols - 1) * SPACING) / 2;
      const offsetY = (h - (rows - 1) * SPACING) / 2;

      const rng = mulberry32(73);
      const baseOpacity = 0.6;

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const cx = offsetX + c * SPACING;
          const cy = offsetY + r * SPACING;
          const nx = cx / w;
          const ny = cy / h;
          const weight = cornerWeight(nx, ny);
          const fade = topFade(ny);
          const cellRng = rng();
          const opacity = baseOpacity * weight * fade * (0.7 + cellRng * 0.4);
          const isBinary = rng() < BINARY_DENSITY;
          // Skip glyphs whose computed opacity would be invisible.
          if (opacity < 0.02) continue;

          const colorStr = `rgba(${DOT_R}, ${DOT_G}, ${DOT_B}, ${opacity})`;
          if (isBinary) {
            ctx.fillStyle = colorStr;
            const ch = rng() < 0.5 ? '0' : '1';
            ctx.fillText(ch, cx, cy);
          } else {
            ctx.beginPath();
            ctx.arc(cx, cy, DOT_RADIUS, 0, Math.PI * 2);
            ctx.fillStyle = colorStr;
            ctx.fill();
          }
        }
      }
    };

    draw();
    window.addEventListener('resize', draw);
    return () => window.removeEventListener('resize', draw);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 1,
      }}
    />
  );
}
