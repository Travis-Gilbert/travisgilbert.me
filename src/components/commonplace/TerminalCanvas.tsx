'use client';

import { useEffect, useRef } from 'react';

/**
 * Subtle canvas background for terminal surfaces.
 *
 * Renders a seeded dot pattern (mulberry32 PRNG) with:
 *   Base: terminal dark (#1A1C22)
 *   Dots: very low opacity, teal tinted
 *   Corner gradient: subtle teal bloom from bottom left
 *   No interactivity (pure decoration, pointer-events: none)
 */

// mulberry32: deterministic PRNG matching DotGrid.tsx
function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface TerminalCanvasProps {
  /** Unique seed for this terminal instance (avoids identical patterns) */
  seed?: number;
  className?: string;
  style?: React.CSSProperties;
}

export default function TerminalCanvas({
  seed = 42,
  className,
  style,
}: TerminalCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    function draw() {
      const dpr = window.devicePixelRatio || 1;
      const w = parent!.clientWidth;
      const h = parent!.clientHeight;

      // Guard: never set canvas to 0x0 (browsers render a broken-image icon)
      // Also cap to 8192 to stay within browser canvas size limits
      if (w < 1 || h < 1) return;
      const cw = Math.min(w, 8192);
      const ch = Math.min(h, 8192);

      canvas!.width = cw * dpr;
      canvas!.height = ch * dpr;
      canvas!.style.width = `${cw}px`;
      canvas!.style.height = `${ch}px`;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Base fill
      ctx!.fillStyle = '#1A1C22';
      ctx!.fillRect(0, 0, cw, ch);

      // Teal gradient bloom from bottom left corner
      const grad = ctx!.createRadialGradient(
        0, ch, 0,
        0, ch, Math.max(cw, ch) * 0.6
      );
      grad.addColorStop(0, 'rgba(45, 95, 107, 0.14)');
      grad.addColorStop(0.4, 'rgba(45, 95, 107, 0.06)');
      grad.addColorStop(1, 'transparent');
      ctx!.fillStyle = grad;
      ctx!.fillRect(0, 0, cw, ch);

      // Seeded dot pattern
      const spacing = 12;
      const cols = Math.ceil(cw / spacing) + 1;
      const rows = Math.ceil(ch / spacing) + 1;
      const rng = mulberry32(seed);

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const r = rng();
          // Render ~24% of positions
          if (r > 0.24) continue;

          const x = col * spacing;
          const y = row * spacing;

          // Teal tinted dots
          const opacity = 0.08 + rng() * 0.10;
          const isBinary = rng() < 0.15;

          if (isBinary) {
            ctx!.fillStyle = `rgba(90, 170, 186, ${opacity * 1.3})`;
            ctx!.font = '7px monospace';
            ctx!.textAlign = 'center';
            ctx!.textBaseline = 'middle';
            ctx!.fillText(rng() < 0.5 ? '0' : '1', x, y);
          } else {
            ctx!.fillStyle = `rgba(90, 170, 186, ${opacity})`;
            ctx!.beginPath();
            ctx!.arc(x, y, 0.8, 0, Math.PI * 2);
            ctx!.fill();
          }
        }
      }
    }

    draw();

    const observer = new ResizeObserver(draw);
    observer.observe(parent);

    return () => observer.disconnect();
  }, [seed]);

  return (
    <canvas
      ref={canvasRef}
      width={1}
      height={1}
      className={className}
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 0,
        ...style,
      }}
    />
  );
}
