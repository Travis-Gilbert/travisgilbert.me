'use client';

import { useRef, useEffect } from 'react';

interface PatternImageProps {
  seed?: string;
  height?: number;
  color?: string;
  className?: string;
}

/**
 * PatternImage: generative canvas that produces a unique topographic pattern
 * from a seed string (typically the essay slug). Deterministic: same seed
 * always yields the same visual. Used as a fallback when no YouTube thumbnail
 * or curated image is available.
 *
 * Three layers:
 *   1. Grid dots with radial fade
 *   2. Organic curves (bezier-like line segments)
 *   3. Topographic contour rings with wobble
 */
export default function PatternImage({
  seed = 'default',
  height = 160,
  color = 'var(--color-terracotta)',
  className = '',
}: PatternImageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const logicalW = canvas.clientWidth || 600;
    const logicalH = height;

    canvas.width = logicalW * dpr;
    canvas.height = logicalH * dpr;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    const w = logicalW;
    const h = logicalH;

    // Seeded PRNG from string
    let s = 0;
    for (let i = 0; i < seed.length; i++) {
      s = ((s << 5) - s + seed.charCodeAt(i)) | 0;
    }
    const rand = () => {
      s = (s * 16807) % 2147483647;
      return (s & 0x7fffffff) / 0x7fffffff;
    };

    // Parse CSS color to RGB via a temporary element
    const tempEl = document.createElement('div');
    tempEl.style.color = color;
    document.body.appendChild(tempEl);
    const rgb = getComputedStyle(tempEl).color;
    document.body.removeChild(tempEl);
    const match = rgb.match(/\d+/g);
    const [r, g, b] = match ? match.map(Number) : [180, 90, 45];

    // Get the paper-alt color from CSS custom property
    const paperAlt =
      getComputedStyle(document.documentElement)
        .getPropertyValue('--color-bg-alt')
        .trim() || '#E8E0D6';

    // Layer 0: warm paper base
    ctx.fillStyle = paperAlt;
    ctx.fillRect(0, 0, w, h);

    // Layer 1: grid dots with radial fade
    for (let x = 10; x < w; x += 16) {
      for (let y = 10; y < h; y += 16) {
        const dist = Math.sqrt((x - w / 2) ** 2 + (y - h / 2) ** 2);
        const fade = Math.max(0, 1 - dist / (w * 0.6));
        if (rand() > 0.3) {
          ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${0.08 * fade})`;
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }

    // Layer 1.5: faint blueprint grid
    ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.04)`;
    ctx.lineWidth = 0.5;
    for (let x = 0; x < w; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Layer 2: organic curves
    const lineCount = 3 + Math.floor(rand() * 4);
    for (let i = 0; i < lineCount; i++) {
      ctx.beginPath();
      ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${0.10 + rand() * 0.08})`;
      ctx.lineWidth = 1.0 + rand() * 0.6;
      const startX = rand() * w;
      const startY = rand() * h;
      ctx.moveTo(startX, startY);
      for (let j = 0; j < 4; j++) {
        ctx.lineTo(
          startX + (rand() - 0.5) * w * 0.8,
          startY + (rand() - 0.5) * h * 0.8
        );
      }
      ctx.stroke();
    }

    // Layer 3: topographic contour lines
    for (let i = 0; i < 5; i++) {
      const cx = rand() * w;
      const cy = rand() * h;
      const radius = 30 + rand() * 80;
      ctx.beginPath();
      ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${0.08 + rand() * 0.06})`;
      ctx.lineWidth = 0.8;
      for (let a = 0; a < Math.PI * 2; a += 0.05) {
        const wobble = rand() * 6;
        const px = cx + (radius + wobble) * Math.cos(a);
        const py = cy + (radius + wobble) * Math.sin(a);
        if (a === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
    }
  }, [seed, color, height]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{
        width: '100%',
        height,
        borderRadius: '2px 2px 0 0',
        display: 'block',
      }}
    />
  );
}
