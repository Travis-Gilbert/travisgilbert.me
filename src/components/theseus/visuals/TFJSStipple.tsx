/**
 * TFJSStipple — portrait/figure renderer for the backend's `tfjs_stipple`
 * visual type. Draws stipple points on a canvas when
 * `visual.structured.stipple_points: Array<[x, y, weight?]>` is present.
 * Points are normalized to [0, 1]; the canvas scales them to viewport.
 *
 * Uses 2D canvas for simplicity — the backend's stipple generator
 * produces few enough points (~5000) that WebGL isn't needed here.
 * Rendering is deterministic and SSR-safe (points come pre-generated
 * server-side).
 */

'use client';

import type { FC } from 'react';
import { useEffect, useMemo, useRef } from 'react';
import type { StructuredVisual, StructuredVisualRegion } from '@/lib/theseus-types';

interface TFJSStippleProps {
  visual: StructuredVisual;
  onRegionHover?: (region: StructuredVisualRegion | null) => void;
  onRegionSelect?: (region: StructuredVisualRegion) => void;
}

interface StipplePoint {
  x: number;
  y: number;
  weight: number;
}

function readPoints(visual: StructuredVisual): StipplePoint[] {
  const raw = visual.structured?.stipple_points;
  if (!Array.isArray(raw)) return [];
  const points: StipplePoint[] = [];
  for (const p of raw) {
    if (!Array.isArray(p) || p.length < 2) continue;
    const x = Number(p[0]);
    const y = Number(p[1]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    const w = p.length > 2 && Number.isFinite(Number(p[2])) ? Number(p[2]) : 1;
    points.push({ x, y, weight: w });
  }
  return points;
}

const WIDTH = 420;
const HEIGHT = 420;

const TFJSStipple: FC<TFJSStippleProps> = ({ visual }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const points = useMemo(() => readPoints(visual), [visual]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || points.length === 0) return;

    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    // Guard against broken-image icons / browser canvas size caps.
    const cw = Math.min(Math.max(1, WIDTH), 8192);
    const ch = Math.min(Math.max(1, HEIGHT), 8192);
    canvas.width = cw * dpr;
    canvas.height = ch * dpr;
    canvas.style.width = `${cw}px`;
    canvas.style.height = `${ch}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, cw, ch);
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--color-ink').trim() || '#1a1a1d';

    for (const p of points) {
      const cx = p.x * cw;
      const cy = p.y * ch;
      const r = Math.max(0.5, Math.min(2.4, 0.6 + p.weight * 1.4));
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [points]);

  if (points.length === 0) return null;

  return (
    <div
      style={{
        background: 'var(--color-paper, #fdfbf6)',
        border: '1px solid color-mix(in srgb, var(--color-ink) 12%, transparent)',
        borderRadius: 6,
        padding: 12,
        boxShadow: 'var(--shadow-warm-sm)',
        display: 'flex',
        justifyContent: 'center',
      }}
    >
      <canvas ref={canvasRef} role="img" aria-label="Stipple portrait rendering" />
    </div>
  );
};

export default TFJSStipple;
