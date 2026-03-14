'use client';

import { useEffect, useRef } from 'react';

/**
 * PaneDotGrid: contained canvas dot pattern for CommonPlace panes.
 *
 * Follows the TerminalCanvas containment pattern (ResizeObserver on parent,
 * absolute positioning, pointer-events: none) but uses the warm vellum
 * aesthetic from DotGrid.tsx (seeded PRNG, binary scatter, subtle opacity).
 *
 * Three-layer composite rendering:
 *   Layer 0: subtle radial bloom from bottom-left corner (same technique
 *            as TerminalCanvas.tsx) using the dot color at low opacity,
 *            adding warmth and depth so the surface doesn't feel flat
 *   Layer 1: uniform dot field at consistent opacity
 *   Layer 2: radial gradient overlay from center (opaque pane bg) to
 *            semi-transparent at corners, creating an inverted vignette
 *            that never fully exposes dots (min alpha ~0.18 at edges)
 *
 * This keeps dots visible at corners/edges while the center stays clear,
 * and the bloom adds a sense of light source so panes feel dimensional.
 *
 * No mouse interactivity (pane content is scrollable and interactive).
 * Each pane gets a unique seed so patterns are visually distinct.
 */

// djb2: string to 32-bit integer hash (same algorithm as HeroAccents.tsx)
function djb2(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0;
  }
  return hash >>> 0;
}

// mulberry32: deterministic PRNG matching DotGrid.tsx and TerminalCanvas.tsx
function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface PaneDotGridProps {
  /** Unique seed for this pane (string IDs are hashed via djb2) */
  seed?: number | string;
  /** Dot color as [r, g, b]; defaults to warm graphite */
  dotColor?: [number, number, number];
  /** Base dot opacity; defaults to 0.22 */
  dotOpacity?: number;
  /** Grid spacing in CSS px; defaults to 20 (matches main site DotGrid) */
  spacing?: number;
  /** Dot radius in CSS px; defaults to 0.75 */
  dotRadius?: number;
  /** Fraction of dots replaced with binary characters; defaults to 0.10 */
  binaryDensity?: number;
  /** Pane background color as [r, g, b] for the vignette overlay; defaults to #F4F3F0 */
  bgColor?: [number, number, number];
  /** Enable radial inverted vignette (dots at corners, transparent center); defaults to true */
  vignette?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export default function PaneDotGrid({
  seed = 7,
  dotColor = [24, 24, 27],
  dotOpacity = 0.22,
  spacing = 20,
  dotRadius = 0.75,
  binaryDensity = 0.10,
  bgColor = [244, 243, 240],
  vignette = true,
  className,
  style,
}: PaneDotGridProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;

    const ctx = canvas.getContext('2d', { alpha: true });
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

      // Transparent background (let CSS bg-color show through)
      ctx!.clearRect(0, 0, cw, ch);

      // ── Layer 0: warm bloom gradient from bottom-left ──
      // Same technique as TerminalCanvas.tsx teal bloom, but using the
      // dot color at very low opacity for a subtle warmth/depth cue.
      const [r, g, b] = dotColor;
      const bloom = ctx!.createRadialGradient(
        0, ch, 0,
        0, ch, Math.max(cw, ch) * 0.7
      );
      bloom.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.06)`);
      bloom.addColorStop(0.4, `rgba(${r}, ${g}, ${b}, 0.025)`);
      bloom.addColorStop(1, 'transparent');
      ctx!.fillStyle = bloom;
      ctx!.fillRect(0, 0, cw, ch);

      // ── Layer 1: uniform dot field ──
      const cols = Math.ceil(cw / spacing) + 1;
      const rows = Math.ceil(ch / spacing) + 1;
      const numericSeed = typeof seed === 'string' ? djb2(seed) : seed;
      const rng = mulberry32(numericSeed);

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const rand = rng();

          // Render ~60% of grid positions
          if (rand > 0.60) continue;

          const x = col * spacing;
          const y = row * spacing;

          // Per-dot opacity variation for organic feel
          const opacity = dotOpacity + rng() * 0.04;
          const isBinary = rng() < binaryDensity;

          if (isBinary) {
            ctx!.fillStyle = `rgba(${r}, ${g}, ${b}, ${opacity * 1.2})`;
            ctx!.font = `${Math.round(spacing * 0.38)}px monospace`;
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

      // ── Layer 2: radial gradient overlay (inverted vignette) ──
      // Opaque at center (covers dots), transparent at corners (reveals dots).
      // Same composite technique as DotGrid.tsx drawInversionGradient().
      if (vignette) {
        const cx = cw / 2;
        const cy = ch / 2;
        const cornerDist = Math.sqrt(cx * cx + cy * cy);

        const [br, bg, bb] = bgColor;

        const grad = ctx!.createRadialGradient(cx, cy, 0, cx, cy, cornerDist);
        // Center: mostly opaque (hides dots in content zone)
        grad.addColorStop(0, `rgba(${br}, ${bg}, ${bb}, 0.85)`);
        // 50% radius: gentle fade begins
        grad.addColorStop(0.5, `rgba(${br}, ${bg}, ${bb}, 0.55)`);
        // 75% radius: dots becoming visible
        grad.addColorStop(0.75, `rgba(${br}, ${bg}, ${bb}, 0.25)`);
        // Corners: thin wash so dots stay softened near UI elements
        grad.addColorStop(1, `rgba(${br}, ${bg}, ${bb}, 0.1)`);

        ctx!.fillStyle = grad;
        ctx!.fillRect(0, 0, cw, ch);
      }
    }

    draw();

    const observer = new ResizeObserver(draw);
    observer.observe(parent);

    return () => observer.disconnect();
  }, [seed, dotColor, dotOpacity, spacing, dotRadius, binaryDensity, bgColor, vignette]);

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
