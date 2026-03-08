'use client';

// StudioDotGrid.tsx: Multi-color interactive dot grid for Studio.
//
// Adapted from DotGrid.tsx with these differences:
//   Multi-color palette (75% terracotta, 15% teal, 10% gold)
//   Theme-aware via MutationObserver on .studio-theme-light class
//   Gradient and dot inversion adapted for both dark and light ground
//
// ~12% of positions render tiny 0/1 binary characters.
// Spring physics with idle detection, kite-shaped edge fade, ink trail.

import { useEffect, useRef, useCallback } from 'react';

// ── Gradient settings ──────────────────────────────────
const INVERSION_DEPTH = 0.30;     // fraction of viewport for gradient
const GRADIENT_TAIL = 0.08;       // soft fade-out below gradient

// ── Dark mode ground colors ──────────────────────────
const DARK_GROUND_RGB: [number, number, number] = [42, 38, 34];       // warm dark (top)
const DARK_BASE_RGB: [number, number, number] = [15, 16, 18];         // --studio-bg (#0F1012)
const DARK_INVERTED_DOT_RGB: [number, number, number] = [240, 235, 228]; // cream dots in gradient zone

// ── Light mode ground colors ─────────────────────────
const LIGHT_GROUND_RGB: [number, number, number] = [225, 218, 208];   // warm parchment (top)
const LIGHT_BASE_RGB: [number, number, number] = [245, 240, 234];     // --studio-bg light (#F5F0EA)
const LIGHT_INVERTED_DOT_RGB: [number, number, number] = [42, 36, 32]; // dark dots in gradient zone

// ── Weighted color palette ─────────────────────────────
const DOT_PALETTE: { rgb: [number, number, number]; weight: number }[] = [
  { rgb: [180, 90, 45], weight: 0.75 },   // terracotta
  { rgb: [58, 138, 154], weight: 0.15 },   // teal
  { rgb: [212, 170, 74], weight: 0.10 },   // gold
];

// Precompute cumulative thresholds once
const CUMULATIVE: number[] = [];
{
  let sum = 0;
  for (const entry of DOT_PALETTE) {
    sum += entry.weight;
    CUMULATIVE.push(sum);
  }
}

interface StudioDotGridProps {
  dotRadius?: number;
  spacing?: number;
  dotOpacity?: number;
  /** Where the kite edge fade begins (0 = center, 1 = edge) */
  fadeStart?: number;
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

/** Pick a palette index using cumulative weights */
function pickColor(rng: () => number): number {
  const r = rng();
  for (let i = 0; i < CUMULATIVE.length; i++) {
    if (r < CUMULATIVE[i]) return i;
  }
  return 0;
}

export default function StudioDotGrid({
  dotRadius = 0.85,
  spacing = 20,
  dotOpacity = 0.45,
  fadeStart = 0.80,
  stiffness = 0.35,
  damping = 0.48,
  influenceRadius = 100,
  repulsionStrength = 5,
  binaryDensity = 0.12,
}: StudioDotGridProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const visibleRef = useRef(true);
  const mouseRef = useRef({ x: -9999, y: -9999, active: false });
  /** True when .studio-theme-light is active. Read inside rendering closures. */
  const lightModeRef = useRef(false);
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
    /** Per-dot palette index (0 = terracotta, 1 = teal, 2 = gold) */
    colorIdx: Uint8Array;
    count: number;
  } | null>(null);

  // Pre-compute kite-shaped fade per dot:
  // Full width at top, sides taper starting ~40% down, rounded bottom
  const computeFade = useCallback((
    gx: Float32Array, gy: Float32Array, fade: Float32Array,
    count: number, w: number, h: number,
  ) => {
    const taperStart = 0.35;
    const bottomFade = 0.15;

    for (let i = 0; i < count; i++) {
      const nx = gx[i] / w;
      const ny = gy[i] / h;
      const dx = Math.abs(nx - 0.5) * 2;

      let sideFade = 1;
      if (ny > taperStart) {
        const taperProgress = (ny - taperStart) / (1 - taperStart);
        const fadeWidth = taperProgress * 0.5;
        const edgeStart = 1 - fadeWidth / fadeStart;
        if (dx > edgeStart) {
          const t = Math.min((dx - edgeStart) / (1 - edgeStart), 1);
          sideFade = 1 - (t * t * (3 - 2 * t));
        }
      }

      let bottomAlpha = 1;
      if (ny > (1 - bottomFade)) {
        const t = (ny - (1 - bottomFade)) / bottomFade;
        bottomAlpha = 1 - (t * t * (3 - 2 * t));
      }

      fade[i] = sideFade * bottomAlpha;
    }
  }, [fadeStart]);

