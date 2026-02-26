'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
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

// ── Seed dot types ────────────────────────────────────────────────
// 4 core dots (brand colors) + 12 scatter dots (3 per core).
// Multi-colored glyph reads as a miniature color palette swatch.

interface SeedDot {
  x: number;
  y: number;
  r: number;
  isBinary: boolean;
  binaryChar: string;
  phaseOffset: number;
  colorHex: string;
}

function generateDots(): SeedDot[] {
  const rng = mulberry32(73);
  const dots: SeedDot[] = [];

  // Core dots (centered at x=28, one per brand color)
  const cores = [
    { x: 28, y: 14, hex: '#B45A2D' },
    { x: 28, y: 28, hex: '#2D5F6B' },
    { x: 28, y: 44, hex: '#C49A4A' },
    { x: 28, y: 58, hex: '#2A2420' },
  ];

  cores.forEach((pos) => {
    dots.push({
      x: pos.x + (rng() - 0.5) * 2,
      y: pos.y + (rng() - 0.5) * 2,
      r: 1.4 + rng() * 0.4,
      isBinary: false,
      binaryChar: '0',
      phaseOffset: rng() * Math.PI * 2,
      colorHex: pos.hex,
    });
  });

  // Scatter dots (3 per core color, clustered nearby)
  const scatterGroups = [
    { positions: [{ x: 12, y: 8 }, { x: 44, y: 10 }, { x: 18, y: 20 }], hex: '#B45A2D' },
    { positions: [{ x: 8, y: 24 }, { x: 42, y: 28 }, { x: 48, y: 34 }], hex: '#2D5F6B' },
    { positions: [{ x: 14, y: 40 }, { x: 46, y: 42 }, { x: 38, y: 52 }], hex: '#C49A4A' },
    { positions: [{ x: 10, y: 56 }, { x: 48, y: 60 }, { x: 20, y: 66 }], hex: '#2A2420' },
  ];

  scatterGroups.forEach((group) => {
    group.positions.forEach((pos) => {
      const jitter = 2.5;
      const isBin = rng() < 0.3;
      dots.push({
        x: pos.x + (rng() - 0.5) * jitter,
        y: pos.y + (rng() - 0.5) * jitter,
        r: 0.5 + rng() * 0.9,
        isBinary: isBin,
        binaryChar: rng() < 0.5 ? '0' : '1',
        phaseOffset: rng() * Math.PI * 2,
        colorHex: group.hex,
      });
    });
  });

  return dots;
}

const SEED_DOTS = generateDots();

// ── Connection pairs ──────────────────────────────────────────────
// Core indices: 0=terracotta, 1=teal, 2=gold, 3=ink
// Scatter indices: 4..6=terracotta, 7..9=teal, 10..12=gold, 13..15=ink

const CONNECTION_PAIRS = [
  [0, 4], [0, 5], [0, 6],
  [1, 7], [1, 8], [1, 9],
  [2, 10], [2, 11], [2, 12],
  [3, 13], [3, 14], [3, 15],
  [0, 1], [1, 2], [2, 3],
];

// ── Paper grain data URI ──────────────────────────────────────────

const PAPER_GRAIN_URI =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E\")";

// ── Phase type ────────────────────────────────────────────────────

type Phase = 'seed' | 'connecting' | 'expanding' | 'open' | 'collapsing';

// ── Dynamic footer date ───────────────────────────────────────────

function getRevDate(): string {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = now.getFullYear();
  return `Rev. ${mm}/${yyyy}`;
}

// ── Static content data ───────────────────────────────────────────

const PALETTE = [
  { hex: '#F0EBE4', needsBorder: true },
  { hex: '#2A2420', needsBorder: false },
  { hex: '#B45A2D', needsBorder: false },
  { hex: '#2D5F6B', needsBorder: false },
  { hex: '#C49A4A', needsBorder: false },
];

