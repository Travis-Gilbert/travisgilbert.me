'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { X } from '@phosphor-icons/react';
import rough from 'roughjs';

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
// 3 core dots (diagonal, all teal) + 12 scatter dots (4 per core).
// Diagonal arrangement echoes the three data paths flowing through
// the research_api: static, dynamic, inbound.

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
  const rng = mulberry32(107);
  const dots: SeedDot[] = [];

  // Core dots (diagonal: top-left to bottom-right, all teal)
  const cores = [
    { x: 14, y: 16, hex: '#2D5F6B' },
    { x: 28, y: 38, hex: '#2D5F6B' },
    { x: 42, y: 60, hex: '#2D5F6B' },
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

  // Scatter dots (4 per core, each cluster uses a different brand color)
  // Static path scatter: terracotta
  // Dynamic path scatter: gold
  // Inbound path scatter: ink-muted
  const scatterGroups = [
    {
      positions: [{ x: 6, y: 8 }, { x: 22, y: 10 }, { x: 8, y: 24 }, { x: 20, y: 22 }],
      hex: '#B45A2D',
    },
    {
      positions: [{ x: 18, y: 32 }, { x: 38, y: 34 }, { x: 22, y: 44 }, { x: 36, y: 44 }],
      hex: '#C49A4A',
    },
    {
      positions: [{ x: 34, y: 52 }, { x: 50, y: 56 }, { x: 36, y: 66 }, { x: 48, y: 66 }],
      hex: '#6A5E52',
    },
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
// Core indices: 0=static, 1=dynamic, 2=inbound
// Scatter indices: 3..6=terracotta(static), 7..10=gold(dynamic), 11..14=ink(inbound)

const CONNECTION_PAIRS = [
  [0, 3], [0, 4], [0, 5], [0, 6],
  [1, 7], [1, 8], [1, 9], [1, 10],
  [2, 11], [2, 12], [2, 13], [2, 14],
  [0, 1], [1, 2],
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

const DATA_PATHS = [
  {
    name: 'Static',
    route: 'publish_research',
    detail: 'JSON serialization to GitHub via Git Trees API',
    dotColor: '#B45A2D',
  },
  {
    name: 'Dynamic',
    route: '/api/v1/',
    detail: 'DRF read-only viewsets: sources, threads, backlinks, graph',
    dotColor: '#C49A4A',
  },
  {
    name: 'Inbound',
    route: '/mentions/webhook/',
    detail: 'W3C Webmention receiver + community suggestions',
    dotColor: '#6A5E52',
  },
];

const MODEL_ITEMS = [
  { name: 'Source', detail: '13 types (book, article, paper, video, podcast, dataset...)' },
  { name: 'SourceLink', detail: '7 roles (primary, background, data, counterargument...)' },
  { name: 'ResearchThread', detail: 'active / paused / completed / abandoned' },
  { name: 'ThreadEntry', detail: 'source, note, milestone, connection, question' },
  { name: 'Mention', detail: '6 types (reply, link, repost, like, mention, quote)' },
  { name: 'MentionSource', detail: '4 discovery methods (webmention, manual, referrer, search)' },
];

const COMMUNITY_ITEMS = [
  { name: 'SourceSuggestion', detail: 'reCAPTCHA v3 gated' },
  { name: 'ConnectionSuggestion', detail: 'public submission queue' },
];

const READ_ENDPOINTS = [
  { path: '/trail/<slug>', desc: 'BFF' },
  { path: '/sources/', desc: 'catalog' },
  { path: '/threads/', desc: 'research' },
  { path: '/mentions/<slug>', desc: 'inbound' },
  { path: '/backlinks/<slug>', desc: 'graph' },
  { path: '/graph/', desc: 'full map' },
];

const WRITE_ENDPOINTS = [
  { path: '/suggest/source/', desc: 'submit' },
  { path: '/suggest/connection/', desc: 'link' },
  { path: '/suggestions/<slug>', desc: 'approved' },
];

const HOOK_ENDPOINTS = [
  { path: '/mentions/webhook/', desc: 'W3C' },
  { path: '/publisher/webhook/', desc: 'deploy' },
];

const PUBLISHER_FILES = [
  'sources.json',
  'links.json',
  'threads.json',
  'backlinks.json',
];

// Section accent colors
const SECTION_COLORS = {
  paths: '#2D5F6B',
  models: '#B45A2D',
  endpoints: '#C49A4A',
  publisher: '#6A5E52',
};

// Number of staggered content items (for footer delay calculation)
const STAGGER_COUNT = 19;

// ── Component ─────────────────────────────────────────────────────

export default function ResearchAPIEasterEgg() {
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
    const parent = canvas.parentElement;
    const w = parent ? parent.getBoundingClientRect().width : 400;
    const h = parent ? parent.getBoundingClientRect().height : 400;

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
      stroke: '#3A3632',
      bowing: 1,
      seed: 94,
    });

    borderDrawnRef.current = true;
  }, []);

  // Draw border when entering open phase
  useEffect(() => {
    if (phase === 'open') {
      const timer = setTimeout(drawBorder, 50);
      return () => clearTimeout(timer);
    }
    if (phase === 'seed') {
      borderDrawnRef.current = false;
    }
  }, [phase, drawBorder]);

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
          const [r, g, b] = hexToRgb(dot.colorHex);
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

          // Stroke color from source dot
          const [cr, cg, cb] = hexToRgb(a.colorHex);
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
    // Touch devices and reduced motion: draw static dots once, skip rAF loop
    if (isTouchDevice || reducedMotion) {
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

  // ── Click handler ───────────────────────────────────────────────

  const handleClick = useCallback(() => {
    if (phase === 'seed') {
      if (isTouchDevice || reducedMotion) {
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
  }, [phase, isTouchDevice, reducedMotion]);

  // ── Close handler (reduced motion aware) ────────────────────────

  const handleClose = useCallback(
    (e?: React.MouseEvent) => {
      if (e) e.stopPropagation();
      if (isTouchDevice || reducedMotion) {
        connectProgressRef.current = 0;
        expandProgressRef.current = 0;
        phaseRef.current = 'seed';
        setPhase('seed');
      } else {
        phaseRef.current = 'collapsing';
        setPhase('collapsing');
      }
    },
    [isTouchDevice, reducedMotion],
  );

  // ── Click outside ───────────────────────────────────────────────

  useEffect(() => {
    if (phase !== 'open' && phase !== 'expanding') return;

    function handleClickOutside(e: PointerEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        handleClose();
      }
    }

    document.addEventListener('pointerdown', handleClickOutside);
    return () => document.removeEventListener('pointerdown', handleClickOutside);
  }, [phase, handleClose]);

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

  // Transition strings (none on touch / reduced motion)
  const ease = 'cubic-bezier(0.33, 1, 0.68, 1)';
  const wrapperTransition = isTouchDevice || reducedMotion
    ? 'none'
    : phase === 'expanding' || phase === 'collapsing'
      ? `width 600ms ${ease}, height 600ms ${ease}, background-color 400ms ease, box-shadow 400ms ease, backdrop-filter 400ms ease`
      : 'none';

  // Stagger delay (0 on touch / reduced motion)
  const stagger = (i: number) => (isTouchDevice || reducedMotion ? 0 : i * 20);

  // Shared stagger style helper
  const staggerStyle = (i: number) => ({
    opacity: isTouchDevice || reducedMotion || phase === 'open' ? 1 : 0,
    transform:
      isTouchDevice || reducedMotion || phase === 'open'
        ? 'translateY(0)'
        : 'translateY(6px)',
    transition: isTouchDevice || reducedMotion
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
        left: '50%',
        transform: `translateX(-50%)`,
        ...(isTouchDevice
          ? { bottom: 16, top: 'auto' }
          : { top: '65vh' }),
        width: isExpanded ? openW : seedW,
        height: isExpanded ? openH : seedH,
        maxWidth: isExpanded ? 'calc(100vw - 32px)' : undefined,
        maxHeight: 'calc(100vh - 32px)',
        zIndex: 40,
        overflow: isExpanded ? 'hidden' : 'visible',
        cursor: phase === 'seed' ? 'pointer' : 'default',
        transition: wrapperTransition,
        backgroundColor: isExpanded ? 'rgba(244, 239, 232, 0.95)' : 'transparent',
        boxShadow: isExpanded
          ? '0 4px 16px rgba(42,36,32,0.10), 0 2px 6px rgba(42,36,32,0.05)'
          : 'none',
        backdropFilter: isExpanded ? 'blur(4px)' : 'none',
        borderRadius: isExpanded ? 2 : 0,
      }}
      role="complementary"
      aria-label="Research API reference"
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

      {/* Hover label: TRAILS below seed */}
      {phase === 'seed' && (
        <div
          className="font-mono"
          style={{
            position: 'absolute',
            left: '50%',
            top: seedH + 4,
            transform: 'translateX(-50%)',
            fontSize: 10,
            color: '#2D5F6B',
            opacity: isTouchDevice ? 0.4 : isHovered ? 0.8 : 0,
            transition: isTouchDevice || reducedMotion ? 'none' : 'opacity 200ms ease',
            whiteSpace: 'nowrap',
            letterSpacing: '0.08em',
            pointerEvents: 'none',
            textTransform: 'uppercase',
          }}
        >
          TRAILS
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
            width: '100%',
            maxWidth: '100%',
            padding: '12px 12px 0 12px',
            opacity: isTouchDevice || reducedMotion
              ? 1
              : phase === 'open'
                ? 1
                : phase === 'expanding'
                  ? 0.6
                  : 0.3,
            transition: isTouchDevice || reducedMotion ? 'none' : 'opacity 300ms ease',
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
              borderBottom: '1px solid rgba(212, 204, 196, 0.3)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div
                style={{
                  width: 3,
                  height: 16,
                  borderRadius: 1,
                  backgroundColor: '#2D5F6B',
                }}
              />
              <div>
                <span
                  className="font-mono"
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: '#2D5F6B',
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                  }}
                >
                  Research API
                </span>
                <span
                  className="font-mono"
                  style={{
                    fontSize: 9,
                    color: '#9A8E82',
                    marginLeft: 10,
                    letterSpacing: '0.04em',
                  }}
                >
                  research_api
                </span>
                <a
                  href="https://research.travisgilbert.me/"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="font-mono"
                  style={{
                    display: 'block',
                    fontSize: 9,
                    color: '#2D5F6B',
                    letterSpacing: '0.04em',
                    marginTop: 1,
                    textDecoration: 'none',
                    borderBottom: '1px solid transparent',
                    transition: 'border-color 200ms ease',
                  }}
                  onMouseEnter={(e) => {
                    (e.target as HTMLAnchorElement).style.borderBottomColor = '#2D5F6B';
                  }}
                  onMouseLeave={(e) => {
                    (e.target as HTMLAnchorElement).style.borderBottomColor = 'transparent';
                  }}
                >
                  research.travisgilbert.me
                </a>
              </div>
            </div>

            {/* Close button */}
            <button
              onClick={handleClose}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: '#6A5E52',
                padding: 4,
                lineHeight: 0,
                minWidth: 44,
                minHeight: 44,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              aria-label="Close research API panel"
            >
              <X size={14} weight="regular" />
            </button>
          </div>

          {/* ── DATA PATHS section ────────────────────────────── */}
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
                backgroundColor: SECTION_COLORS.paths,
              }}
            />
            <span
              className="font-mono"
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: SECTION_COLORS.paths,
                letterSpacing: '0.1em',
              }}
            >
              DATA PATHS
            </span>
          </div>

          {DATA_PATHS.map((path, i) => (
            <div
              key={path.name}
              style={{
                marginBottom: 4,
                marginLeft: 11,
                ...staggerStyle(1 + i),
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    backgroundColor: path.dotColor,
                    flexShrink: 0,
                  }}
                />
                <span
                  className="font-mono"
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    color: '#2A2420',
                  }}
                >
                  {path.name}
                </span>
                <span
                  className="font-mono"
                  style={{
                    fontSize: 9,
                    color: '#9A8E82',
                    letterSpacing: '0.04em',
                  }}
                >
                  {path.route}
                </span>
              </div>
              <div
                className="font-mono"
                style={{
                  fontSize: 8,
                  color: '#6A5E52',
                  marginLeft: 12,
                  marginTop: 1,
                  lineHeight: '14px',
                }}
              >
                {path.detail}
              </div>
            </div>
          ))}

          {/* ── MODELS section ─────────────────────────────────── */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 6,
              marginTop: 8,
              ...staggerStyle(4),
            }}
          >
            <div
              style={{
                width: 3,
                height: 16,
                borderRadius: 1,
                backgroundColor: SECTION_COLORS.models,
              }}
            />
            <span
              className="font-mono"
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: SECTION_COLORS.models,
                letterSpacing: '0.1em',
              }}
            >
              MODELS
            </span>
          </div>

          {MODEL_ITEMS.map((item, i) => (
            <div
              key={item.name}
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 0,
                marginBottom: 2,
                marginLeft: 11,
                lineHeight: '16px',
                ...staggerStyle(5 + i),
              }}
            >
              <span
                className="font-mono"
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: '#2A2420',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                {item.name}
              </span>
              <span
                className="font-mono"
                style={{
                  fontSize: 8,
                  color: '#9A8E82',
                  marginLeft: 6,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {item.detail}
              </span>
            </div>
          ))}

          {/* Community sub-group */}
          <div
            style={{
              marginLeft: 11,
              marginTop: 4,
              marginBottom: 2,
              ...staggerStyle(11),
            }}
          >
            <span
              className="font-mono"
              style={{
                fontSize: 8,
                color: '#9A8E82',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              Community
            </span>
          </div>

          {COMMUNITY_ITEMS.map((item, i) => (
            <div
              key={item.name}
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 0,
                marginBottom: 2,
                marginLeft: 11,
                lineHeight: '16px',
                ...staggerStyle(12 + i),
              }}
            >
              <span
                className="font-mono"
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: '#2A2420',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                {item.name}
              </span>
              <span
                className="font-mono"
                style={{
                  fontSize: 8,
                  color: '#9A8E82',
                  marginLeft: 6,
                  whiteSpace: 'nowrap',
                }}
              >
                {item.detail}
              </span>
            </div>
          ))}

          {/* ── ENDPOINTS section ──────────────────────────────── */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 6,
              marginTop: 8,
              ...staggerStyle(14),
            }}
          >
            <div
              style={{
                width: 3,
                height: 16,
                borderRadius: 1,
                backgroundColor: SECTION_COLORS.endpoints,
              }}
            />
            <span
              className="font-mono"
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: SECTION_COLORS.endpoints,
                letterSpacing: '0.1em',
              }}
            >
              ENDPOINTS
            </span>
          </div>

          {/* Read endpoints */}
          <div
            style={{
              marginLeft: 11,
              marginBottom: 4,
              ...staggerStyle(15),
            }}
          >
            <span
              className="font-mono"
              style={{
                fontSize: 8,
                color: '#9A8E82',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              Read (6)
            </span>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '2px 12px',
                marginTop: 2,
              }}
            >
              {READ_ENDPOINTS.map((ep) => (
                <div
                  key={ep.path}
                  style={{
                    display: 'flex',
                    gap: 4,
                    alignItems: 'baseline',
                  }}
                >
                  <span
                    className="font-mono"
                    style={{
                      fontSize: 9,
                      color: SECTION_COLORS.endpoints,
                      fontWeight: 600,
                    }}
                  >
                    {ep.path}
                  </span>
                  <span
                    className="font-mono"
                    style={{ fontSize: 8, color: '#6A5E52' }}
                  >
                    {ep.desc}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Write endpoints */}
          <div
            style={{
              marginLeft: 11,
              marginBottom: 4,
              ...staggerStyle(16),
            }}
          >
            <span
              className="font-mono"
              style={{
                fontSize: 8,
                color: '#9A8E82',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              Write (3)
            </span>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '2px 12px',
                marginTop: 2,
              }}
            >
              {WRITE_ENDPOINTS.map((ep) => (
                <div
                  key={ep.path}
                  style={{
                    display: 'flex',
                    gap: 4,
                    alignItems: 'baseline',
                  }}
                >
                  <span
                    className="font-mono"
                    style={{
                      fontSize: 9,
                      color: SECTION_COLORS.endpoints,
                      fontWeight: 600,
                    }}
                  >
                    {ep.path}
                  </span>
                  <span
                    className="font-mono"
                    style={{ fontSize: 8, color: '#6A5E52' }}
                  >
                    {ep.desc}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Hook endpoints */}
          <div
            style={{
              marginLeft: 11,
              marginBottom: 4,
              ...staggerStyle(17),
            }}
          >
            <span
              className="font-mono"
              style={{
                fontSize: 8,
                color: '#9A8E82',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              Hooks (2)
            </span>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '2px 12px',
                marginTop: 2,
              }}
            >
              {HOOK_ENDPOINTS.map((ep) => (
                <div
                  key={ep.path}
                  style={{
                    display: 'flex',
                    gap: 4,
                    alignItems: 'baseline',
                  }}
                >
                  <span
                    className="font-mono"
                    style={{
                      fontSize: 9,
                      color: SECTION_COLORS.endpoints,
                      fontWeight: 600,
                    }}
                  >
                    {ep.path}
                  </span>
                  <span
                    className="font-mono"
                    style={{ fontSize: 8, color: '#6A5E52' }}
                  >
                    {ep.desc}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* ── PUBLISHER section ──────────────────────────────── */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 6,
              marginTop: 8,
              ...staggerStyle(18),
            }}
          >
            <div
              style={{
                width: 3,
                height: 16,
                borderRadius: 1,
                backgroundColor: SECTION_COLORS.publisher,
              }}
            />
            <span
              className="font-mono"
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: SECTION_COLORS.publisher,
                letterSpacing: '0.1em',
              }}
            >
              PUBLISHER
            </span>
          </div>

          <div
            style={{
              marginLeft: 11,
              marginBottom: 4,
              ...staggerStyle(19),
            }}
          >
            <div
              className="font-mono"
              style={{
                fontSize: 9,
                color: '#2A2420',
                lineHeight: '16px',
              }}
            >
              {PUBLISHER_FILES.join(' . ')}
            </div>
            <div
              className="font-mono"
              style={{
                fontSize: 8,
                color: '#6A5E52',
                marginTop: 2,
                lineHeight: '14px',
              }}
            >
              + per-slug trail files via Git Trees API
            </div>
            <div
              style={{
                display: 'flex',
                gap: 12,
                marginTop: 4,
              }}
            >
              <span
                className="font-mono"
                style={{
                  fontSize: 9,
                  color: SECTION_COLORS.publisher,
                  fontWeight: 600,
                }}
              >
                PublishLog
              </span>
              <span
                className="font-mono"
                style={{ fontSize: 8, color: '#9A8E82' }}
              >
                audit trail per commit
              </span>
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
              borderTop: '1px solid rgba(212, 204, 196, 0.4)',
              opacity: isTouchDevice || reducedMotion
                ? 0.6
                : phase === 'open'
                  ? 0.6
                  : 0,
              transition: isTouchDevice || reducedMotion
                ? 'none'
                : `opacity 400ms ease ${STAGGER_COUNT * 20}ms`,
            }}
          >
            <span
              className="font-mono"
              style={{ fontSize: 9, color: '#9A8E82', letterSpacing: '0.06em' }}
            >
              Source Intelligence Layer
            </span>
            <span
              className="font-mono"
              style={{ fontSize: 9, color: '#9A8E82', letterSpacing: '0.06em' }}
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
                'linear-gradient(to bottom, rgba(244, 239, 232, 0) 0%, rgba(244, 239, 232, 0.95) 100%)',
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
              color: '#9A8E82',
              opacity: hasScrolled ? 0 : 0.5,
              transition: isTouchDevice || reducedMotion ? 'none' : 'opacity 300ms ease',
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
