'use client';

import { useCallback, useEffect, useRef } from 'react';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { mulberry32 } from '@/lib/prng';

const DEFAULT_DOT_COLOR: [number, number, number] = [74, 138, 150];

// Inverse vignette: center is clean, dots fade in toward edges
function computeFade(
  gx: Float32Array, gy: Float32Array, fade: Float32Array,
  count: number, w: number, h: number,
) {
  const cx = w * 0.5;
  const cy = h * 0.35;
  const maxR = Math.sqrt(cx * cx + cy * cy);

  for (let i = 0; i < count; i++) {
    const ddx = gx[i] - cx;
    const ddy = gy[i] - cy;
    const dist = Math.sqrt(ddx * ddx + ddy * ddy);
    const norm = dist / maxR;
    fade[i] = Math.pow(Math.max(0, norm - 0.15) / 0.85, 1.8);
  }
}

interface TheseusDotGridProps {
  dotRadius?: number;
  spacing?: number;
  dotColor?: [number, number, number];
  dotOpacity?: number;
  stiffness?: number;
  damping?: number;
  influenceRadius?: number;
  repulsionStrength?: number;
  binaryDensity?: number;
}

export default function TheseusDotGrid({
  dotRadius = 0.85,
  spacing = 20,
  dotColor = DEFAULT_DOT_COLOR,
  dotOpacity = 0.06,
  stiffness = 0.35,
  damping = 0.48,
  influenceRadius = 100,
  repulsionStrength = 5,
  binaryDensity = 0.20,
}: TheseusDotGridProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const visibleRef = useRef(true);
  const mouseRef = useRef({ x: -9999, y: -9999, active: false });
  const trailRef = useRef<{ x: number; y: number; age: number }[]>([]);

  const dotsRef = useRef<{
    gx: Float32Array; gy: Float32Array;
    ox: Float32Array; oy: Float32Array;
    vx: Float32Array; vy: Float32Array;
    fade: Float32Array;
    kind: Uint8Array;
    count: number;
  } | null>(null);

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
  }, [spacing, binaryDensity]);

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

    const binaryFont = '7px "JetBrains Mono", monospace';
    const rgb = dotColor;

    let resizeRaf = 0;

    function resize() {
      const dpr = window.devicePixelRatio || 1;
      w = window.innerWidth;
      h = window.innerHeight;
      if (w < 1 || h < 1) return;
      canvas!.width = Math.min(w * dpr, 8192);
      canvas!.height = Math.min(h * dpr, 8192);
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

    function drawDot(
      x: number, y: number, alpha: number, dotKind: number,
    ) {
      ctx!.fillStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha})`;

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

      for (let i = 0; i < dots.count; i++) {
        if (dots.fade[i] < 0.01) continue;
        const alpha = dotOpacity * dots.fade[i];
        drawDot(dots.gx[i], dots.gy[i], alpha, dots.kind[i]);
      }
    }

    function tick() {
      const dots = dotsRef.current;
      if (!dots || !visibleRef.current) { animating = false; return; }

      ctx!.clearRect(0, 0, w, h);

      const trail = trailRef.current;
      for (let t = trail.length - 1; t >= 0; t--) {
        trail[t].age++;
        if (trail[t].age > 60) {
          trail.splice(t, 1);
          continue;
        }
        const opacity = (1 - trail[t].age / 60) * 0.12;
        const radius = 1.2 + (trail[t].age / 60) * 0.5;
        ctx!.fillStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${opacity})`;
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

        dots.vx[i] += -dots.ox[i] * stiffness;
        dots.vy[i] += -dots.oy[i] * stiffness;
        dots.vx[i] *= damping;
        dots.vy[i] *= damping;
        dots.ox[i] += dots.vx[i];
        dots.oy[i] += dots.vy[i];

        if (dots.ox[i] * dots.ox[i] + dots.oy[i] * dots.oy[i] > 0.01) {
          anyDisplaced = true;
        }

        const alpha = dotOpacity * dots.fade[i];
        drawDot(baseX + dots.ox[i], baseY + dots.oy[i], alpha, dots.kind[i]);
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

    const observer = new IntersectionObserver(
      ([entry]) => { visibleRef.current = entry.isIntersecting; },
      { threshold: 0 },
    );
    observer.observe(canvas);

    resize();

    if (prefersReducedMotion) {
      // Static mode: dots render, no rAF, no trail, no spring physics
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
  }, [dotRadius, spacing, dotColor, dotOpacity, stiffness, damping, influenceRadius, repulsionStrength, initDots, prefersReducedMotion]);

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
        zIndex: 0,
        pointerEvents: 'none',
      }}
    />
  );
}