const TYPE_SYSTEMS = [
  { name: 'Documentarian', fontClass: 'font-title', stack: 'Vollkorn . Cabin . Courier Prime', usage: '80%' },
  { name: 'Architect', fontClass: 'font-title-alt', stack: 'Ysabeau . IBM Plex . Space Mono', usage: 'display' },
  { name: 'Editor', fontClass: 'font-title', stack: 'Vollkorn . IBM Plex . Space Mono', usage: 'investigations' },
];

const TOKENS = [
  { key: 'body', value: '17px / 1.75' },
  { key: 'H1', value: '38..44px' },
  { key: 'labels', value: '10..12px UP' },
  { key: 'max-width', value: '65ch' },
  { key: 'grid', value: '20px' },
  { key: 'radius', value: '10..14px' },
];

const DNA_ALWAYS = [
  'Patent drawings',
  'Blueprints',
  'Field notebooks',
  'Skeuomorphic depth',
  'Warm materiality',
];

const DNA_NEVER = [
  'Generic flat UI',
  'Startup sterile',
  'Neon/cyberpunk',
  'Rounded/bubbly',
];

// Section accent colors (hex for canvas default, var for JSX)
const SECTION_COLORS = {
  palette: '#C49A4A',
  type: '#B45A2D',
  tokens: '#2D5F6B',
  dna: '#6A5E52',
};

const SECTION_COLORS_VAR: Record<string, string> = {
  palette: 'var(--color-gold)',
  type: 'var(--color-terracotta)',
  tokens: 'var(--color-teal)',
  dna: 'var(--color-ink-secondary)',
};

/** Maps static hex constants to CSS custom property names for theme resolution */
const HEX_TO_CSS_VAR: Record<string, string> = {
  '#B45A2D': '--color-terracotta',
  '#2D5F6B': '--color-teal',
  '#C49A4A': '--color-gold',
  '#2A2420': '--color-ink',
};

// Number of staggered content items (for footer delay calculation)
const STAGGER_COUNT = 13;

// ── Component ─────────────────────────────────────────────────────

