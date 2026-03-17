'use client';

import { useRef, useEffect, type ReactNode } from 'react';
import rough from 'roughjs';

function hashSeed(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

interface RoughBorderProps {
  color?: string;
  strokeWidth?: number;
  roughness?: number;
  seed?: number | string;
  padding?: number;
  glow?: boolean;
  glowColor?: string;
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export default function RoughBorder({
  color,
  strokeWidth = 0.8,
  roughness = 0.8,
  seed,
  padding = 0,
  glow = false,
  glowColor,
  children,
  className,
  style,
}: RoughBorderProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const numericSeed = typeof seed === 'string' ? hashSeed(seed) : seed;

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    function draw() {
      const rect = container!.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const w = rect.width;
      const h = rect.height;
      if (w < 1 || h < 1) return;

      canvas!.width = w * dpr;
      canvas!.height = h * dpr;
      canvas!.style.width = `${w}px`;
      canvas!.style.height = `${h}px`;

      const ctx = canvas!.getContext('2d');
      if (!ctx) return;
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, w, h);

      // Glow layer (behind the stroke)
      if (glow && glowColor) {
        const grad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.6);
        grad.addColorStop(0, `${glowColor}0A`);
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
      }

      const rc = rough.canvas(canvas!);
      // Derive stroke from glowColor (type color) at 40% opacity for visibility
      // on the dark CommonPlace chrome. Falls back to --cp-border only when no
      // type color is available.
      const strokeColor = color
        || (glowColor ? `${glowColor}66` : null)
        || getComputedStyle(container!).getPropertyValue('--cp-border').trim()
        || 'rgba(244, 243, 240, 0.18)';

      rc.rectangle(1.5, 1.5, w - 3, h - 3, {
        roughness,
        strokeWidth,
        stroke: strokeColor,
        bowing: 0.8,
        seed: numericSeed,
      });
    }

    draw();
    const observer = new ResizeObserver(() => draw());
    observer.observe(container);
    return () => observer.disconnect();
  }, [color, strokeWidth, roughness, numericSeed, glow, glowColor]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ position: 'relative', padding, ...style }}
    >
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0 }}
      />
      <div style={{ position: 'relative', zIndex: 1 }}>{children}</div>
    </div>
  );
}
