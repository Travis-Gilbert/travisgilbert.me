'use client';

import { useEffect, useMemo, useRef } from 'react';

/**
 * DotField: canvas dot pattern for the Model View workspace surface.
 *
 * Adapts the PaneDotGrid inverted-vignette compositing pattern for
 * workbench backgrounds. Canvas-based (not CSS) per project convention.
 * Same PRNG, binary scatter, and dimension guards as PaneDotGrid.
 *
 * Unlike PaneDotGrid, this uses lighter dot opacity and a tighter
 * vignette falloff to sit behind module bricks without competing.
 */

function djb2(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0;
  }
  return hash >>> 0;
}

function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface DotFieldProps {
  seed?: number | string;
  dotColor?: [number, number, number];
  dotOpacity?: number;
  spacing?: number;
  dotRadius?: number;
  binaryDensity?: number;
  className?: string;
  style?: React.CSSProperties;
}

export default function DotField({
  seed = 'model-workspace',
  dotColor: dotColorProp,
  dotOpacity = 0.05,
  spacing = 20,
  dotRadius = 0.5,
  binaryDensity = 0.06,
  className,
  style,
}: DotFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dotColor = useMemo<[number, number, number]>(
    () => dotColorProp ?? [36, 30, 24],
    [dotColorProp],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    function draw() {
      if (window.innerWidth < 768) {
        canvas!.style.display = 'none';
        return;
      }
      canvas!.style.display = '';

      const dpr = window.devicePixelRatio || 1;
      const w = parent!.clientWidth;
      const h = parent!.clientHeight;

      if (w < 1 || h < 1) return;
      const cw = Math.min(w, 8192);
      const ch = Math.min(h, 8192);

      canvas!.width = cw * dpr;
      canvas!.height = ch * dpr;
      canvas!.style.width = `${cw}px`;
      canvas!.style.height = `${ch}px`;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx!.clearRect(0, 0, cw, ch);

      const [r, g, b] = dotColor;
      const cols = Math.ceil(cw / spacing) + 1;
      const rows = Math.ceil(ch / spacing) + 1;
      const numericSeed = typeof seed === 'string' ? djb2(seed) : seed;
      const rng = mulberry32(numericSeed);

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const rand = rng();
          if (rand > 0.55) continue;

          const x = col * spacing;
          const y = row * spacing;
          const opacity = dotOpacity + rng() * 0.03;
          const isBinary = rng() < binaryDensity;

          if (isBinary) {
            ctx!.fillStyle = `rgba(${r}, ${g}, ${b}, ${opacity * 1.1})`;
            ctx!.font = `${Math.round(spacing * 0.35)}px monospace`;
            ctx!.textAlign = 'center';
            ctx!.textBaseline = 'middle';
            ctx!.fillText(rng() < 0.5 ? '0' : '1', x, y);
          } else {
            ctx!.fillStyle = `rgba(${r}, ${g}, ${b}, ${opacity})`;
            ctx!.beginPath();
            ctx!.arc(x, y, dotRadius, 0, Math.PI * 2);
            ctx!.fill();
          }
        }
      }

      // Inverted vignette: erase dots from center
      const cx = cw / 2;
      const cy = ch / 2;
      const cornerDist = Math.sqrt(cx * cx + cy * cy);

      ctx!.globalCompositeOperation = 'destination-out';
      const grad = ctx!.createRadialGradient(cx, cy, 0, cx, cy, cornerDist);
      grad.addColorStop(0, 'rgba(0, 0, 0, 1)');
      grad.addColorStop(0.35, 'rgba(0, 0, 0, 0.9)');
      grad.addColorStop(0.65, 'rgba(0, 0, 0, 0.4)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0.08)');

      ctx!.fillStyle = grad;
      ctx!.fillRect(0, 0, cw, ch);
      ctx!.globalCompositeOperation = 'source-over';
    }

    draw();

    const observer = new ResizeObserver(draw);
    observer.observe(parent);

    return () => observer.disconnect();
  }, [seed, dotColor, dotOpacity, spacing, dotRadius, binaryDensity]);

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
