'use client';

import { useRef, useEffect, type ReactNode } from 'react';
import rough from 'roughjs';

interface RoughBoxProps {
  children: ReactNode;
  padding?: number;
  roughness?: number;
  strokeWidth?: number;
  stroke?: string;
  seed?: number;
  /** Show blueprint grid lines inside card (default: true) */
  grid?: boolean;
  /** Show warm shadow + bg-surface (default: true) */
  elevated?: boolean;
  /** Enable hover lift animation (default: false — opt-in for linked cards) */
  hover?: boolean;
}

export default function RoughBox({
  children,
  padding = 16,
  roughness = 1.2,
  strokeWidth = 1,
  stroke = '#3A3632',
  seed,
  grid = true,
  elevated = true,
  hover = false,
}: RoughBoxProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    function draw() {
      const rect = container!.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const w = rect.width;
      const h = rect.height;

      canvas!.width = w * dpr;
      canvas!.height = h * dpr;
      canvas!.style.width = `${w}px`;
      canvas!.style.height = `${h}px`;

      const ctx = canvas!.getContext('2d');
      if (!ctx) return;

      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, w, h);

      const rc = rough.canvas(canvas!);
      rc.rectangle(2, 2, w - 4, h - 4, {
        roughness,
        strokeWidth,
        stroke,
        bowing: 1,
        seed,
      });
    }

    draw();

    const observer = new ResizeObserver(() => draw());
    observer.observe(container);

    return () => observer.disconnect();
  }, [roughness, strokeWidth, stroke, seed]);

  // Build className string from props
  const classes = [
    'relative',
    elevated ? 'surface-elevated' : '',
    grid ? 'surface-grid' : '',
    hover ? 'surface-hover' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      ref={containerRef}
      className={classes}
      style={{ padding: `${padding}px` }}
    >
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