  const initDots = useCallback((w: number, h: number) => {
    const cols = Math.ceil(w / spacing) + 1;
    const rows = Math.ceil(h / spacing) + 1;
    const count = cols * rows;

    const gx = new Float32Array(count);
    const gy = new Float32Array(count);
    const kind = new Uint8Array(count);
    const colorIdx = new Uint8Array(count);

    let idx = 0;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        gx[idx] = col * spacing;
        gy[idx] = row * spacing;

        // Seeded PRNG per grid position: deterministic scatter and color
        const rng = mulberry32(row * 1000 + col + 7919);

        if (rng() < binaryDensity) {
          kind[idx] = rng() < 0.5 ? 1 : 2;
        } else {
          kind[idx] = 0;
        }

        // Weighted color assignment
        colorIdx[idx] = pickColor(rng);

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
      colorIdx,
      count,
    };
  }, [spacing, computeFade, binaryDensity]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    // Theme-aware color getters (read ref at render time)
    function groundRgb() { return lightModeRef.current ? LIGHT_GROUND_RGB : DARK_GROUND_RGB; }
    function baseRgb() { return lightModeRef.current ? LIGHT_BASE_RGB : DARK_BASE_RGB; }
    function invertedDotRgb() { return lightModeRef.current ? LIGHT_INVERTED_DOT_RGB : DARK_INVERTED_DOT_RGB; }
    function dotBaseOpacity() { return lightModeRef.current ? dotOpacity * 0.65 : dotOpacity; }

    let w = 0;
    let h = 0;
    let idleFrames = 0;
    let animating = false;

    const isTouchOnly =
      typeof window !== 'undefined' &&
      window.matchMedia('(hover: none)').matches;

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

    // ── Gradient rendering ─────────────────────────
    function drawGradient() {
      const ground = groundRgb();
      const base = baseRgb();
      const gradEnd = Math.round(h * INVERSION_DEPTH);
      const tailLength = Math.round(h * GRADIENT_TAIL);

      const grad = ctx!.createLinearGradient(0, 0, 0, gradEnd);
      const stops = [0, 0.15, 0.35, 0.55, 0.75, 0.90, 1.0];
      for (let i = 0; i < stops.length; i++) {
        const t = stops[i];
        const eased = t * t * (3 - 2 * t); // Hermite smoothstep
        const r = Math.round(ground[0] + (base[0] - ground[0]) * eased);
        const g = Math.round(ground[1] + (base[1] - ground[1]) * eased);
        const b = Math.round(ground[2] + (base[2] - ground[2]) * eased);
        grad.addColorStop(t, `rgb(${r},${g},${b})`);
      }
      ctx!.fillStyle = grad;
      ctx!.fillRect(0, 0, w, gradEnd);

      if (tailLength > 0) {
        const tailGrad = ctx!.createLinearGradient(0, gradEnd, 0, gradEnd + tailLength);
        tailGrad.addColorStop(0, `rgba(${base[0]},${base[1]},${base[2]},1)`);
        tailGrad.addColorStop(0.5, `rgba(${base[0]},${base[1]},${base[2]},0.3)`);
        tailGrad.addColorStop(1, `rgba(${base[0]},${base[1]},${base[2]},0)`);
        ctx!.fillStyle = tailGrad;
        ctx!.fillRect(0, gradEnd, w, tailLength);
      }
    }

