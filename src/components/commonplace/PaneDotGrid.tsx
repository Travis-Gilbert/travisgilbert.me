'use client';

import { useEffect, useRef } from 'react';

/**
 * PaneDotGrid: contained canvas dot pattern for CommonPlace panes.
 *
 * Follows the TerminalCanvas containment pattern (ResizeObserver on parent,
 * absolute positioning, pointer-events: none) but uses the warm vellum
 * aesthetic from DotGrid.tsx (seeded PRNG, binary scatter, subtle opacity).
 *
 * Uses a radial inverted vignette: dots are most visible at the corners
 * and edges of the pane, fading to near-transparent toward the center.
 * This keeps the texture present without competing with pane content.
 * The vignette uses Hermite smoothstep easing for a soft transition.
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

// Hermite smoothstep: same easing as DotGrid.tsx drawInversionGradient
function smoothstep(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
}

/**
 * Radial vignette tuning constants.
 * VIGNETTE_INNER: normalized radius where dots begin to appear (0 = center).
 * Below this radius, dots are fully suppressed. A higher value creates a
 * larger clear zone in the center of the pane.
 * VIGNETTE_POWER: controls how aggressively opacity ramps from inner edge
 * to corners. Higher values push more opacity toward the very edges.
 */
const VIGNETTE_INNER = 0.45;
const VIGNETTE_POWER = 1.8;

interface PaneDotGridProps {
  /** Unique seed for this pane (string IDs are hashed via djb2) */
  seed?: number | string;
  /** Dot color as [r, g, b]; defaults to warm graphite */
  dotColor?: [number, number, number];
  /** Base dot opacity; defaults to 0.30 for visible coverage */
  dotOpacity?: number;
  /** Grid spacing in CSS px; defaults to 20 (matches main site DotGrid) */
  spacing?: number;
  /** Dot radius in CSS px; defaults to 0.75 */
  dotRadius?: number;
  /** Fraction of dots replaced with binary characters; defaults to 0.15 */
  binaryDensity?: number;
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

      canvas!.width = w * dpr;
      canvas!.height = h * dpr;
      canvas!.style.width = `${w}px`;
      canvas!.style.height = `${h}px`;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Transparent background (let CSS bg-color show through)
      ctx!.clearRect(0, 0, w, h);

      const cols = Math.ceil(w / spacing) + 1;
      const rows = Math.ceil(h / spacing) + 1;
      const numericSeed = typeof seed === 'string' ? djb2(seed) : seed;
      const rng = mulberry32(numericSeed);

      const [r, g, b] = dotColor;

      // Radial vignette geometry: center point and corner distance
      const cx = w / 2;
      const cy = h / 2;
      const cornerDist = Math.sqrt(cx * cx + cy * cy);

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const rand = rng();

          // Render ~60% of grid positions (sparser than before)
          if (rand > 0.60) continue;

          const x = col * spacing;
          const y = row * spacing;

          // Radial inverted vignette: 0.0 at center, 1.0 at corners
          let vignetteFactor = 1.0;
          if (vignette && cornerDist > 0) {
            const dx = x - cx;
            const dy = y - cy;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const normalizedDist = dist / cornerDist;

            if (normalizedDist < VIGNETTE_INNER) {
              // Inside the clear zone: dots nearly invisible
              vignetteFactor = 0.04;
            } else {
              // Ramp from inner edge to corners with power curve
              const t = (normalizedDist - VIGNETTE_INNER) / (1.0 - VIGNETTE_INNER);
              vignetteFactor = smoothstep(t);
              vignetteFactor = Math.pow(vignetteFactor, 1.0 / VIGNETTE_POWER);
            }
          }

          // Per-dot opacity variation + vignette multiplier
          const baseOpacity = dotOpacity + rng() * 0.04;
          const opacity = baseOpacity * vignetteFactor;
          const isBinary = rng() < binaryDensity;

          // Skip dots that would be imperceptible
          if (opacity < 0.012) {
            // Still consume RNG to keep deterministic sequence
            if (isBinary) rng();
            continue;
          }

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
    }

    draw();

    const observer = new ResizeObserver(draw);
    observer.observe(parent);

    return () => observer.disconnect();
  }, [seed, dotColor, dotOpacity, spacing, dotRadius, binaryDensity, vignette]);

  return (
    <canvas
      ref={canvasRef}
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
