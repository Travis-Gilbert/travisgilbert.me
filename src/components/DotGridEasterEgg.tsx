'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { X } from '@phosphor-icons/react';
import rough from 'roughjs';
import { readCssVar, useThemeVersion } from '@/hooks/useThemeColor';

// ── Seeded PRNG (mulberry32) ──────────────────────────────────────

function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Color helpers ─────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// ── Seed dot generation ───────────────────────────────────────────

interface SeedDot {
  x: number;
  y: number;
  r: number;
  hex: string;
  phaseOffset: number;
}

/**
 * Generates a miniature dot grid pattern for the 56x72 seed glyph.
 * 4 core dots in a grid formation + 12 scatter dots with radial fade.
 */
function generateDots(rng: () => number): SeedDot[] {
  const dots: SeedDot[] = [];
  const cx = 28;
  const cy = 28;

  // Core grid dots (2x2 centered formation)
  const corePositions = [
    { x: cx - 8, y: cy - 8 },
    { x: cx + 8, y: cy - 8 },
    { x: cx - 8, y: cy + 8 },
    { x: cx + 8, y: cy + 8 },
  ];
  for (const pos of corePositions) {
    dots.push({
      x: pos.x,
      y: pos.y,
      r: 2.0 + rng() * 0.5,
      hex: '#9A8E82',
      phaseOffset: rng() * Math.PI * 2,
    });
  }

  // Scatter dots (radial distribution with fade)
  for (let i = 0; i < 12; i++) {
    const angle = rng() * Math.PI * 2;
    const dist = 6 + rng() * 16;
    dots.push({
      x: cx + Math.cos(angle) * dist,
      y: cy + Math.sin(angle) * dist,
      r: 0.8 + rng() * 1.0,
      hex: '#9A8E82',
      phaseOffset: rng() * Math.PI * 2,
    });
  }

  return dots;
}

// Connection pairs: indices into the seed dots array for bezier lines
const CONNECTION_PAIRS: [number, number][] = [
  [0, 3],
  [1, 2],
  [0, 1],
  [2, 3],
  [4, 8],
  [6, 12],
];

// ── Phase type ────────────────────────────────────────────────────

type Phase = 'seed' | 'connecting' | 'expanding' | 'open' | 'collapsing';

// ── Panel content: DotGrid physics parameters ─────────────────────

const PHYSICS_PARAMS = [
  { label: 'DOT RADIUS', value: '0.75px', desc: 'Point size for each grid vertex' },
  { label: 'SPACING', value: '20px', desc: 'Distance between grid points' },
  { label: 'STIFFNESS', value: '0.15', desc: 'Spring constant pulling dots home' },
  { label: 'DAMPING', value: '0.75', desc: 'Velocity decay per frame' },
  { label: 'INFLUENCE', value: '100px', desc: 'Mouse repulsion radius' },
  { label: 'REPULSION', value: '25px', desc: 'Max displacement from cursor' },
];

const VIGNETTE_PARAMS = [
  { label: 'FADE START', value: '0.35', desc: 'Full opacity inside 35% of diagonal' },
  { label: 'FADE END', value: '0.85', desc: 'Transparent beyond 85% of diagonal' },
  { label: 'INTERPOLATION', value: 'Hermite smoothstep', desc: 't\u00B2 \u00D7 (3 \u2212 2t)' },
  { label: 'SHAPE', value: 'Elliptical', desc: 'Matches screen aspect ratio' },
];

const PERF_NOTES = [
  'Float32Array typed arrays for dot state',
  'Skip dots with fade < 0.01',
  'Pre-computed vignette (no per-frame cost)',
  'DPR-aware canvas scaling',
];

// ── Component ─────────────────────────────────────────────────────