    /** Returns 1.0 at y=0 (full inversion), fades through tail to 0.0 */
    function getInversionFactor(baseY: number): number {
      const gradEnd = h * INVERSION_DEPTH;
      const tailEnd = gradEnd + h * GRADIENT_TAIL;
      if (baseY <= 0) return 1;
      if (baseY < gradEnd) {
        const t = baseY / gradEnd;
        return 1 - (t * t * (3 - 2 * t));
      }
      if (baseY < tailEnd) {
        const t = (baseY - gradEnd) / (tailEnd - gradEnd);
        return (1 - (t * t * (3 - 2 * t))) * 0.15;
      }
      return 0;
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

    function drawDotWithInversion(
      x: number, y: number, baseY: number, fadeVal: number,
      dotKind: number, paletteRgb: [number, number, number],
    ) {
      const invDot = invertedDotRgb();
      const inv = getInversionFactor(baseY);
      const dr = Math.round(paletteRgb[0] + (invDot[0] - paletteRgb[0]) * inv);
      const dg = Math.round(paletteRgb[1] + (invDot[1] - paletteRgb[1]) * inv);
      const db = Math.round(paletteRgb[2] + (invDot[2] - paletteRgb[2]) * inv);
      const alpha = (dotBaseOpacity() + inv * 0.20) * fadeVal;
      drawDot(x, y, alpha, dotKind, dr, dg, db);
    }

    function drawStatic() {
      const dots = dotsRef.current;
      if (!dots) return;
      ctx!.clearRect(0, 0, w, h);
      drawGradient();

      for (let i = 0; i < dots.count; i++) {
        if (dots.fade[i] < 0.01) continue;
        const c = DOT_PALETTE[dots.colorIdx[i]].rgb;
        drawDotWithInversion(
          dots.gx[i], dots.gy[i], dots.gy[i], dots.fade[i],
          dots.kind[i], c,
        );
      }
    }

    function tick() {
      const dots = dotsRef.current;
      if (!dots) { animRef.current = requestAnimationFrame(tick); return; }
      if (!visibleRef.current) { animRef.current = requestAnimationFrame(tick); return; }

      ctx!.clearRect(0, 0, w, h);
      drawGradient();

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
        const invDot = invertedDotRgb();
        const tInv = getInversionFactor(trail[t].y);
        const tr = Math.round(180 + (invDot[0] - 180) * tInv);
        const tg = Math.round(90 + (invDot[1] - 90) * tInv);
        const tb = Math.round(45 + (invDot[2] - 45) * tInv);
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

        const c = DOT_PALETTE[dots.colorIdx[i]].rgb;
        drawDotWithInversion(
          baseX + dots.ox[i], baseY + dots.oy[i], baseY, dots.fade[i],
          dots.kind[i], c,
        );
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

      const trail = trailRef.current;
      trail.push({ x: e.clientX, y: e.clientY, age: 0 });
      if (trail.length > 40) trail.shift();

      startAnimation();
    }

    function onMouseLeave() {
      mouseRef.current.active = false;
    }

    // Reduced motion: static frame only
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Pause rAF when canvas scrolls off-screen or tab hidden
    const observer = new IntersectionObserver(
      ([entry]) => { visibleRef.current = entry.isIntersecting; },
      { threshold: 0 },
    );
    observer.observe(canvas);

    // Detect initial theme
    const themeEl = document.querySelector('.studio-theme');
    lightModeRef.current = themeEl?.classList.contains('studio-theme-light') ?? false;

    // Watch for theme class toggles and redraw
    let themeObserver: MutationObserver | null = null;
    if (themeEl) {
      themeObserver = new MutationObserver(() => {
        const isLight = themeEl.classList.contains('studio-theme-light');
        if (isLight !== lightModeRef.current) {
          lightModeRef.current = isLight;
          drawStatic();
        }
      });
      themeObserver.observe(themeEl, { attributes: true, attributeFilter: ['class'] });
    }

    resize();

    if (prefersReducedMotion) {
      window.addEventListener('resize', debouncedResize);
      return () => {
        cancelAnimationFrame(resizeRaf);
        observer.disconnect();
        themeObserver?.disconnect();
        window.removeEventListener('resize', debouncedResize);
      };
    }

    if (!isTouchOnly) {
      window.addEventListener('mousemove', onMouseMove, { passive: true });
    }
    window.addEventListener('resize', debouncedResize);
    document.addEventListener('mouseleave', onMouseLeave);

    return () => {
      cancelAnimationFrame(animRef.current);
      cancelAnimationFrame(resizeRaf);
      observer.disconnect();
      themeObserver?.disconnect();
      if (!isTouchOnly) {
        window.removeEventListener('mousemove', onMouseMove);
      }
      window.removeEventListener('resize', debouncedResize);
      document.removeEventListener('mouseleave', onMouseLeave);
    };
  }, [dotRadius, spacing, dotOpacity, stiffness, damping, influenceRadius, repulsionStrength, initDots]);

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