export default function DesignLanguageEasterEgg() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const borderCanvasRef = useRef<HTMLCanvasElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<Phase>('seed');
  const phaseRef = useRef<Phase>('seed');
  const [isHovered, setIsHovered] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [hasScrolled, setHasScrolled] = useState(false);
  const borderDrawnRef = useRef(false);

  // Theme-aware canvas colors (resolved from CSS custom properties)
  const themeVersion = useThemeVersion();
  const canvasColorsRef = useRef({
    roughHex: '#3A3632',
    /** Maps static hex -> resolved theme hex (for per-dot canvas colors) */
    dotColorMap: {
      '#B45A2D': '#B45A2D',
      '#2D5F6B': '#2D5F6B',
      '#C49A4A': '#C49A4A',
      '#2A2420': '#2A2420',
    } as Record<string, string>,
  });

  // Resolve canvas colors from CSS custom properties on theme change
  useEffect(() => {
    const roughHex = readCssVar('--color-rough') || '#3A3632';
    const dotColorMap: Record<string, string> = {};
    for (const [hex, cssVar] of Object.entries(HEX_TO_CSS_VAR)) {
      dotColorMap[hex] = readCssVar(cssVar) || hex;
    }
    canvasColorsRef.current = { roughHex, dotColorMap };
    // Force border redraw with new color
    borderDrawnRef.current = false;
  }, [themeVersion]);

  // Keep phaseRef in sync with state (for the rAF loop to read)
  phaseRef.current = phase;

  // Animation progress refs (mutable, no re-render)
  const connectProgressRef = useRef(0);
  const expandProgressRef = useRef(0);
  const breathePhaseRef = useRef(0);
  const rafRef = useRef<number>(0);

  // Touch + reduced motion detection on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsTouchDevice(window.matchMedia('(hover: none)').matches);
      setReducedMotion(
        window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      );
    }
  }, []);

  // ── Rough.js border drawing ─────────────────────────────────────

  const drawBorder = useCallback(() => {
    const canvas = borderCanvasRef.current;
    if (!canvas || borderDrawnRef.current) return;

    const dpr = window.devicePixelRatio || 1;
    const w = 400;
    const h = canvas.parentElement?.getBoundingClientRect().height ?? 400;

    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    const rc = rough.canvas(canvas);
    rc.rectangle(2, 2, w - 4, h - 4, {
      roughness: 1.2,
      strokeWidth: 1,
      stroke: canvasColorsRef.current.roughHex,
      bowing: 1,
      seed: 91,
    });

    borderDrawnRef.current = true;
  }, []);

  // Draw border when entering open phase or theme changes while open
  useEffect(() => {
    if (phase === 'open') {
      const timer = setTimeout(drawBorder, 50);
      return () => clearTimeout(timer);
    }
    if (phase === 'seed') {
      borderDrawnRef.current = false;
    }
  }, [phase, drawBorder, themeVersion]);

  // ── Canvas drawing ──────────────────────────────────────────────

  const drawCanvas = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      width: number,
      height: number,
      breathe: number,
      connectProg: number,
      expandProg: number,
    ) => {
      ctx.clearRect(0, 0, width, height);

      // Dot opacity fades as expansion progresses
      const dotAlpha = 1 - expandProg;
      if (dotAlpha > 0.01) {
        SEED_DOTS.forEach((dot) => {
          const a =
            (0.3 + 0.15 * Math.sin(breathe + dot.phaseOffset)) * dotAlpha;
          const resolvedHex = canvasColorsRef.current.dotColorMap[dot.colorHex] || dot.colorHex;
          const [r, g, b] = hexToRgb(resolvedHex);
          ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${a.toFixed(3)})`;

          if (dot.isBinary) {
            ctx.font = `${Math.round(dot.r * 5 + 4)}px monospace`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(dot.binaryChar, dot.x, dot.y);
          } else {
            ctx.beginPath();
            ctx.arc(dot.x, dot.y, dot.r, 0, Math.PI * 2);
            ctx.fill();
          }
        });
      }

      // Connecting: draw bezier pairs between seed dot positions
      if (connectProg > 0) {
        ctx.lineWidth = 0.8;

        const segsToDraw = Math.floor(connectProg * CONNECTION_PAIRS.length);
        for (let i = 0; i < segsToDraw && i < CONNECTION_PAIRS.length; i++) {
          const a = SEED_DOTS[CONNECTION_PAIRS[i][0]];
          const bDot = SEED_DOTS[CONNECTION_PAIRS[i][1]];
          if (!a || !bDot) continue;

          // Stroke color from source dot (theme-resolved)
          const resolvedConnHex = canvasColorsRef.current.dotColorMap[a.colorHex] || a.colorHex;
          const [cr, cg, cb] = hexToRgb(resolvedConnHex);
          ctx.strokeStyle = `rgba(${cr}, ${cg}, ${cb}, 0.18)`;

          const cpx = (a.x + bDot.x) / 2 + (a.phaseOffset - bDot.phaseOffset) * 3;
          const cpy = (a.y + bDot.y) / 2 + (bDot.r - a.r) * 8;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.quadraticCurveTo(cpx, cpy, bDot.x, bDot.y);
          ctx.stroke();
        }
      }
    },
    [],
  );

  // ── Animation loop (mount-only; reads phase from ref) ───────────

  useEffect(() => {
    if (isTouchDevice) return;

    // Reduced motion: draw static dots once, skip rAF loop
    if (reducedMotion) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d', { alpha: true });
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      canvas.width = 56 * dpr;
      canvas.height = 72 * dpr;
      canvas.style.width = '56px';
      canvas.style.height = '72px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      drawCanvas(ctx, 56, 72, 0, 0, 0);
      return;
    }

    let running = true;

    function tick() {
      if (!running) return;

      const canvas = canvasRef.current;
      const wrapper = wrapperRef.current;
      if (!canvas) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      const ctx = canvas.getContext('2d', { alpha: true });
      if (!ctx) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      breathePhaseRef.current += 0.03;
      const p = phaseRef.current;

      // Phase transitions via refs (setPhase triggers re-render for wrapper sizing)
      if (p === 'connecting') {
        connectProgressRef.current = Math.min(1, connectProgressRef.current + 1 / 24);
        if (connectProgressRef.current >= 1) {
          phaseRef.current = 'expanding';
          setPhase('expanding');
        }
      }

      if (p === 'expanding') {
        expandProgressRef.current = Math.min(1, expandProgressRef.current + 1 / 36);
        if (expandProgressRef.current >= 1) {
          phaseRef.current = 'open';
          setPhase('open');
        }
      }

      if (p === 'collapsing') {
        expandProgressRef.current = Math.max(0, expandProgressRef.current - 1 / 36);
        if (expandProgressRef.current <= 0) {
          connectProgressRef.current = Math.max(0, connectProgressRef.current - 1 / 24);
          if (connectProgressRef.current <= 0) {
            phaseRef.current = 'seed';
            setPhase('seed');
          }
        }
      }

      // Resize canvas to wrapper
      if (wrapper) {
        const dpr = window.devicePixelRatio || 1;
        const rect = wrapper.getBoundingClientRect();
        const w = rect.width;
        const h = rect.height;

        if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
          canvas.width = Math.round(w * dpr);
          canvas.height = Math.round(h * dpr);
          canvas.style.width = `${w}px`;
          canvas.style.height = `${h}px`;
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }
      }

      drawCanvas(
        ctx,
        canvas.width / (window.devicePixelRatio || 1),
        canvas.height / (window.devicePixelRatio || 1),
        breathePhaseRef.current,
        connectProgressRef.current,
        expandProgressRef.current,
      );

      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      running = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, [isTouchDevice, reducedMotion, drawCanvas]);

  // ── Click outside ───────────────────────────────────────────────

  useEffect(() => {
    if (phase !== 'open' && phase !== 'expanding') return;

    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        phaseRef.current = 'collapsing';
        setPhase('collapsing');
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [phase]);

  // ── Escape key ──────────────────────────────────────────────────

  useEffect(() => {
    if (phase !== 'open' && phase !== 'expanding') return;

    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        phaseRef.current = 'collapsing';
        setPhase('collapsing');
      }
    }

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [phase]);

  // ── Click handler ───────────────────────────────────────────────

  const handleClick = useCallback(() => {
    if (phase === 'seed') {
      if (reducedMotion) {
        connectProgressRef.current = 1;
        expandProgressRef.current = 1;
        phaseRef.current = 'open';
        setPhase('open');
      } else {
        connectProgressRef.current = 0;
        expandProgressRef.current = 0;
        phaseRef.current = 'connecting';
        setPhase('connecting');
      }
    }
  }, [phase, reducedMotion]);

  // ── Close handler (reduced motion aware) ────────────────────────

  const handleClose = useCallback(
    (e?: React.MouseEvent) => {
      if (e) e.stopPropagation();
      if (reducedMotion) {
        connectProgressRef.current = 0;
        expandProgressRef.current = 0;
        phaseRef.current = 'seed';
        setPhase('seed');
      } else {
        phaseRef.current = 'collapsing';
        setPhase('collapsing');
      }
    },
    [reducedMotion],
  );

  // ── Scroll affordance ───────────────────────────────────────────

  const handleContentScroll = useCallback(() => {
    const el = contentRef.current;
    if (el && el.scrollTop > 20 && !hasScrolled) {
      setHasScrolled(true);
    }
  }, [hasScrolled]);

  // Reset scroll state when closing
  useEffect(() => {
    if (phase === 'seed') {
      setHasScrolled(false);
    }
  }, [phase]);

  // ── Derived dimensions ──────────────────────────────────────────

  const isExpanded = phase === 'expanding' || phase === 'open' || phase === 'collapsing';
  const seedW = 56;
  const seedH = 72;
  const openW = 400;
  const openH = '60vh';

  if (isTouchDevice) return null;

  // Transition strings (none in reduced motion)
  const wrapperTransition = reducedMotion
    ? 'none'
    : phase === 'expanding' || phase === 'collapsing'
      ? 'width 600ms cubic-bezier(0.33, 1, 0.68, 1), height 600ms cubic-bezier(0.33, 1, 0.68, 1), background-color 400ms ease, box-shadow 400ms ease, backdrop-filter 400ms ease'
      : 'none';

  // Stagger delay (0 in reduced motion)
  const stagger = (i: number) => (reducedMotion ? 0 : i * 20);

  // Shared stagger style helper
  const staggerStyle = (i: number) => ({
    opacity: reducedMotion || phase === 'open' ? 1 : 0,
    transform:
      reducedMotion || phase === 'open'
        ? 'translateY(0)'
        : 'translateY(6px)',
    transition: reducedMotion
      ? 'none'
      : `opacity 300ms ease ${stagger(i)}ms, transform 300ms ease ${stagger(i)}ms`,
  });

  return (
    <div
      ref={wrapperRef}
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        position: 'fixed',
        right: 16,
        top: '30vh',
        width: isExpanded ? openW : seedW,
        height: isExpanded ? openH : seedH,
        maxWidth: isExpanded ? 'calc(100vw - 32px)' : undefined,
        zIndex: 40,
        overflow: isExpanded ? 'hidden' : 'visible',
        cursor: phase === 'seed' ? 'pointer' : 'default',
        transition: wrapperTransition,
        backgroundColor: isExpanded ? 'color-mix(in srgb, var(--color-paper) 95%, transparent)' : 'transparent',
        boxShadow: isExpanded
          ? 'var(--shadow-warm-lg)'
          : 'none',
        backdropFilter: isExpanded ? 'blur(4px)' : 'none',
        borderRadius: isExpanded ? 2 : 0,
      }}
      role="complementary"
      aria-label="Design language reference"
    >
      {/* Paper grain overlay (visible when expanded) */}
      {isExpanded && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: PAPER_GRAIN_URI,
            backgroundRepeat: 'repeat',
            opacity: 0.05,
            pointerEvents: 'none',
            borderRadius: 2,
          }}
        />
      )}

      {/* Rough.js hand-drawn border canvas (drawn once on open) */}
      {isExpanded && (
        <canvas
          ref={borderCanvasRef}
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            zIndex: 1,
          }}
        />
      )}

      {/* Canvas for dots and connecting lines */}
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
        }}
      />

      {/* Hover label: TOKENS below seed */}
      {phase === 'seed' && (
        <div
          className="font-mono"
          style={{
            position: 'absolute',
            left: '50%',
            top: seedH + 4,
            transform: 'translateX(-50%)',
            fontSize: 10,
            color: 'var(--color-gold)',
            opacity: isHovered ? 0.8 : 0,
            transition: reducedMotion ? 'none' : 'opacity 200ms ease',
            whiteSpace: 'nowrap',
            letterSpacing: '0.08em',
            pointerEvents: 'none',
            textTransform: 'uppercase',
          }}
        >
          TOKENS
        </div>
      )}

      {/* Panel content (visible when expanded) */}
      {isExpanded && (
        <div
          ref={contentRef}
          onScroll={handleContentScroll}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: openW,
            maxWidth: '100%',
            padding: '12px 12px 0 12px',
            opacity: reducedMotion
              ? 1
              : phase === 'open'
                ? 1
                : phase === 'expanding'
                  ? 0.6
                  : 0.3,
            transition: reducedMotion ? 'none' : 'opacity 300ms ease',
            overflowY: 'auto',
            maxHeight: '100%',
            zIndex: 2,
          }}
        >
          {/* ── Panel header ───────────────────────────────────── */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 10,
              paddingBottom: 8,
              borderBottom: '1px solid color-mix(in srgb, var(--color-border-light) 30%, transparent)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div
                style={{
                  width: 3,
                  height: 16,
                  borderRadius: 1,
                  backgroundColor: 'var(--color-gold)',
                }}
              />
              <div>
                <span
                  className="font-mono"
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: 'var(--color-gold)',
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                  }}
                >
                  Design Language
                </span>
                <span
                  className="font-mono"
                  style={{
                    fontSize: 9,
                    color: 'var(--color-ink-muted)',
                    marginLeft: 10,
                    letterSpacing: '0.04em',
                  }}
                >
                  v1.0
                </span>
              </div>
            </div>

            {/* Close button */}
            <button
              onClick={handleClose}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--color-ink-secondary)',
                padding: 4,
                lineHeight: 0,
              }}
              aria-label="Close design language panel"
            >
              <X size={14} weight="regular" />
            </button>
          </div>

          {/* ── PALETTE section ─────────────────────────────────── */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 6,
              ...staggerStyle(0),
            }}
          >
            <div
              style={{
                width: 3,
                height: 16,
                borderRadius: 1,
                backgroundColor: SECTION_COLORS_VAR.palette,
              }}
            />
            <span
              className="font-mono"
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: SECTION_COLORS_VAR.palette,
                letterSpacing: '0.1em',
              }}
            >
              PALETTE
            </span>
            <span
              className="font-mono"
              style={{
                fontSize: 9,
                color: 'var(--color-ink-muted)',
                letterSpacing: '0.04em',
              }}
            >
              Patent Parchment
            </span>
          </div>

          <div
            style={{
              display: 'flex',
              gap: 10,
              alignItems: 'center',
              flexWrap: 'wrap',
              marginBottom: 10,
              marginLeft: 11,
              ...staggerStyle(1),
            }}
          >
            {PALETTE.map((c) => (
              <div
                key={c.hex}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <div
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    backgroundColor: c.hex,
                    border: c.needsBorder ? '1px solid var(--color-border-light)' : 'none',
                    flexShrink: 0,
                  }}
                />
                <span
                  className="font-mono"
                  style={{ fontSize: 9, color: 'var(--color-ink-secondary)' }}
                >
                  {c.hex}
                </span>
              </div>
            ))}
          </div>

          {/* ── TYPE SYSTEMS section ────────────────────────────── */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 6,
              marginTop: 4,
              ...staggerStyle(2),
            }}
          >
            <div
              style={{
                width: 3,
                height: 16,
                borderRadius: 1,
                backgroundColor: SECTION_COLORS_VAR.type,
              }}
            />
            <span
              className="font-mono"
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: SECTION_COLORS_VAR.type,
                letterSpacing: '0.1em',
              }}
            >
              TYPE SYSTEMS
            </span>
          </div>

          {TYPE_SYSTEMS.map((sys, i) => (
            <div
              key={sys.name}
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 0,
                marginBottom: 3,
                marginLeft: 11,
                lineHeight: '18px',
                ...staggerStyle(3 + i),
              }}
            >
              <span
                className={sys.fontClass}
                style={{
                  fontSize: 12,
                  color: 'var(--color-ink)',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                {sys.name}
              </span>
              <span
                className="font-mono"
                style={{
                  fontSize: 9,
                  color: 'var(--color-ink-muted)',
                  marginLeft: 8,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {sys.stack}
              </span>
              <span
                className="font-mono"
                style={{
                  fontSize: 8,
                  color: SECTION_COLORS_VAR.palette,
                  marginLeft: 6,
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                {sys.usage}
              </span>
            </div>
          ))}

          {/* ── TOKENS section ──────────────────────────────────── */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 6,
              marginTop: 8,
              ...staggerStyle(6),
            }}
          >
            <div
              style={{
                width: 3,
                height: 16,
                borderRadius: 1,
                backgroundColor: SECTION_COLORS_VAR.tokens,
              }}
            />
            <span
              className="font-mono"
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: SECTION_COLORS_VAR.tokens,
                letterSpacing: '0.1em',
              }}
            >
              TOKENS
            </span>
            <span
              className="font-mono"
              style={{
                fontSize: 9,
                color: 'var(--color-ink-muted)',
                letterSpacing: '0.04em',
              }}
            >
              CSS custom properties
            </span>
          </div>

          {[0, 2, 4].map((startIdx, rowIdx) => (
            <div
              key={`token-row-${rowIdx}`}
              style={{
                display: 'flex',
                gap: 16,
                marginBottom: 3,
                marginLeft: 11,
                lineHeight: '16px',
                ...staggerStyle(7 + rowIdx),
              }}
            >
              {TOKENS.slice(startIdx, startIdx + 2).map((t) => (
                <div
                  key={t.key}
                  style={{
                    flex: 1,
                    display: 'flex',
                    gap: 6,
                  }}
                >
                  <span
                    className="font-mono"
                    style={{
                      fontSize: 9,
                      color: 'var(--color-terracotta)',
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {t.key}
                  </span>
                  <span
                    className="font-mono"
                    style={{
                      fontSize: 9,
                      color: 'var(--color-ink-secondary)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {t.value}
                  </span>
                </div>
              ))}
            </div>
          ))}

          {/* ── DNA section ─────────────────────────────────────── */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 6,
              marginTop: 8,
              ...staggerStyle(10),
            }}
          >
            <div
              style={{
                width: 3,
                height: 16,
                borderRadius: 1,
                backgroundColor: SECTION_COLORS_VAR.dna,
              }}
            />
            <span
              className="font-mono"
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: SECTION_COLORS_VAR.dna,
                letterSpacing: '0.1em',
              }}
            >
              DNA
            </span>
          </div>

          {/* Always keywords */}
          <div
            style={{
              marginLeft: 11,
              marginBottom: 6,
              ...staggerStyle(11),
            }}
          >
            <span
              className="font-mono"
              style={{
                fontSize: 8,
                color: 'var(--color-ink-muted)',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              Always
            </span>
            <div
              className="font-mono"
              style={{
                fontSize: 9,
                color: 'var(--color-ink)',
                marginTop: 2,
                lineHeight: '16px',
              }}
            >
              {DNA_ALWAYS.join(' . ')}
            </div>
          </div>

          {/* Never keywords */}
          <div
            style={{
              marginLeft: 11,
              marginBottom: 4,
              ...staggerStyle(12),
            }}
          >
            <span
              className="font-mono"
              style={{
                fontSize: 8,
                color: 'var(--color-ink-muted)',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              Never
            </span>
            <div
              className="font-mono"
              style={{
                fontSize: 9,
                color: 'var(--color-ink-muted)',
                marginTop: 2,
                lineHeight: '16px',
                textDecoration: 'line-through',
                textDecorationColor: 'color-mix(in srgb, var(--color-ink-muted) 40%, transparent)',
              }}
            >
              {DNA_NEVER.join(' . ')}
            </div>
          </div>

          {/* ── Footer ──────────────────────────────────────────── */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: 16,
              paddingTop: 8,
              paddingBottom: 12,
              borderTop: '1px solid color-mix(in srgb, var(--color-border-light) 40%, transparent)',
              opacity: reducedMotion
                ? 0.6
                : phase === 'open'
                  ? 0.6
                  : 0,
              transition: reducedMotion
                ? 'none'
                : `opacity 400ms ease ${STAGGER_COUNT * 20}ms`,
            }}
          >
            <span
              className="font-mono"
              style={{ fontSize: 9, color: 'var(--color-ink-muted)', letterSpacing: '0.06em' }}
            >
              Patent Parchment Palette
            </span>
            <span
              className="font-mono"
              style={{ fontSize: 9, color: 'var(--color-ink-muted)', letterSpacing: '0.06em' }}
            >
              {getRevDate()}
            </span>
          </div>
        </div>
      )}

      {/* Scroll affordance: bottom gradient fade + indicator */}
      {phase === 'open' && (
        <>
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: 40,
              background:
                'linear-gradient(to bottom, color-mix(in srgb, var(--color-paper) 0%, transparent) 0%, color-mix(in srgb, var(--color-paper) 95%, transparent) 100%)',
              pointerEvents: 'none',
              zIndex: 3,
            }}
          />
          <div
            className="font-mono"
            aria-hidden="true"
            style={{
              position: 'absolute',
              bottom: 4,
              left: '50%',
              transform: 'translateX(-50%)',
              fontSize: 10,
              color: 'var(--color-ink-muted)',
              opacity: hasScrolled ? 0 : 0.5,
              transition: reducedMotion ? 'none' : 'opacity 300ms ease',
              pointerEvents: 'none',
              zIndex: 4,
            }}
          >
            v
          </div>
        </>
      )}
    </div>
  );
}
