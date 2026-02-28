'use client';

// DotGrid.tsx: Interactive dot grid with radial edge vignette and binary scatter
// React client component
//
// ~12% of dot positions render tiny 0s and 1s instead of circles,
// creating a subtle digital texture. Seeded PRNG ensures deterministic
// positions across redraws.
//
// Hero zone awareness: when --hero-height CSS var is set (by CollageHero),
// DotGrid paints the dark ground fill and renders cream-colored dots
// inside the hero zone, with a smoothstep crossfade at the boundary.

import { useEffect, useRef, useCallback } from 'react';
import { useThemeVersion, readCssVar, hexToRgb } from '@/hooks/useThemeColor';

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

// Hero zone internal defaults (not props; tuned for cream on dark ground)
const HERO_DOT_COLOR: [number, number, number] = [240, 235, 228]; // cream
const HERO_DOT_OPACITY = 0.3;
const HERO_CROSSFADE_HEIGHT = 50; // px, smooth transition band

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
  /** Hero zone height in px (read from --hero-height CSS var) */
  const heroHeightRef = useRef<number>(0);

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

    // Hero zone color caches (recomputed on resize and style changes)
    let heroGroundRgb: [number, number, number] = [42, 40, 36]; // #2A2824 fallback
    let parchmentRgb: [number, number, number] = [240, 235, 228]; // #F0EBE4 fallback

    /** Read hero zone CSS vars and cache the resolved RGB values */
    function updateHeroColors() {
      const cssHeroHeight = parseFloat(
        getComputedStyle(document.documentElement)
          .getPropertyValue('--hero-height') || '0'
      );
      heroHeightRef.current = cssHeroHeight;

      const heroColorHex = readCssVar('--hero-color') || readCssVar('--color-hero-ground');
      if (heroColorHex) heroGroundRgb = hexToRgb(heroColorHex);

      const paperHex = readCssVar('--color-paper');
      if (paperHex) parchmentRgb = hexToRgb(paperHex);
    }

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
      updateHeroColors();
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

    function drawDot(
      x: number, y: number, alpha: number, dotKind: number,
      r: number, g: number, b: number,
    ) {
      ctx!.fillStyle = `rgba(${r},${g},${b},${alpha})`;

      if (dotKind === 0) {
        // Circle
        ctx!.beginPath();
        ctx!.arc(x, y, dotRadius, 0, Math.PI * 2);
        ctx!.fill();
      } else {
        // Binary character
        ctx!.font = binaryFont;
        ctx!.textAlign = 'center';
        ctx!.textBaseline = 'middle';
        ctx!.fillText(dotKind === 1 ? '0' : '1', x, y);
      }
    }

    /**
     * Per-dot color and opacity based on Y position relative to hero zone.
     * Three zones: deep hero (cream), crossfade band (interpolated), parchment (standard).
     */
    function getHeroDotParams(baseY: number): {
      r: number; g: number; b: number; opacityMul: number;
    } {
      const hh = heroHeightRef.current;
      const cf = HERO_CROSSFADE_HEIGHT;

      if (hh <= 0 || baseY > hh + cf) {
        return { r: rgb[0], g: rgb[1], b: rgb[2], opacityMul: dotOpacity };
      }

      if (baseY < hh - cf) {
        return {
          r: HERO_DOT_COLOR[0], g: HERO_DOT_COLOR[1], b: HERO_DOT_COLOR[2],
          opacityMul: HERO_DOT_OPACITY,
        };
      }

      // Crossfade band: Hermite smoothstep interpolation
      const t = (baseY - (hh - cf)) / (cf * 2);
      const smoothT = t * t * (3 - 2 * t);
      return {
        r: Math.round(HERO_DOT_COLOR[0] + (rgb[0] - HERO_DOT_COLOR[0]) * smoothT),
        g: Math.round(HERO_DOT_COLOR[1] + (rgb[1] - HERO_DOT_COLOR[1]) * smoothT),
        b: Math.round(HERO_DOT_COLOR[2] + (rgb[2] - HERO_DOT_COLOR[2]) * smoothT),
        opacityMul: HERO_DOT_OPACITY + (dotOpacity - HERO_DOT_OPACITY) * smoothT,
      };
    }

    /** Paint dark ground fill and gradient transition for the hero zone */
    function drawHeroBackground() {
      const hh = heroHeightRef.current;
      if (hh <= 0) return;

      // Dark ground fill
      ctx!.fillStyle = `rgb(${heroGroundRgb[0]},${heroGroundRgb[1]},${heroGroundRgb[2]})`;
      ctx!.fillRect(0, 0, w, hh);

      // Gradient transition to parchment at the bottom edge
      const gradH = 64;
      const grad = ctx!.createLinearGradient(0, hh - gradH, 0, hh);
      grad.addColorStop(0, `rgb(${heroGroundRgb[0]},${heroGroundRgb[1]},${heroGroundRgb[2]})`);
      grad.addColorStop(1, `rgb(${parchmentRgb[0]},${parchmentRgb[1]},${parchmentRgb[2]})`);
      ctx!.fillStyle = grad;
      ctx!.fillRect(0, hh - gradH, w, gradH);
    }

    function drawStatic() {
      const dots = dotsRef.current;
      if (!dots) return;
      ctx!.clearRect(0, 0, w, h);

      drawHeroBackground();

      for (let i = 0; i < dots.count; i++) {
        if (dots.fade[i] < 0.01) continue;
        const { r, g, b, opacityMul } = getHeroDotParams(dots.gy[i]);
        const alpha = opacityMul * dots.fade[i];
        drawDot(dots.gx[i], dots.gy[i], alpha, dots.kind[i], r, g, b);
      }
    }

    function tick() {
      const dots = dotsRef.current;
      if (!dots) { animRef.current = requestAnimationFrame(tick); return; }

      ctx!.clearRect(0, 0, w, h);

      drawHeroBackground();

      // Draw ink trail (underneath grid dots)
      const trail = trailRef.current;
      const hh = heroHeightRef.current;
      for (let t = trail.length - 1; t >= 0; t--) {
        trail[t].age++;
        if (trail[t].age > 60) {
          trail.splice(t, 1);
          continue;
        }
        const opacity = (1 - trail[t].age / 60) * 0.12;
        const radius = 1.2 + (trail[t].age / 60) * 0.5;
        // Cream trail inside hero zone, standard color below
        const inHero = hh > 0 && trail[t].y < hh;
        const tr = inHero ? HERO_DOT_COLOR[0] : rgb[0];
        const tg = inHero ? HERO_DOT_COLOR[1] : rgb[1];
        const tb = inHero ? HERO_DOT_COLOR[2] : rgb[2];
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

        // Per-dot hero zone color selection
        const { r, g, b, opacityMul } = getHeroDotParams(baseY);
        const alpha = opacityMul * dots.fade[i];
        drawDot(baseX + dots.ox[i], baseY + dots.oy[i], alpha, dots.kind[i], r, g, b);
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

    // Watch for --hero-height / --hero-color changes on <html> style attribute.
    // Handles client-side navigation: CollageHero mounts/unmounts and sets/removes
    // CSS vars without triggering a window resize.
    const styleObserver = new MutationObserver(() => {
      const newHH = parseFloat(
        getComputedStyle(document.documentElement)
          .getPropertyValue('--hero-height') || '0'
      );
      if (newHH !== heroHeightRef.current) {
        updateHeroColors();
        drawStatic();
      }
    });
    styleObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['style'],
    });

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
      styleObserver.disconnect();
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
