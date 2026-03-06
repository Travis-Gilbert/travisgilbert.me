'use client';

// DotGrid.tsx: Interactive dot grid with radial edge vignette and binary scatter
// React client component
//
// ~12% of dot positions render tiny 0s and 1s instead of circles,
// creating a subtle digital texture. Seeded PRNG ensures deterministic
// positions across redraws.

import { useEffect, useRef, useCallback } from 'react';
import { useThemeVersion, readCssVar, hexToRgb } from '@/hooks/useThemeColor';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';

// Viewport inversion gradient: charcoal fades in at top, dots invert to cream
const INVERSION_DEPTH = 0.35; // fraction of viewport height (light mode)
const DARK_INVERSION_DEPTH = 0.25; // shallower in dark mode (less intense)
const GRADIENT_TAIL = 0.08; // fraction of viewport for soft fade-out below gradient

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
  /** Skip the hero zone inversion gradient; use uniform dotColor. For dark contexts like Networks. */
  noGradient?: boolean;
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
  noGradient = false,
}: DotGridProps) {
  const themeVersion = useThemeVersion();
  const prefersReducedMotion = usePrefersReducedMotion();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const visibleRef = useRef(true);
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

  // Pre-compute kite-shaped fade per dot:
  // Full width at top, sides taper starting ~40% down, rounded bottom
  const computeFade = useCallback((
    gx: Float32Array, gy: Float32Array, fade: Float32Array,
    count: number, w: number, h: number,
  ) => {
    const cx = w / 2;
    // Vertical position where side tapering begins (fraction of height)
    const taperStart = 0.35;
    // Bottom fade zone (fraction of height from bottom)
    const bottomFade = 0.15;

    for (let i = 0; i < count; i++) {
      const nx = gx[i] / w;       // 0..1 horizontal
      const ny = gy[i] / h;       // 0..1 vertical
      const dx = Math.abs(nx - 0.5) * 2; // 0 at center, 1 at edge

      // Side fade: no horizontal fade above taperStart, increasing below
      let sideFade = 1;
      if (ny > taperStart) {
        const taperProgress = (ny - taperStart) / (1 - taperStart);
        // How far inward the fade reaches (0 at taperStart, 0.5 at bottom)
        const fadeWidth = taperProgress * 0.5;
        const edgeStart = 1 - fadeWidth / fadeStart;
        if (dx > edgeStart) {
          const t = Math.min((dx - edgeStart) / (1 - edgeStart), 1);
          sideFade = 1 - (t * t * (3 - 2 * t));
        }
      }

      // Bottom fade: smoothstep from (1 - bottomFade) to 1
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

    // Resolve dot color from CSS (theme-aware), fall back to prop.
    // noGradient mode: skip CSS var lookup, use dotColor directly.
    const resolvedHex = noGradient ? '' : readCssVar('--color-rough-light');
    const rgb = resolvedHex ? hexToRgb(resolvedHex) : dotColor;

    // Resolve nav background for purple band at top of gradient
    const navBgHex = readCssVar('--color-nav-bg');
    const navBgRgb: [number, number, number] = navBgHex
      ? hexToRgb(navBgHex)
      : [30, 22, 32];

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

    // Dark mode: invert gradient direction and dot inversion color
    const isDarkMode = document.documentElement.getAttribute('data-theme') === 'dark';
    // Dark mode uses warmer, slightly darker cream for the gradient
    const darkCreamRgb: [number, number, number] = [225, 218, 206];
    const effectiveCreamRgb = isDarkMode ? darkCreamRgb : creamRgb;
    const gradTopRgb: [number, number, number] = isDarkMode ? effectiveCreamRgb : charcoalRgb;
    const gradBottomRgb: [number, number, number] = isDarkMode ? charcoalRgb : paperRgb;
    const invertedDotRgb: [number, number, number] = isDarkMode ? charcoalRgb : effectiveCreamRgb;
    const inversionDepth = isDarkMode ? DARK_INVERSION_DEPTH : INVERSION_DEPTH;

    /** Paint purple band + Hermite-eased gradient over the top portion + soft tail zone */
    function drawInversionGradient() {
      const gradEnd = Math.round(h * inversionDepth);
      const tailLength = Math.round(h * GRADIENT_TAIL);

      // Purple band: nav color fades into charcoal/gradTop over top ~7% of viewport
      const purpleBandEnd = Math.round(h * 0.07);
      if (purpleBandEnd > 0) {
        const purpleGrad = ctx!.createLinearGradient(0, 0, 0, purpleBandEnd);
        purpleGrad.addColorStop(0, `rgb(${navBgRgb[0]},${navBgRgb[1]},${navBgRgb[2]})`);
        purpleGrad.addColorStop(1, `rgb(${gradTopRgb[0]},${gradTopRgb[1]},${gradTopRgb[2]})`);
        ctx!.fillStyle = purpleGrad;
        ctx!.fillRect(0, 0, w, purpleBandEnd);
      }

      // Main gradient: charcoal easing to paper (starts where purple band ends)
      const mainGradStart = purpleBandEnd;
      const grad = ctx!.createLinearGradient(0, mainGradStart, 0, gradEnd);
      const stops = [0, 0.15, 0.35, 0.55, 0.75, 0.90, 1.0];
      for (let i = 0; i < stops.length; i++) {
        const t = stops[i];
        const eased = t * t * (3 - 2 * t);
        const r = Math.round(gradTopRgb[0] + (gradBottomRgb[0] - gradTopRgb[0]) * eased);
        const g = Math.round(gradTopRgb[1] + (gradBottomRgb[1] - gradTopRgb[1]) * eased);
        const b = Math.round(gradTopRgb[2] + (gradBottomRgb[2] - gradTopRgb[2]) * eased);
        grad.addColorStop(t, `rgb(${r},${g},${b})`);
      }
      ctx!.fillStyle = grad;
      ctx!.fillRect(0, mainGradStart, w, gradEnd - mainGradStart);

      // Tail zone: gradBottomRgb fades to transparent below the main gradient
      if (tailLength > 0) {
        const tailGrad = ctx!.createLinearGradient(0, gradEnd, 0, gradEnd + tailLength);
        tailGrad.addColorStop(0, `rgba(${gradBottomRgb[0]},${gradBottomRgb[1]},${gradBottomRgb[2]},1)`);
        tailGrad.addColorStop(0.5, `rgba(${gradBottomRgb[0]},${gradBottomRgb[1]},${gradBottomRgb[2]},0.3)`);
        tailGrad.addColorStop(1, `rgba(${gradBottomRgb[0]},${gradBottomRgb[1]},${gradBottomRgb[2]},0)`);
        ctx!.fillStyle = tailGrad;
        ctx!.fillRect(0, gradEnd, w, tailLength);
      }
    }

    /** Returns 1.0 at y=0 (full inversion), fades through tail zone to 0.0 */
    function getInversionFactor(baseY: number): number {
      if (noGradient) return 0;
      const gradEnd = h * inversionDepth;
      const tailEnd = gradEnd + h * GRADIENT_TAIL;
      if (baseY <= 0) return 1;
      if (baseY < gradEnd) {
        const t = baseY / gradEnd;
        return 1 - (t * t * (3 - 2 * t)); // Hermite smoothstep
      }
      // Tail zone: smooth fade from residual value to 0
      if (baseY < tailEnd) {
        const t = (baseY - gradEnd) / (tailEnd - gradEnd);
        return (1 - (t * t * (3 - 2 * t))) * 0.15; // subtle residual inversion
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

    function drawStatic() {
      const dots = dotsRef.current;
      if (!dots) return;
      ctx!.clearRect(0, 0, w, h);
      if (!noGradient) drawInversionGradient();

      for (let i = 0; i < dots.count; i++) {
        if (dots.fade[i] < 0.01) continue;
        const baseY = dots.gy[i];
        const inv = getInversionFactor(baseY);
        const dr = Math.round(rgb[0] + (invertedDotRgb[0] - rgb[0]) * inv);
        const dg = Math.round(rgb[1] + (invertedDotRgb[1] - rgb[1]) * inv);
        const db = Math.round(rgb[2] + (invertedDotRgb[2] - rgb[2]) * inv);
        const alpha = (dotOpacity + inv * (isDarkMode ? 0.20 : 0.15)) * dots.fade[i];
        drawDot(dots.gx[i], dots.gy[i], alpha, dots.kind[i], dr, dg, db);
      }
    }

    function tick() {
      const dots = dotsRef.current;
      if (!dots) { animRef.current = requestAnimationFrame(tick); return; }

      // Skip work when canvas is off-screen (defensive; fixed canvas is typically always visible)
      if (!visibleRef.current) { animRef.current = requestAnimationFrame(tick); return; }

      ctx!.clearRect(0, 0, w, h);
      if (!noGradient) drawInversionGradient();

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
        const tr = Math.round(rgb[0] + (invertedDotRgb[0] - rgb[0]) * tInv);
        const tg = Math.round(rgb[1] + (invertedDotRgb[1] - rgb[1]) * tInv);
        const tb = Math.round(rgb[2] + (invertedDotRgb[2] - rgb[2]) * tInv);
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
        const dr = Math.round(rgb[0] + (invertedDotRgb[0] - rgb[0]) * inv);
        const dg = Math.round(rgb[1] + (invertedDotRgb[1] - rgb[1]) * inv);
        const db = Math.round(rgb[2] + (invertedDotRgb[2] - rgb[2]) * inv);
        const alpha = (dotOpacity + inv * (isDarkMode ? 0.20 : 0.15)) * dots.fade[i];
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

    // Reduced motion: draw a single static frame, skip all animation
    // Pause rAF when canvas scrolls off-screen or tab is hidden
    // (defensive: position:fixed canvas is typically always in viewport)
    const observer = new IntersectionObserver(
      ([entry]) => { visibleRef.current = entry.isIntersecting; },
      { threshold: 0 },
    );
    observer.observe(canvas);

    // Initialize
    resize();

    if (prefersReducedMotion) {
      // Static mode: dots render, gradient renders, no rAF, no trail, no spring physics
      // ResizeObserver still repaints the static frame on resize
      window.addEventListener('resize', debouncedResize);

      return () => {
        cancelAnimationFrame(resizeRaf);
        observer.disconnect();
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
      if (!isTouchOnly) {
        window.removeEventListener('mousemove', onMouseMove);
      }
      window.removeEventListener('resize', debouncedResize);
      document.removeEventListener('mouseleave', onMouseLeave);
    };
  }, [dotRadius, spacing, dotColor, dotOpacity, stiffness, damping, influenceRadius, repulsionStrength, initDots, themeVersion, noGradient, prefersReducedMotion]);

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
