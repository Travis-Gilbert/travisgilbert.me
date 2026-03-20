'use client';

import { useEffect, useRef } from 'react';

/**
 * SiteDotGrid: context-aware canvas dot pattern for CommonPlace panes.
 *
 * Builds on PaneDotGrid but adds:
 *   - Multi-color character rendering (terracotta majority, teal occasional, gold rare)
 *   - Context-aware color interpolation via `contextColor` prop
 *   - Smooth transition via requestAnimationFrame intensity animation
 *   - JetBrains Mono for binary characters at 11px
 *   - Grid intersection dots at ~40px spacing
 *   - Faint grid lines at 0.02 opacity
 *
 * Three-layer composite rendering:
 *   Layer 0: warm bloom gradient from bottom-left corner
 *   Layer 1: multi-color dot/binary field with faint grid lines
 *   Layer 2: inverted vignette (destination-out erase from center)
 */

// djb2: string to 32-bit integer hash
function djb2(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0;
  }
  return hash >>> 0;
}

// mulberry32: deterministic PRNG
function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Parse hex color to [r, g, b]
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

// Lerp between two RGB colors
function lerpColor(
  a: [number, number, number],
  b: [number, number, number],
  t: number,
): [number, number, number] {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

// Section colors as RGB
const TERRACOTTA: [number, number, number] = [184, 98, 61];
const TEAL: [number, number, number] = [45, 95, 107];
const GOLD: [number, number, number] = [196, 154, 74];
// Light gray base for visibility on dark CommonPlace background (#1C1C20)
const BASE_DOT: [number, number, number] = [160, 154, 144];

interface SiteDotGridProps {
  /** Unique seed for this pane */
  seed?: number | string;
  /** Context-aware color (hex string, e.g. '#B8623D') */
  contextColor?: string;
  /** Target intensity for context color shift (0 to 0.3) */
  intensity?: number;
  className?: string;
  style?: React.CSSProperties;
}

export default function SiteDotGrid({
  seed = 7,
  contextColor = '#B8623D',
  intensity = 0.15,
  className,
  style,
}: SiteDotGridProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const intensityRef = useRef(0);
  const targetIntensityRef = useRef(intensity);
  const contextColorRef = useRef(contextColor);
  const animFrameRef = useRef<number>(0);

  // Update refs when props change
  targetIntensityRef.current = intensity;
  contextColorRef.current = contextColor;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    const spacing = 40;
    const dotRadius = 0.75;
    const binaryDensity = 0.18;
    const dotOpacity = 0.35;

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

      const currentIntensity = intensityRef.current;
      const ctxRgb = hexToRgb(contextColorRef.current);

      // Layer 0: warm bloom from bottom-left, tinted by context color
      const bloomColor = lerpColor(BASE_DOT, ctxRgb, currentIntensity * 2);
      const bloom = ctx!.createRadialGradient(0, ch, 0, 0, ch, Math.max(cw, ch) * 0.7);
      bloom.addColorStop(0, `rgba(${bloomColor[0]}, ${bloomColor[1]}, ${bloomColor[2]}, 0.06)`);
      bloom.addColorStop(0.4, `rgba(${bloomColor[0]}, ${bloomColor[1]}, ${bloomColor[2]}, 0.025)`);
      bloom.addColorStop(1, 'transparent');
      ctx!.fillStyle = bloom;
      ctx!.fillRect(0, 0, cw, ch);

      // Faint grid lines at intersections
      ctx!.strokeStyle = `rgba(${BASE_DOT[0]}, ${BASE_DOT[1]}, ${BASE_DOT[2]}, 0.02)`;
      ctx!.lineWidth = 0.5;
      const cols = Math.ceil(cw / spacing) + 1;
      const rows = Math.ceil(ch / spacing) + 1;

      for (let col = 0; col < cols; col++) {
        const x = col * spacing;
        ctx!.beginPath();
        ctx!.moveTo(x, 0);
        ctx!.lineTo(x, ch);
        ctx!.stroke();
      }
      for (let row = 0; row < rows; row++) {
        const y = row * spacing;
        ctx!.beginPath();
        ctx!.moveTo(0, y);
        ctx!.lineTo(cw, y);
        ctx!.stroke();
      }

      // Layer 1: multi-color dot field
      const numericSeed = typeof seed === 'string' ? djb2(seed) : seed;
      const rng = mulberry32(numericSeed);

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const rand = rng();
          if (rand > 0.55) continue;

          const x = col * spacing;
          const y = row * spacing;
          const opacity = dotOpacity + rng() * 0.04;
          const isBinary = rng() < binaryDensity;

          // Color selection: mostly base, some section-tinted
          const colorRoll = rng();
          let dotRgb: [number, number, number];
          if (colorRoll < 0.08) {
            // Rare: context color at current intensity
            dotRgb = lerpColor(BASE_DOT, ctxRgb, 0.5 + currentIntensity);
          } else if (colorRoll < 0.15) {
            // Occasional: teal accent
            dotRgb = lerpColor(BASE_DOT, TEAL, 0.3 + currentIntensity * 0.5);
          } else if (colorRoll < 0.19) {
            // Rare: gold accent
            dotRgb = lerpColor(BASE_DOT, GOLD, 0.25 + currentIntensity * 0.3);
          } else if (colorRoll < 0.25) {
            // Occasional: terracotta accent
            dotRgb = lerpColor(BASE_DOT, TERRACOTTA, 0.2 + currentIntensity * 0.4);
          } else {
            // Default: base with slight context tint
            dotRgb = lerpColor(BASE_DOT, ctxRgb, currentIntensity * 0.3);
          }

          if (isBinary) {
            ctx!.fillStyle = `rgba(${dotRgb[0]}, ${dotRgb[1]}, ${dotRgb[2]}, ${opacity * 1.2})`;
            ctx!.font = '11px "JetBrains Mono", monospace';
            ctx!.textAlign = 'center';
            ctx!.textBaseline = 'middle';
            ctx!.fillText(rng() < 0.5 ? '0' : '1', x, y);
          } else {
            ctx!.fillStyle = `rgba(${dotRgb[0]}, ${dotRgb[1]}, ${dotRgb[2]}, ${opacity})`;
            ctx!.beginPath();
            ctx!.arc(x, y, dotRadius, 0, Math.PI * 2);
            ctx!.fill();
          }
        }
      }

      // No vignette in CommonPlace (dark chrome needs uniform dot coverage)
    }

    // Animate intensity transitions
    let lastTime = performance.now();
    function animate(time: number) {
      const dt = time - lastTime;
      lastTime = time;

      const current = intensityRef.current;
      const target = targetIntensityRef.current;
      if (Math.abs(current - target) > 0.001) {
        // Ease toward target over ~800ms
        const rate = 1 - Math.exp(-dt / 300);
        intensityRef.current = current + (target - current) * rate;
        draw();
      }

      animFrameRef.current = requestAnimationFrame(animate);
    }

    draw();
    animFrameRef.current = requestAnimationFrame(animate);

    const observer = new ResizeObserver(draw);
    observer.observe(parent);

    return () => {
      observer.disconnect();
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [seed]);

  // Trigger redraw when contextColor changes by bumping target intensity
  useEffect(() => {
    // Reset intensity to 0 then ease to target to show the color shift
    intensityRef.current = 0;
    targetIntensityRef.current = intensity;
  }, [contextColor, intensity]);

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