export default function DotGridEasterEgg() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const borderCanvasRef = useRef<HTMLCanvasElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  // Mini DotGrid canvas inside expanded panel
  const miniGridCanvasRef = useRef<HTMLCanvasElement>(null);

  const [phase, setPhase] = useState<Phase>('seed');
  const [isHovered, setIsHovered] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [hasScrolled, setHasScrolled] = useState(false);

  const phaseRef = useRef<Phase>('seed');
  phaseRef.current = phase;
  const isExpanded = phase !== 'seed';

  // ── Deterministic seed dots ───────────────────────────────────
  const dotsRef = useRef<SeedDot[]>([]);
  if (dotsRef.current.length === 0) {
    dotsRef.current = generateDots(mulberry32(0xd07_6e1d));
  }

  // ── Theme-aware canvas colors ─────────────────────────────────
  const themeVersion = useThemeVersion();
  const canvasColorsRef = useRef({
    roughHex: '#3A3632',
    dotRgb: [160, 154, 144] as [number, number, number],
    dotHex: '#9A8E82',
  });

  useEffect(() => {
    const roughHex = readCssVar('--color-rough') || '#3A3632';
    const dotHex = readCssVar('--color-text-light') || '#9A8E82';
    canvasColorsRef.current = {
      roughHex,
      dotRgb: hexToRgb(dotHex),
      dotHex,
    };
    // Force border redraw with new color
    if (borderCanvasRef.current) {
      const bc = borderCanvasRef.current;
      const bctx = bc.getContext('2d');
      if (bctx) bctx.clearRect(0, 0, bc.width, bc.height);
      borderDrawnRef.current = false;
    }
  }, [themeVersion]);

  // ── Detect touch / reduced-motion ─────────────────────────────
  useEffect(() => {
    setIsTouchDevice(window.matchMedia('(hover: none)').matches);
    setReducedMotion(
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    );
  }, []);

  // ── Rough.js border (draw once on open) ───────────────────────
  const borderDrawnRef = useRef(false);

  const drawBorder = useCallback(
    (w: number, h: number) => {
      const bc = borderCanvasRef.current;
      if (!bc) return;
      const dpr = window.devicePixelRatio || 1;
      bc.width = w * dpr;
      bc.height = h * dpr;
      bc.style.width = `${w}px`;
      bc.style.height = `${h}px`;
      const bctx = bc.getContext('2d');
      if (!bctx) return;
      bctx.scale(dpr, dpr);
      const rc = rough.canvas(bc);
      rc.rectangle(1, 1, w - 2, h - 2, {
        roughness: 0.8,
        stroke: canvasColorsRef.current.roughHex,
        strokeWidth: 1.2,
        seed: 0xd07_6e1d,
      });
      borderDrawnRef.current = true;
    },
    [],
  );

  // ── Seed canvas drawing ───────────────────────────────────────
  const drawCanvas = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      w: number,
      h: number,
      breathe: number,
      connectProgress: number,
    ) => {
      ctx.clearRect(0, 0, w, h);
      const dots = dotsRef.current;
      const { dotHex } = canvasColorsRef.current;
      const [dr, dg, db] = hexToRgb(dotHex);

      // Draw dots with breathing
      for (const dot of dots) {
        const pulse = 0.3 + 0.15 * Math.sin(breathe + dot.phaseOffset);
        ctx.fillStyle = `rgba(${dr},${dg},${db},${pulse})`;
        ctx.beginPath();
        ctx.arc(dot.x, dot.y, dot.r, 0, Math.PI * 2);
        ctx.fill();
      }

      // Draw connecting bezier lines during connecting phase
      if (connectProgress > 0) {
        for (const [ai, bi] of CONNECTION_PAIRS) {
          const a = dots[ai];
          const b = dots[bi];
          if (!a || !b) continue;
          const cpx = (a.x + b.x) / 2 + (a.y - b.y) * 0.3;
          const cpy = (a.y + b.y) / 2 + (b.x - a.x) * 0.3;

          ctx.strokeStyle = `rgba(${dr},${dg},${db},${
            0.25 * connectProgress
          })`;
          ctx.lineWidth = 0.6;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          // Partial draw based on connectProgress
          const ex = a.x + (b.x - a.x) * connectProgress;
          const ey = a.y + (b.y - a.y) * connectProgress;
          const ecx = a.x + (cpx - a.x) * connectProgress;
          const ecy = a.y + (cpy - a.y) * connectProgress;
          ctx.quadraticCurveTo(ecx, ecy, ex, ey);
          ctx.stroke();
        }
      }
    },
    [],
  );

  // ── Mini DotGrid (interactive physics inside panel) ───────────
  const miniGridStateRef = useRef<{
    gx: Float32Array;
    gy: Float32Array;
    ox: Float32Array;
    oy: Float32Array;
    vx: Float32Array;
    vy: Float32Array;
    fade: Float32Array;
    count: number;
    mouseX: number;
    mouseY: number;
    mouseActive: boolean;
    initialized: boolean;
  }>({
    gx: new Float32Array(0),
    gy: new Float32Array(0),
    ox: new Float32Array(0),
    oy: new Float32Array(0),
    vx: new Float32Array(0),
    vy: new Float32Array(0),
    fade: new Float32Array(0),
    count: 0,
    mouseX: -9999,
    mouseY: -9999,
    mouseActive: false,
    initialized: false,
  });

  const initMiniGrid = useCallback((w: number, h: number) => {
    const spacing = 14;
    const cols = Math.ceil(w / spacing) + 1;
    const rows = Math.ceil(h / spacing) + 1;
    const count = cols * rows;

    const gx = new Float32Array(count);
    const gy = new Float32Array(count);
    const ox = new Float32Array(count);
    const oy = new Float32Array(count);
    const vx = new Float32Array(count);
    const vy = new Float32Array(count);
    const fade = new Float32Array(count);

    let idx = 0;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        gx[idx] = col * spacing;
        gy[idx] = row * spacing;
        idx++;
      }
    }

    // Elliptical vignette (same algorithm as downloaded DotGrid)
    const cx = w / 2;
    const cy = h / 2;
    const rx = cx;
    const ry = cy;
    const fadeStart = 0.35;
    const fadeEnd = 0.85;

    for (let i = 0; i < count; i++) {
      const dx = (gx[i] - cx) / rx;
      const dy = (gy[i] - cy) / ry;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= fadeStart) {
        fade[i] = 1;
      } else if (dist >= fadeEnd) {
        fade[i] = 0;
      } else {
        const t = (dist - fadeStart) / (fadeEnd - fadeStart);
        fade[i] = 1 - t * t * (3 - 2 * t); // Hermite smoothstep
      }
    }

    const s = miniGridStateRef.current;
    s.gx = gx;
    s.gy = gy;
    s.ox = ox;
    s.oy = oy;
    s.vx = vx;
    s.vy = vy;
    s.fade = fade;
    s.count = count;
    s.initialized = true;
  }, []);

  const drawMiniGrid = useCallback(
    (ctx: CanvasRenderingContext2D, w: number, h: number) => {
      const s = miniGridStateRef.current;
      if (!s.initialized || s.count === 0) return;

      ctx.clearRect(0, 0, w, h);

      const mx = s.mouseX;
      const my = s.mouseY;
      const isActive = s.mouseActive;
      const ir = 70; // smaller influence radius for mini grid
      const ir2 = ir * ir;
      const repStr = 18; // slightly gentler repulsion
      const stiff = 0.15;
      const damp = 0.75;
      const dotR = 0.75;
      const dotOp = 0.5;
      const [cr, cg, cb] = canvasColorsRef.current.dotRgb;

      for (let i = 0; i < s.count; i++) {
        const baseX = s.gx[i];
        const baseY = s.gy[i];
        if (s.fade[i] < 0.01) continue;

        // Mouse repulsion
        if (isActive) {
          const ddx = baseX + s.ox[i] - mx;
          const ddy = baseY + s.oy[i] - my;
          const d2 = ddx * ddx + ddy * ddy;
          if (d2 < ir2 && d2 > 0.01) {
            const d = Math.sqrt(d2);
            const force = (1 - d / ir) * repStr;
            const nx = ddx / d;
            const ny = ddy / d;
            s.vx[i] += nx * force * 0.1;
            s.vy[i] += ny * force * 0.1;
          }
        }

        // Spring back + damping
        s.vx[i] += -s.ox[i] * stiff;
        s.vy[i] += -s.oy[i] * stiff;
        s.vx[i] *= damp;
        s.vy[i] *= damp;
        s.ox[i] += s.vx[i];
        s.oy[i] += s.vy[i];

        const alpha = dotOp * s.fade[i];
        ctx.fillStyle = `rgba(${cr},${cg},${cb},${alpha})`;
        ctx.beginPath();
        ctx.arc(baseX + s.ox[i], baseY + s.oy[i], dotR, 0, Math.PI * 2);
        ctx.fill();
      }
    },
    [],
  );

  // ── Mini grid one-time init (runs synchronously before paint) ──
  useLayoutEffect(() => {
    if (phase !== 'open') return;
    const mc = miniGridCanvasRef.current;
    if (!mc || miniGridStateRef.current.initialized) return;
    const mctx = mc.getContext('2d', { alpha: true });
    if (!mctx) return;
    const mw = mc.offsetWidth;
    const mh = mc.offsetHeight;
    if (mw <= 0 || mh <= 0) return;
    const dpr = window.devicePixelRatio || 1;
    mc.width = mw * dpr;
    mc.height = mh * dpr;
    mc.style.width = `${mw}px`;
    mc.style.height = `${mh}px`;
    mctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    initMiniGrid(mw, mh);
  }, [phase, initMiniGrid]);

  // ── Animation loop ────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let breathe = 0;
    let connectProgress = 0;
    let expandProgress = 0;
    let raf = 0;
    let lastW = 0;
    let lastH = 0;

    const tick = () => {
      const p = phaseRef.current;
      const wrapper = wrapperRef.current;
      if (!wrapper) {
        raf = requestAnimationFrame(tick);
        return;
      }

      const w = wrapper.offsetWidth;
      const h = wrapper.offsetHeight;

      // Resize seed canvas to wrapper
      if (w !== lastW || h !== lastH) {
        const dpr = window.devicePixelRatio || 1;
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        lastW = w;
        lastH = h;
      }

      // Phase transitions
      if (p === 'seed') {
        breathe += 0.03;
        connectProgress = 0;
        expandProgress = 0;
        borderDrawnRef.current = false;
      } else if (p === 'connecting') {
        breathe += 0.03;
        connectProgress = Math.min(1, connectProgress + 1 / 24);
        if (connectProgress >= 1) setPhase('expanding');
      } else if (p === 'expanding') {
        breathe += 0.03;
        expandProgress = Math.min(1, expandProgress + 1 / 36);
        if (expandProgress >= 1) {
          setPhase('open');
        }
        if (!borderDrawnRef.current && expandProgress > 0.5) {
          drawBorder(w, h);
        }
      } else if (p === 'open') {
        breathe += 0.03;
        expandProgress = 1;
        if (!borderDrawnRef.current) drawBorder(w, h);

        // Draw mini grid (init handled by useLayoutEffect above)
        const mc = miniGridCanvasRef.current;
        if (mc && miniGridStateRef.current.initialized) {
          const mctx = mc.getContext('2d', { alpha: true });
          if (mctx) {
            drawMiniGrid(mctx, mc.offsetWidth, mc.offsetHeight);
          }
        }
      } else if (p === 'collapsing') {
        breathe += 0.03;
        expandProgress = Math.max(0, expandProgress - 1 / 36);
        connectProgress = Math.max(0, connectProgress - 1 / 24);
        if (expandProgress <= 0 && connectProgress <= 0) {
          setPhase('seed');
          // Reset mini grid
          miniGridStateRef.current.initialized = false;
        }
      }

      // Only draw seed dots in non-open phases
      if (p !== 'open') {
        drawCanvas(ctx, w, h, breathe, connectProgress);
      }

      raf = requestAnimationFrame(tick);
    };

    // For reduced motion: draw once, no animation loop
    if (reducedMotion) {
      const w = wrapperRef.current?.offsetWidth ?? 56;
      const h = wrapperRef.current?.offsetHeight ?? 72;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawCanvas(ctx, w, h, 0, 0);
      return;
    }

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [
    phase,
    reducedMotion,
    drawCanvas,
    drawBorder,
    initMiniGrid,
    drawMiniGrid,
  ]);

  // ── Mini grid mouse tracking ──────────────────────────────────
  useEffect(() => {
    const mc = miniGridCanvasRef.current;
    if (!mc || phase !== 'open') return;

    const onMove = (e: MouseEvent) => {
      const rect = mc.getBoundingClientRect();
      miniGridStateRef.current.mouseX = e.clientX - rect.left;
      miniGridStateRef.current.mouseY = e.clientY - rect.top;
      miniGridStateRef.current.mouseActive = true;
    };
    const onLeave = () => {
      miniGridStateRef.current.mouseActive = false;
    };

    mc.addEventListener('mousemove', onMove);
    mc.addEventListener('mouseleave', onLeave);
    return () => {
      mc.removeEventListener('mousemove', onMove);
      mc.removeEventListener('mouseleave', onLeave);
    };
  }, [phase]);

  // ── Click handlers ────────────────────────────────────────────
  const handleClick = useCallback(() => {
    if (phaseRef.current !== 'seed') return;
    if (isTouchDevice || reducedMotion) {
      setPhase('open');
    } else {
      setPhase('connecting');
    }
  }, [isTouchDevice, reducedMotion]);

  const handleClose = useCallback(() => {
    if (isTouchDevice || reducedMotion) {
      setPhase('seed');
      miniGridStateRef.current.initialized = false;
    } else {
      setPhase('collapsing');
    }
  }, [isTouchDevice, reducedMotion]);

  // ── Click-outside / Escape ────────────────────────────────────
  useEffect(() => {
    if (!isExpanded) return;

    const onPointerDown = (e: PointerEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        handleClose();
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [isExpanded, handleClose]);

  // ── Scroll affordance (show gradient fade hint) ───────────────
  useEffect(() => {
    const el = contentRef.current;
    if (!el || !isExpanded) return;
    const onScroll = () => {
      if (!hasScrolled && el.scrollTop > 4) setHasScrolled(true);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [isExpanded, hasScrolled]);

  // Reset scroll state when collapsing
  useEffect(() => {
    if (phase === 'seed') setHasScrolled(false);
  }, [phase]);

  // ── Derived dimensions ────────────────────────────────────────
  const seedW = 56;
  const seedH = 72;
  const openW = 380;
  const openH = '55vh';

  const transition = `width 0.45s cubic-bezier(0.4,0,0.2,1), height 0.45s cubic-bezier(0.4,0,0.2,1), border-radius 0.3s ease`;

  // ── Stagger animation for panel content ───────────────────────
  const staggerDelay = (i: number) => `${80 + i * 50}ms`;
  const staggerStyle = (i: number): React.CSSProperties =>
    isExpanded
      ? {
          opacity: phase === 'open' ? 1 : 0,
          transform: phase === 'open' ? 'translateY(0)' : 'translateY(6px)',
          transition: `opacity 0.25s ease ${staggerDelay(i)}, transform 0.25s ease ${staggerDelay(i)}`,
        }
      : { opacity: 0 };

  // ── Render ────────────────────────────────────────────────────
  return (
    <div
      ref={wrapperRef}
      role="complementary"
      aria-label="DotGrid physics easter egg"
      onMouseEnter={() => !isExpanded && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={!isExpanded ? handleClick : undefined}
      style={{
        position: 'fixed',
        left: 16,
        ...(isTouchDevice
          ? { bottom: 16, top: 'auto' }
          : { bottom: 'calc(25vh - 72px)' }),
        zIndex: 40,
        width: isExpanded ? openW : seedW,
        height: isExpanded ? openH : seedH,
        borderRadius: isExpanded ? 10 : 6,
        overflow: isExpanded ? 'hidden' : 'visible',
        cursor: isExpanded ? 'default' : 'pointer',
        transition,
        pointerEvents: 'auto',
      }}
    >
      {/* Rough.js hand-drawn border */}
      <canvas
        ref={borderCanvasRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          opacity: isExpanded ? 1 : 0,
          transition: 'opacity 0.3s ease',
        }}
      />

      {/* Seed canvas (dot glyph) */}
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          opacity: phase === 'open' ? 0 : 1,
          transition: 'opacity 0.2s ease',
        }}
      />

      {/* Hover label: CANVAS below seed */}
      {!isExpanded && (
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: seedH + 4,
            transform: 'translateX(-50%)',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            opacity: isHovered ? 1 : 0,
            transition: 'opacity 0.2s ease',
          }}
        >
          <span
            className="font-mono"
            style={{
              fontSize: 8,
              letterSpacing: '0.12em',
              color: 'var(--color-text-light)',
            }}
          >
            CANVAS
          </span>
        </div>
      )}

      {/* ── Expanded panel content ─────────────────────────────── */}
      {isExpanded && (
        <div
          ref={contentRef}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            overflowY: 'auto',
            overflowX: 'hidden',
            padding: '12px 14px',
            backgroundColor: 'var(--color-surface)',
          }}
        >
          {/* Header row */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 10,
              ...staggerStyle(0),
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div
                style={{
                  width: 3,
                  height: 18,
                  borderRadius: 1,
                  backgroundColor: 'var(--color-text-light)',
                }}
              />
              <span
                className="font-mono"
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: 'var(--color-text-muted)',
                  letterSpacing: '0.1em',
                }}
              >
                DOT GRID
              </span>
              <span
                className="font-mono"
                style={{
                  fontSize: 8,
                  color: 'var(--color-text-light)',
                  letterSpacing: '0.06em',
                }}
              >
                Interactive Canvas Background
              </span>
            </div>

            {/* Close button */}
            <button
              onClick={handleClose}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--color-text-light)',
                padding: 4,
                lineHeight: 0,
                minWidth: 44,
                minHeight: 44,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              aria-label="Close DotGrid panel"
            >
              <X size={14} weight="regular" />
            </button>
          </div>

          {/* ── Interactive mini DotGrid ─────────────────────── */}
          <div
            style={{
              position: 'relative',
              height: 140,
              marginBottom: 10,
              borderRadius: 6,
              overflow: 'hidden',
              border: '1px solid var(--color-border-light)',
              backgroundColor: 'var(--color-bg)',
              ...staggerStyle(1),
            }}
          >
            <canvas
              ref={miniGridCanvasRef}
              style={{
                width: '100%',
                height: '100%',
                cursor: 'crosshair',
              }}
            />
            <span
              className="font-mono"
              style={{
                position: 'absolute',
                bottom: 4,
                right: 6,
                fontSize: 7,
                letterSpacing: '0.1em',
                color: 'var(--color-text-light)',
                opacity: 0.6,
                pointerEvents: 'none',
              }}
            >
              MOVE CURSOR TO INTERACT
            </span>
          </div>

          {/* ── SPRING PHYSICS section ───────────────────────── */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 6,
              ...staggerStyle(2),
            }}
          >
            <div
              style={{
                width: 3,
                height: 16,
                borderRadius: 1,
                backgroundColor: 'var(--color-terracotta)',
              }}
            />
            <span
              className="font-mono"
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: 'var(--color-terracotta)',
                letterSpacing: '0.1em',
              }}
            >
              SPRING PHYSICS
            </span>
          </div>

          {PHYSICS_PARAMS.map((p, i) => (
            <div
              key={p.label}
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 0,
                marginBottom: 3,
                marginLeft: 11,
                lineHeight: '16px',
                ...staggerStyle(3 + i),
              }}
            >
              <span
                className="font-mono"
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  color: 'var(--color-text-muted)',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  letterSpacing: '0.06em',
                }}
              >
                {p.label}
              </span>
              <span
                className="font-mono"
                style={{
                  fontSize: 9,
                  color: 'var(--color-terracotta)',
                  marginLeft: 8,
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                {p.value}
              </span>
              <span
                className="font-mono"
                style={{
                  fontSize: 8,
                  color: 'var(--color-text-light)',
                  marginLeft: 6,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {p.desc}
              </span>
            </div>
          ))}

          {/* ── RADIAL VIGNETTE section ──────────────────────── */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 6,
              marginTop: 10,
              ...staggerStyle(9),
            }}
          >
            <div
              style={{
                width: 3,
                height: 16,
                borderRadius: 1,
                backgroundColor: 'var(--color-teal)',
              }}
            />
            <span
              className="font-mono"
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: 'var(--color-teal)',
                letterSpacing: '0.1em',
              }}
            >
              RADIAL VIGNETTE
            </span>
          </div>

          {VIGNETTE_PARAMS.map((p, i) => (
            <div
              key={p.label}
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 0,
                marginBottom: 3,
                marginLeft: 11,
                lineHeight: '16px',
                ...staggerStyle(10 + i),
              }}
            >
              <span
                className="font-mono"
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  color: 'var(--color-text-muted)',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  letterSpacing: '0.06em',
                }}
              >
                {p.label}
              </span>
              <span
                className="font-mono"
                style={{
                  fontSize: 9,
                  color: 'var(--color-teal)',
                  marginLeft: 8,
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                {p.value}
              </span>
              <span
                className="font-mono"
                style={{
                  fontSize: 8,
                  color: 'var(--color-text-light)',
                  marginLeft: 6,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {p.desc}
              </span>
            </div>
          ))}

          {/* ── PERFORMANCE section ──────────────────────────── */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 6,
              marginTop: 10,
              ...staggerStyle(14),
            }}
          >
            <div
              style={{
                width: 3,
                height: 16,
                borderRadius: 1,
                backgroundColor: 'var(--color-gold)',
              }}
            />
            <span
              className="font-mono"
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: 'var(--color-gold)',
                letterSpacing: '0.1em',
              }}
            >
              PERFORMANCE
            </span>
          </div>

          {PERF_NOTES.map((note, i) => (
            <div
              key={note}
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 6,
                marginBottom: 3,
                marginLeft: 11,
                lineHeight: '16px',
                ...staggerStyle(15 + i),
              }}
            >
              <span
                style={{
                  width: 3,
                  height: 3,
                  borderRadius: '50%',
                  backgroundColor: 'var(--color-gold)',
                  flexShrink: 0,
                  position: 'relative',
                  top: -1,
                }}
              />
              <span
                className="font-mono"
                style={{
                  fontSize: 9,
                  color: 'var(--color-text-muted)',
                  letterSpacing: '0.02em',
                }}
              >
                {note}
              </span>
            </div>
          ))}

          {/* ── Bundle size footer ───────────────────────────── */}
          <div
            style={{
              marginTop: 12,
              paddingTop: 8,
              borderTop: '1px solid var(--color-border-light)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              ...staggerStyle(19),
            }}
          >
            <span
              className="font-mono"
              style={{
                fontSize: 8,
                color: 'var(--color-text-light)',
                letterSpacing: '0.06em',
              }}
            >
              ~2.5 kB gzipped
            </span>
            <span
              className="font-mono"
              style={{
                fontSize: 8,
                color: 'var(--color-text-light)',
                letterSpacing: '0.06em',
              }}
            >
              DotGrid.tsx
            </span>
          </div>

          {/* Scroll fade hint */}
          {!hasScrolled && (
            <div
              style={{
                position: 'sticky',
                bottom: 0,
                left: 0,
                right: 0,
                height: 24,
                background:
                  'linear-gradient(transparent, var(--color-surface))',
                pointerEvents: 'none',
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}
