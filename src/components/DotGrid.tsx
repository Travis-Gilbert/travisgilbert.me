'use client';

// DotGrid.tsx: Interactive dot grid with radial edge vignette and binary scatter
// React client component
//
// ~12% of dot positions render tiny 0s and 1s instead of circles,
// creating a subtle digital texture. Seeded PRNG ensures deterministic
// positions across redraws.

import { useEffect, useRef, useCallback } from 'react';
import { useThemeVersion, readCssVar, hexToRgb } from '@/hooks/useThemeColor';

// Viewport inversion gradient: charcoal fades in at top, dots invert to cream
const INVERSION_DEPTH = 0.22; // fraction of viewport height

interface DotGridProps {
  dotRadius?: number;
  spacing?: number;
  dotColor?: [number, number, number];
  dotOpacity?: number;
  /** Where the edge fade begins (0 = center, 1 = edge) */
  fadeStart?: number;
  /** Where the fade reaches full transparency */
  fadeEnd?: number;
  stiffness?: number;
  damping?: number;
  influenceRadius?: number;
  repulsionStrength?: number;
  /** Fraction of dots replaced by binary characters (0 to 1) */
  binaryDensity?: number;
}

// Seeded PRNG (mulberry32): deterministic per grid position
function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export default function DotGrid({
  dotRadius = 0.85,
  spacing = 20,
  dotColor = [160, 154, 144],
  dotOpacity = 0.5,
  fadeStart = 0.80,
  fadeEnd = 0.98,
  stiffness = 0.35,
  damping = 0.48,
  influenceRadius = 100,
  repulsionStrength = 5,
  binaryDensity = 0.12,
}: DotGridProps) {
  const themeVersion = useThemeVersion();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const mouseRef = useRef({ x: -9999, y: -9999, active: false });
  /** Ink trail: ring buffer of recent mouse positions with decay */
  const trailRef = useRef<{ x: number; y: number; age: number }[]>([]);

  // Dot state in typed arrays for performance
  const dotsRef = useRef<{
    gx: Float32Array; gy: Float32Array;
    ox: Float32Array; oy: Float32Array;
    vx: Float32Array; vy: Float32Array;
    fade: Float32Array;
    /** Per-dot type: 0 = circle, 1 = '0' char, 2 = '1' char */
    kind: Uint8Array;
    count: number;
  } | null>(null);

  // Pre-compute elliptical radial fade per dot
  const computeFade = useCallback((
    gx: Float32Array, gy: Float32Array, fade: Float32Array,
    count: number, w: number, h: number,
  ) => {
    const cx = w / 2;
    const cy = h / 2;

    for (let i = 0; i < count; i++) {
      const dx = (gx[i] - cx) / cx;
      const dy = (gy[i] - cy) / cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= fadeStart) {
        fade[i] = 1;
      } else if (dist >= fadeEnd) {
        fade[i] = 0;
      } else {
        const t = (dist - fadeStart) / (fadeEnd - fadeStart);
        fade[i] = 1 - (t * t * (3 - 2 * t)); // Hermite smoothstep
      }
    }
  }, [fadeStart, fadeEnd]);

  const initDots = useCallback((w: number, h: number) => {
    const cols = Math.ceil(w / spacing) + 1;
    const rows = Math.ceil(h / spacing) + 1;
    const count = cols * rows;

    const gx = new Float32Array(count);
    const gy = new Float32Array(count);
    const kind = new Uint8Array(count);

    let idx = 0;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        gx[idx] = col * spacing;
        gy[idx] = row * spacing;

        // Seeded PRNG per grid position: deterministic binary scatter
        const rng = mulberry32(row * 1000 + col + 7919);
        if (rng() < binaryDensity) {
          kind[idx] = rng() < 0.5 ? 1 : 2; // 1 = '0', 2 = '1'
        } else {
          kind[idx] = 0; // circle
        }

        idx++;
      }
    }

    const fade = new Float32Array(count);
    computeFade(gx, gy, fade, count, w, h);

    dotsRef.current = {
      gx, gy,
      ox: new Float32Array(count),
      oy: new Float32Array(count),
      vx: new Float32Array(count),
      vy: new Float32Array(count),
      fade,
      kind,
      count,
    };
  }, [spacing, computeFade, binaryDensity]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let w = 0;
    let h = 0;
    let idleFrames = 0;
    let animating = false;

    const isTouchOnly =
      typeof window !== 'undefined' &&
      window.matchMedia('(hover: none)').matches;

    // Binary text font (set once, reused)
    const binaryFont = '7px monospace';

    let resizeRaf = 0;

    function resize() {
      const dpr = window.devicePixelRatio || 1;
      w = window.innerWidth;
      h = window.innerHeight;
      canvas!.width = w * dpr;
      canvas!.height = h * dpr;
      canvas!.style.width = `${w}px`;
      canvas!.style.height = `${h}px`;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      initDots(w, h);
      drawStatic();
    }

    function debouncedResize() {
      cancelAnimationFrame(resizeRaf);
      resizeRaf = requestAnimationFrame(resize);
    }

    // Resolve dot color from CSS (theme-aware), fall back to prop
    const resolvedHex = readCssVar('--color-rough-light');
    const rgb = resolvedHex ? hexToRgb(resolvedHex) : dotColor;

    // Resolve inversion colors from CSS (theme-aware)
    const charcoalHex = readCssVar('--color-hero-ground');
    const charcoalRgb: [number, number, number] = charcoalHex
      ? hexToRgb(charcoalHex)
      : [42, 40, 36];

    const creamHex = readCssVar('--color-hero-text');
    const creamRgb: [number, number, number] = creamHex
      ? hexToRgb(creamHex)
      : [240, 235, 228];

    const paperHex = readCssVar('--color-paper');
    const paperRgb: [number, number, number] = paperHex
      ? hexToRgb(paperHex)
      : [240, 235, 228];

    /** Paint solid charcoal-to-parchment gradient over the top portion of the canvas */
    function drawInversionGradient() {
      const gradEnd = Math.round(h * INVERSION_DEPTH);
      const grad = ctx!.createLinearGradient(0, 0, 0, gradEnd);
      grad.addColorStop(0, `rgb(${charcoalRgb[0]},${charcoalRgb[1]},${charcoalRgb[2]})`);
      grad.addColorStop(1, `rgb(${paperRgb[0]},${paperRgb[1]},${paperRgb[2]})`);
      ctx!.fillStyle = grad;
      ctx!.fillRect(0, 0, w, gradEnd);
    }

    /** Returns 1.0 at y=0 (full inversion), 0.0 at/below gradient end */
    function getInversionFactor(baseY: number): number {
      const gradEnd = h * INVERSION_DEPTH;
      if (baseY >= gradEnd) return 0;
      if (baseY <= 0) return 1;
      const t = baseY / gradEnd;
      return 1 - (t * t * (3 - 2 * t)); // Hermite smoothstep
    }

    function drawDot(
      x: number, y: number, alpha: number, dotKind: number,
      r: number, g: number, b: number,
    ) {
      ctx!.fillStyle = `rgba(${r},${g},${b},${alpha})`;

      if (dotKind === 0) {
        ctx!.beginPath();
        ctx!.arc(x, y, dotRadius, 0, Math.PI * 2);
        ctx!.fill();
      } else {
        ctx!.font = binaryFont;
        ctx!.textAlign = 'center';
        ctx!.textBaseline = 'middle';
        ctx!.fillText(dotKind === 1 ? '0' : '1', x, y);
      }
    }

    function drawStatic() {
      const dots = dotsRef.current;
      if (!dots) return;
      ctx!.clearRect(0, 0, w, h);
      drawInversionGradient();

      for (let i = 0; i < dots.count; i++) {
        if (dots.fade[i] < 0.01) continue;
        const baseY = dots.gy[i];
        const inv = getInversionFactor(baseY);
        const dr = Math.round(rgb[0] + (creamRgb[0] - rgb[0]) * inv);
        const dg = Math.round(rgb[1] + (creamRgb[1] - rgb[1]) * inv);
        const db = Math.round(rgb[2] + (creamRgb[2] - rgb[2]) * inv);
        const alpha = (dotOpacity + inv * 0.15) * dots.fade[i];
        drawDot(dots.gx[i], dots.gy[i], alpha, dots.kind[i], dr, dg, db);
      }
    }

    function tick() {
      const dots = dotsRef.current;
      if (!dots) { animRef.current = requestAnimationFrame(tick); return; }

      ctx!.clearRect(0, 0, w, h);
      drawInversionGradient();

      // Draw ink trail (underneath grid dots)
      const trail = trailRef.current;
      for (let t = trail.length - 1; t >= 0; t--) {
        trail[t].age++;
        if (trail[t].age > 60) {
          trail.splice(t, 1);
          continue;
        }
        const opacity = (1 - trail[t].age / 60) * 0.12;
        const radius = 1.2 + (trail[t].age / 60) * 0.5;
        const tInv = getInversionFactor(trail[t].y);
        const tr = Math.round(rgb[0] + (creamRgb[0] - rgb[0]) * tInv);
        const tg = Math.round(rgb[1] + (creamRgb[1] - rgb[1]) * tInv);
        const tb = Math.round(rgb[2] + (creamRgb[2] - rgb[2]) * tInv);
        ctx!.fillStyle = `rgba(${tr},${tg},${tb},${opacity})`;
        ctx!.beginPath();
        ctx!.arc(trail[t].x, trail[t].y, radius, 0, Math.PI * 2);
        ctx!.fill();
      }
      if (trail.length > 0) idleFrames = 0;

      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;
      const isActive = mouseRef.current.active;
      const ir2 = influenceRadius * influenceRadius;
      let anyDisplaced = false;

      for (let i = 0; i < dots.count; i++) {
        if (dots.fade[i] < 0.01) continue;

        const baseX = dots.gx[i];
        const baseY = dots.gy[i];

        // Mouse repulsion
        if (isActive) {
          const ddx = (baseX + dots.ox[i]) - mx;
          const ddy = (baseY + dots.oy[i]) - my;
          const d2 = ddx * ddx + ddy * ddy;

          if (d2 < ir2 && d2 > 0.01) {
            const d = Math.sqrt(d2);
            const force = (1 - d / influenceRadius) * repulsionStrength;
            dots.vx[i] += (ddx / d) * force * 0.1;
            dots.vy[i] += (ddy / d) * force * 0.1;
          }
        }

        // Spring back + damping
        dots.vx[i] += -dots.ox[i] * stiffness;
        dots.vy[i] += -dots.oy[i] * stiffness;
        dots.vx[i] *= damping;
        dots.vy[i] *= damping;
        dots.ox[i] += dots.vx[i];
        dots.oy[i] += dots.vy[i];

        if (dots.ox[i] * dots.ox[i] + dots.oy[i] * dots.oy[i] > 0.01) {
          anyDisplaced = true;
        }

        const inv = getInversionFactor(baseY);
        const dr = Math.round(rgb[0] + (creamRgb[0] - rgb[0]) * inv);
        const dg = Math.round(rgb[1] + (creamRgb[1] - rgb[1]) * inv);
        const db = Math.round(rgb[2] + (creamRgb[2] - rgb[2]) * inv);
        const alpha = (dotOpacity + inv * 0.15) * dots.fade[i];
        drawDot(baseX + dots.ox[i], baseY + dots.oy[i], alpha, dots.kind[i], dr, dg, db);
      }

      if (!anyDisplaced) {
        idleFrames++;
        if (idleFrames > 60) { animating = false; return; }
      } else {
        idleFrames = 0;
      }

      animRef.current = requestAnimationFrame(tick);
    }

    function startAnimation() {
      if (animating) return;
      animating = true;
      idleFrames = 0;
      animRef.current = requestAnimationFrame(tick);
    }

    function onMouseMove(e: MouseEvent) {
      mouseRef.current.x = e.clientX;
      mouseRef.current.y = e.clientY;
      mouseRef.current.active = true;

      // Ink trail: push current position (capped at 40 points)
      const trail = trailRef.current;
      trail.push({ x: e.clientX, y: e.clientY, age: 0 });
      if (trail.length > 40) trail.shift();

      startAnimation();
    }

    function onMouseLeave() {
      mouseRef.current.active = false;
    }

    // Initialize
    resize();

    if (!isTouchOnly) {
      window.addEventListener('mousemove', onMouseMove, { passive: true });
    }
    window.addEventListener('resize', debouncedResize);
    document.addEventListener('mouseleave', onMouseLeave);

    return () => {
      cancelAnimationFrame(animRef.current);
      cancelAnimationFrame(resizeRaf);
      if (!isTouchOnly) {
        window.removeEventListener('mousemove', onMouseMove);
      }
      window.removeEventListener('resize', debouncedResize);
      document.removeEventListener('mouseleave', onMouseLeave);
    };
  }, [dotRadius, spacing, dotColor, dotOpacity, stiffness, damping, influenceRadius, repulsionStrength, initDots, themeVersion]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: 'fixed',
        top: '0',
        left: '0',
        width: '100%',
        height: '100%',
        zIndex: -1,
        pointerEvents: 'none',
        filter: 'blur(0.1px)',
      }}
    />
  );
}
