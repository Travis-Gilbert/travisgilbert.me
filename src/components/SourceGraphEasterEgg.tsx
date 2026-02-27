'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { X } from '@phosphor-icons/react';
import rough from 'roughjs';
// Dark terminal theme: colors hardcoded, no theme-awareness needed

//  SOURCE GRAPH EASTER EGG: FIG. 3
//  Connection Engine / Backend Architecture Schematic
//  5-phase state machine: seed > connecting > expanding > open > collapsing
//  Transparent BG, no scroll, 660px wide, teal themed

// Seeded PRNG (mulberry32): deterministic scatter

function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// SVG color tokens (terminal dark theme: bright on dark)

const T = {
  ink: '#D4CCC4',
  inkMuted: '#8A8680',
  inkLight: '#5A5652',
  terracotta: '#E88B5A',
  teal: '#5CB8C8',
  gold: '#E8C06A',
  border: '#3A3A3A',
  borderLight: '#2E2E2E',
};

// Rough-style multi-stroke SVG path generator
// Draws the path 2x with slight jitter for that pencil-on-paper feel

function roughPath(
  points: [number, number][],
  seed = 42,
  jitter = 1.2,
): [string, string] {
  const rng = mulberry32(seed);
  const j = () => (rng() - 0.5) * jitter * 2;

  let d1 = `M ${points[0][0] + j()},${points[0][1] + j()}`;
  for (let i = 1; i < points.length; i++) {
    d1 += ` L ${points[i][0] + j()},${points[i][1] + j()}`;
  }

  let d2 = `M ${points[0][0] + j()},${points[0][1] + j()}`;
  for (let i = 1; i < points.length; i++) {
    d2 += ` L ${points[i][0] + j()},${points[i][1] + j()}`;
  }

  return [d1, d2];
}

// SVG Helper Components

interface RoughRectProps {
  x: number; y: number; w: number; h: number;
  stroke: string; fill?: string; strokeWidth?: number;
  seed?: number; jitter?: number; opacity?: number; dash?: string;
}

function RoughRect({ x, y, w, h, stroke, fill, strokeWidth = 1.2, seed = 42, jitter = 1.4, opacity = 1, dash }: RoughRectProps) {
  const pts: [number, number][] = [[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]];
  const [d1, d2] = roughPath(pts, seed, jitter);
  return (
    <g opacity={opacity}>
      {fill && <path d={d1} fill={fill} stroke="none" />}
      <path d={d1} fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={dash} />
      <path d={d2} fill="none" stroke={stroke} strokeWidth={strokeWidth * 0.6} strokeLinecap="round" strokeLinejoin="round" opacity={0.4} strokeDasharray={dash} />
    </g>
  );
}

interface RoughLineProps {
  x1: number; y1: number; x2: number; y2: number;
  stroke: string; strokeWidth?: number; seed?: number;
  jitter?: number; opacity?: number; dash?: string;
}

function RoughSvgLine({ x1, y1, x2, y2, stroke, strokeWidth = 1, seed = 42, jitter = 0.8, opacity = 1, dash }: RoughLineProps) {
  const pts: [number, number][] = [[x1, y1], [x2, y2]];
  const [d1, d2] = roughPath(pts, seed, jitter);
  return (
    <g opacity={opacity}>
      <path d={d1} fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeDasharray={dash} />
      <path d={d2} fill="none" stroke={stroke} strokeWidth={strokeWidth * 0.5} strokeLinecap="round" opacity={0.35} strokeDasharray={dash} />
    </g>
  );
}

interface RoughArrowProps {
  x1: number; y1: number; x2: number; y2: number;
  stroke: string; seed?: number; jitter?: number; headSize?: number;
}

function RoughArrow({ x1, y1, x2, y2, stroke, seed = 42, jitter = 0.8, headSize = 7 }: RoughArrowProps) {
  const rng = mulberry32(seed);
  const j = () => (rng() - 0.5) * jitter;
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const ha1 = angle + Math.PI * 0.82;
  const ha2 = angle - Math.PI * 0.82;

  return (
    <g>
      <RoughSvgLine x1={x1} y1={y1} x2={x2} y2={y2} stroke={stroke} seed={seed} jitter={jitter} />
      <RoughSvgLine
        x1={x2} y1={y2}
        x2={x2 + Math.cos(ha1) * headSize + j()} y2={y2 + Math.sin(ha1) * headSize + j()}
        stroke={stroke} seed={seed + 10} jitter={jitter * 0.6}
      />
      <RoughSvgLine
        x1={x2} y1={y2}
        x2={x2 + Math.cos(ha2) * headSize + j()} y2={y2 + Math.sin(ha2) * headSize + j()}
        stroke={stroke} seed={seed + 20} jitter={jitter * 0.6}
      />
    </g>
  );
}

function RoughBidiArrow({ x1, y1, x2, y2, stroke, seed = 42 }: { x1: number; y1: number; x2: number; y2: number; stroke: string; seed?: number }) {
  return (
    <g>
      <RoughArrow x1={(x1 + x2) / 2} y1={(y1 + y2) / 2} x2={x2} y2={y2} stroke={stroke} seed={seed} headSize={6} />
      <RoughArrow x1={(x1 + x2) / 2} y1={(y1 + y2) / 2} x2={x1} y2={y1} stroke={stroke} seed={seed + 50} headSize={6} />
    </g>
  );
}

// Cross-hatch fill (patent drawing texture)

function CrossHatch({ x, y, w, h, color, spacing = 6, seed = 42, opacity = 0.08 }: {
  x: number; y: number; w: number; h: number;
  color: string; spacing?: number; seed?: number; opacity?: number;
}) {
  const rng = mulberry32(seed);
  const j = () => (rng() - 0.5) * 0.8;
  const lines: React.ReactElement[] = [];
  for (let i = -h; i < w; i += spacing) {
    lines.push(
      <line
        key={i}
        x1={Math.max(x, x + i) + j()}
        y1={Math.max(y, y - i) + j()}
        x2={Math.min(x + w, x + i + h) + j()}
        y2={Math.min(y + h, y + h - (i + h - w)) + j()}
        stroke={color}
        strokeWidth={0.5}
      />,
    );
  }
  return (
    <g opacity={opacity} clipPath={`url(#clip-${seed})`}>
      <defs>
        <clipPath id={`clip-${seed}`}>
          <rect x={x} y={y} width={w} height={h} />
        </clipPath>
      </defs>
      {lines}
    </g>
  );
}

// Animated data-flow dots

function FlowDots({ path, color, count = 3, duration = 4 }: {
  path: string; color: string; count?: number; duration?: number;
}) {
  return (
    <g>
      {Array.from({ length: count }).map((_, i) => (
        <circle key={i} r="1.8" fill={color} opacity="0.45">
          <animateMotion
            dur={`${duration}s`}
            repeatCount="indefinite"
            begin={`${(i / count) * duration}s`}
            path={path}
          />
        </circle>
      ))}
    </g>
  );
}

// Monospace text helper

function Mono({ x, y, children, size = 8, color = T.inkMuted, weight = 400, opacity = 1, anchor = 'start' }: {
  x: number; y: number; children: React.ReactNode;
  size?: number; color?: string; weight?: number; opacity?: number; anchor?: 'start' | 'middle' | 'end';
}) {
  return (
    <text
      x={x} y={y}
      fontFamily="'Courier Prime', 'Courier New', monospace"
      fontSize={size}
      fontWeight={weight}
      fill={color}
      opacity={opacity}
      textAnchor={anchor}
      letterSpacing="0.02em"
    >
      {children}
    </text>
  );
}

function SansText({ x, y, children, size = 7.5, color = T.inkMuted, opacity = 1 }: {
  x: number; y: number; children: React.ReactNode;
  size?: number; color?: string; opacity?: number;
}) {
  return (
    <text
      x={x} y={y}
      fontFamily="'IBM Plex Sans', 'Cabin', sans-serif"
      fontSize={size}
      fill={color}
      opacity={opacity}
    >
      {children}
    </text>
  );
}

// Leader line annotation (architectural callout)

function LeaderAnnotation({ x1, y1, pivotX, pivotY, x2, y2, label, color, seed = 1 }: {
  x1: number; y1: number; pivotX: number; pivotY: number;
  x2: number; y2: number; label: string; color: string; seed?: number;
}) {
  return (
    <g>
      <RoughSvgLine x1={x1} y1={y1} x2={pivotX} y2={pivotY} stroke={color} strokeWidth={0.7} seed={seed} jitter={0.5} opacity={0.55} />
      <RoughSvgLine x1={pivotX} y1={pivotY} x2={x2} y2={y2} stroke={color} strokeWidth={0.7} seed={seed + 5} jitter={0.5} opacity={0.55} />
      <circle cx={x1} cy={y1} r="2" fill={color} opacity="0.45" />
      <Mono x={x2 + 5} y={y2 + 3} size={6.5} color={color} opacity={0.65}>{label}</Mono>
    </g>
  );
}

// Seed dot positions: graph-cluster glyph
// Network topology cluster: 4 hub nodes + 11 spoke nodes.
// Reads as a miniature constellation / circuit board pattern.

interface SeedDot {
  x: number;
  y: number;
  r: number;
  isBinary: boolean;
  binaryChar: string;
  phaseOffset: number;
}

function generateDots(): SeedDot[] {
  const rng = mulberry32(73);
  const dots: SeedDot[] = [];

  // Hub nodes (form the core diamond of the network)
  const hubs = [
    { x: 28, y: 14 },
    { x: 12, y: 36 },
    { x: 44, y: 36 },
    { x: 28, y: 58 },
  ];
  hubs.forEach((pos) => {
    dots.push({
      x: pos.x + (rng() - 0.5) * 2,
      y: pos.y + (rng() - 0.5) * 2,
      r: 1.1 + rng() * 0.3,
      isBinary: false,
      binaryChar: '0',
      phaseOffset: rng() * Math.PI * 2,
    });
  });

  // Spoke nodes radiating around the hubs
  const spokes = [
    { x: 8, y: 14 }, { x: 48, y: 14 },
    { x: 20, y: 26 }, { x: 36, y: 26 },
    { x: 6, y: 50 }, { x: 50, y: 50 },
    { x: 18, y: 52 }, { x: 38, y: 52 },
    { x: 10, y: 66 }, { x: 46, y: 66 },
    { x: 28, y: 38 },
  ];
  spokes.forEach((pos) => {
    const jitter = 2.5;
    const isBin = rng() < 0.3;
    dots.push({
      x: pos.x + (rng() - 0.5) * jitter,
      y: pos.y + (rng() - 0.5) * jitter,
      r: 0.5 + rng() * 0.8,
      isBinary: isBin,
      binaryChar: rng() < 0.5 ? '0' : '1',
      phaseOffset: rng() * Math.PI * 2,
    });
  });

  return dots;
}

const SEED_DOTS = generateDots();

// Hub-to-hub and hub-to-spoke connecting pairs
// Hub indices: 0..3, spoke indices: 4..14
const CONNECT_PAIRS = [
  [0, 1], [0, 2], [1, 3], [2, 3],
  [0, 4], [0, 5], [0, 6], [0, 7],
  [1, 8], [1, 10],
  [2, 9], [2, 11],
  [3, 12], [3, 13], [3, 14],
];

// Phase type

type Phase = 'seed' | 'connecting' | 'expanding' | 'open' | 'collapsing';

// Component

export default function SourceGraphEasterEgg() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const borderCanvasRef = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<Phase>('seed');
  const phaseRef = useRef<Phase>('seed');
  const [isHovered, setIsHovered] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const borderDrawnRef = useRef(false);

  // Canvas colors (hardcoded for terminal dark theme)
  const canvasColorsRef = useRef({
    tealRgb: [92, 184, 200] as [number, number, number],
    tealHex: '#5CB8C8',
    roughHex: '#444444',
  });

  // Keep phaseRef in sync with state (for rAF loop to read)
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

  // Rough.js border drawing

  const drawBorder = useCallback(() => {
    const canvas = borderCanvasRef.current;
    if (!canvas || borderDrawnRef.current) return;

    const dpr = window.devicePixelRatio || 1;
    const parent = canvas.parentElement;
    const w = parent ? parent.getBoundingClientRect().width : 500;
    const h = parent ? parent.getBoundingClientRect().height : 540;

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
      strokeWidth: 0.8,
      stroke: canvasColorsRef.current.tealHex,
      bowing: 1,
      seed: 73,
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
  }, [phase, drawBorder]);

  // Canvas drawing (seed dots + connecting beziers)

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

      const dotAlpha = 1 - expandProg;
      if (dotAlpha > 0.01) {
        SEED_DOTS.forEach((dot) => {
          const a =
            (0.3 + 0.15 * Math.sin(breathe + dot.phaseOffset)) * dotAlpha;
          const [cr, cg, cb] = canvasColorsRef.current.tealRgb;
          ctx.fillStyle = `rgba(${cr}, ${cg}, ${cb}, ${a.toFixed(3)})`;

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

      // Connecting: draw hub-to-spoke bezier pairs
      if (connectProg > 0) {
        const [lr, lg, lb] = canvasColorsRef.current.tealRgb;
        ctx.strokeStyle = `rgba(${lr}, ${lg}, ${lb}, 0.18)`;
        ctx.lineWidth = 0.8;

        const segsToDraw = Math.floor(connectProg * CONNECT_PAIRS.length);
        for (let i = 0; i < segsToDraw && i < CONNECT_PAIRS.length; i++) {
          const a = SEED_DOTS[CONNECT_PAIRS[i][0]];
          const b = SEED_DOTS[CONNECT_PAIRS[i][1]];
          if (!a || !b) continue;
          const cpx = (a.x + b.x) / 2 + (a.phaseOffset - b.phaseOffset) * 3;
          const cpy = (a.y + b.y) / 2 + (b.r - a.r) * 8;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.quadraticCurveTo(cpx, cpy, b.x, b.y);
          ctx.stroke();
        }
      }
    },
    [],
  );

  // Animation loop (mount-only; reads phase from ref)

  useEffect(() => {
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

  // Click handler

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

  // Close handler (reduced motion aware)

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

  // Click outside

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

  // Escape key

  useEffect(() => {
    if (phase !== 'open' && phase !== 'expanding') return;

    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') handleClose();
    }

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [phase, handleClose]);

  // Derived dimensions

  const isExpanded = phase === 'expanding' || phase === 'open' || phase === 'collapsing';
  const seedW = 56;
  const seedH = 72;
  const openW = 500;
  const openH = 540;

  const wrapperTransition = isTouchDevice || reducedMotion
    ? 'none'
    : phase === 'expanding' || phase === 'collapsing'
      ? 'width 600ms cubic-bezier(0.33, 1, 0.68, 1), height 600ms cubic-bezier(0.33, 1, 0.68, 1)'
      : 'none';

  return (
    <div
      ref={wrapperRef}
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        position: 'fixed',
        right: '20vw',
        ...(isTouchDevice
          ? { bottom: 16, top: 'auto' }
          : { top: '80vh' }),
        width: isExpanded ? openW : seedW,
        height: isExpanded ? openH : seedH,
        maxWidth: isExpanded ? 'calc(100vw - 32px)' : undefined,
        maxHeight: isExpanded ? 'calc(100vh - 32px)' : undefined,
        zIndex: 40,
        overflow: isExpanded ? 'hidden' : 'visible',
        cursor: phase === 'seed' ? 'pointer' : 'default',
        transition: wrapperTransition,
        backgroundColor: isExpanded ? '#1c1c1c' : 'transparent',
        boxShadow: isExpanded
          ? '0 4px 24px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.3)'
          : 'none',
        borderRadius: isExpanded ? 2 : 0,
      }}
      role="complementary"
      aria-label="Source graph schematic"
    >
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

      {/* Canvas for seed dots and connecting lines */}
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

      {/* Hover label: SRC.GRAPH below seed */}
      {phase === 'seed' && (
        <div
          className="font-mono"
          style={{
            position: 'absolute',
            left: '50%',
            top: seedH + 4,
            transform: 'translateX(-50%)',
            fontSize: 10,
            color: '#5CB8C8',
            opacity: isTouchDevice ? 0.4 : isHovered ? 0.8 : 0,
            transition: isTouchDevice || reducedMotion ? 'none' : 'opacity 200ms ease',
            whiteSpace: 'nowrap',
            letterSpacing: '0.08em',
            pointerEvents: 'none',
            textTransform: 'uppercase',
          }}
        >
          SRC.GRAPH
        </div>
      )}

      {/* Panel content (visible when expanded) */}
      {isExpanded && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            padding: '12px 10px 8px 10px',
            opacity: isTouchDevice || reducedMotion
              ? 1
              : phase === 'open'
                ? 1
                : phase === 'expanding'
                  ? 0.6
                  : 0.3,
            transition: isTouchDevice || reducedMotion ? 'none' : 'opacity 300ms ease',
            zIndex: 2,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          {/* Close button (top-right corner) */}
          <button
            onClick={handleClose}
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#8A8680',
              padding: 4,
              minWidth: 44,
              minHeight: 44,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              lineHeight: 0,
              zIndex: 5,
            }}
            aria-label="Close source graph"
          >
            <X size={14} weight="regular" />
          </button>

          {/* Classification stamp */}
          <div
            className="font-mono"
            style={{
              fontSize: 8,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: '#5A5652',
              opacity: 0.6,
              marginBottom: 4,
            }}
          >
            System Architecture / Connection Engine
          </div>

          {/* Title */}
          <div
            className="font-title"
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: '#D4CCC4',
              margin: '0 0 2px 0',
              letterSpacing: '-0.02em',
            }}
          >
            Source Graph
          </div>

          {/* Subtitle */}
          <div
            className="font-mono"
            style={{
              fontSize: 9,
              color: '#5A5652',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              marginBottom: 12,
            }}
          >
            Railway Project / Backend Services
          </div>

          {/* SVG SCHEMATIC */}
          <svg
            viewBox="0 0 660 540"
            style={{ width: '100%', maxWidth: 500, overflow: 'visible' }}
            aria-label="Backend architecture diagram showing Railway project with draftroom and research_api services"
          >
            {/* RAILWAY PROJECT outer container (dashed) */}
            <RoughRect x={20} y={12} w={620} h={310} stroke={T.border} strokeWidth={1.4} seed={100} jitter={1.8} dash="8 4" />

            {/* Corner cross-hatching (patent texture) */}
            <CrossHatch x={22} y={14} w={28} h={28} color={T.ink} seed={101} opacity={0.06} spacing={5} />
            <CrossHatch x={610} y={14} w={28} h={28} color={T.ink} seed={102} opacity={0.06} spacing={5} />
            <CrossHatch x={22} y={292} w={28} h={28} color={T.ink} seed={103} opacity={0.06} spacing={5} />
            <CrossHatch x={610} y={292} w={28} h={28} color={T.ink} seed={104} opacity={0.06} spacing={5} />

            <Mono x={330} y={30} size={10} weight={700} color={T.ink} anchor="middle">RAILWAY PROJECT</Mono>

            {/* draftroom (Django) */}
            <RoughRect x={42} y={52} w={252} h={240} stroke={T.terracotta} strokeWidth={1.3} seed={200} jitter={1.6} fill="rgba(180,90,45,0.025)" />
            <Mono x={168} y={70} size={9} weight={700} color={T.terracotta} anchor="middle">draftroom (Django)</Mono>
            <RoughSvgLine x1={52} y1={76} x2={284} y2={76} stroke={T.terracotta} strokeWidth={0.5} seed={201} opacity={0.3} />

            {/* /sourcebox/ sub-box */}
            <RoughRect x={54} y={86} w={228} h={88} stroke={T.terracotta} strokeWidth={0.8} seed={210} jitter={1.2} dash="4 3" fill="rgba(180,90,45,0.015)" />
            <Mono x={62} y={100} size={8} weight={700} color={T.terracotta}>/sourcebox/</Mono>
            <SansText x={68} y={114}>Quick capture UI</SansText>
            <SansText x={68} y={127}>RawSource model</SansText>
            <SansText x={68} y={140}>Triage dashboard</SansText>

            {/* /connections/ sub-box */}
            <RoughRect x={54} y={186} w={228} h={78} stroke={T.terracotta} strokeWidth={0.8} seed={220} jitter={1.2} dash="4 3" fill="rgba(180,90,45,0.015)" />
            <Mono x={62} y={200} size={8} weight={700} color={T.terracotta}>/connections/</Mono>
            <SansText x={68} y={214}>SuggestedConn.</SansText>
            <SansText x={68} y={227}>Approve / dismiss</SansText>

            {/* research_api (Django REST) */}
            <RoughRect x={348} y={52} w={272} h={240} stroke={T.teal} strokeWidth={1.3} seed={300} jitter={1.6} fill="rgba(45,95,107,0.025)" />
            <Mono x={484} y={70} size={9} weight={700} color={T.teal} anchor="middle">research_api (Django REST)</Mono>
            <RoughSvgLine x1={358} y1={76} x2={610} y2={76} stroke={T.teal} strokeWidth={0.5} seed={301} opacity={0.3} />

            {/* API endpoints sub-box */}
            <RoughRect x={360} y={86} w={248} h={88} stroke={T.teal} strokeWidth={0.8} seed={310} jitter={1.2} dash="4 3" fill="rgba(45,95,107,0.015)" />
            <Mono x={368} y={100} size={8} weight={700} color={T.teal}>API Endpoints</Mono>
            <Mono x={374} y={114} size={7.5} color={T.inkMuted}>/api/v1/sources/</Mono>
            <Mono x={374} y={127} size={7.5} color={T.inkMuted}>/api/v1/threads/</Mono>
            <Mono x={374} y={140} size={7.5} color={T.inkMuted}>/api/v1/graph/</Mono>
            <Mono x={374} y={153} size={7.5} color={T.inkMuted}>{'/api/v1/trail/<slug>/'}</Mono>

            {/* Public paper-trail sub-box */}
            <RoughRect x={360} y={186} w={248} h={86} stroke={T.teal} strokeWidth={0.8} seed={320} jitter={1.2} dash="4 3" fill="rgba(45,95,107,0.015)" />
            <Mono x={368} y={200} size={8} weight={700} color={T.teal}>/paper-trail/</Mono>
            <Mono x={472} y={200} size={7} color={T.teal} opacity={0.7}>(PUBLIC)</Mono>
            <SansText x={374} y={214}>Graph explorer</SansText>
            <SansText x={374} y={227}>Thread timelines</SansText>
            <SansText x={374} y={240}>Source suggestion form</SansText>
            <SansText x={374} y={253}>Community wall</SansText>

            {/* Bidirectional arrow between modules */}
            <RoughBidiArrow x1={294} y1={140} x2={348} y2={140} stroke={T.gold} seed={400} />
            <FlowDots path="M 294,140 L 348,140" color={T.gold} count={2} duration={2.5} />

            {/* SHARED DATABASE connector */}
            <RoughSvgLine x1={168} y1={292} x2={168} y2={316} stroke={T.inkMuted} strokeWidth={0.9} seed={500} dash="5 3" opacity={0.5} />
            <RoughSvgLine x1={168} y1={316} x2={440} y2={316} stroke={T.inkMuted} strokeWidth={0.9} seed={501} dash="5 3" opacity={0.5} />
            <RoughSvgLine x1={440} y1={292} x2={440} y2={316} stroke={T.inkMuted} strokeWidth={0.9} seed={502} dash="5 3" opacity={0.5} />

            {/* DB cylinder icon */}
            <ellipse cx={265} cy={308} rx={11} ry={4.5} fill="none" stroke={T.inkLight} strokeWidth={0.9} />
            <path d="M 254,308 L 254,318 Q 265,325 276,318 L 276,308" fill="none" stroke={T.inkLight} strokeWidth={0.9} />

            <Mono x={282} y={313} size={8} weight={700} color={T.inkMuted}>SHARED DATABASE</Mono>

            {/* Publisher pipeline (vertical) */}
            <RoughSvgLine x1={330} y1={330} x2={330} y2={370} stroke={T.inkMuted} seed={600} />
            <RoughArrow x1={330} y1={370} x2={330} y2={400} stroke={T.inkMuted} seed={601} headSize={6} />
            <FlowDots path="M 330,330 L 330,400" color={T.terracotta} count={2} duration={2} />

            <Mono x={344} y={356} size={7.5} color={T.inkLight}>publisher</Mono>
            <SansText x={344} y={368} size={6.5} color={T.inkLight} opacity={0.7}>(commits JSON)</SansText>

            {/* travisgilbert.me module */}
            <RoughRect x={216} y={408} w={228} h={118} stroke={T.ink} strokeWidth={1.3} seed={700} jitter={1.6} fill="rgba(42,36,32,0.02)" />
            <Mono x={330} y={426} size={9} weight={700} color={T.ink} anchor="middle">travisgilbert.me</Mono>
            <Mono x={330} y={439} size={7} color={T.inkLight} anchor="middle">(Next.js / Vercel)</Mono>
            <RoughSvgLine x1={226} y1={446} x2={434} y2={446} stroke={T.ink} strokeWidth={0.5} seed={701} opacity={0.25} />

            <SansText x={232} y={462}>Essay Paper Trail</SansText>
            <SansText x={232} y={476}>Homepage section</SansText>
            <SansText x={232} y={490}>Embedded graph</SansText>
            <SansText x={232} y={504}>OG images w/ stats</SansText>

            {/* Annotation leader lines */}
            <LeaderAnnotation
              x1={62} y1={100} pivotX={18} pivotY={84} x2={-22} y2={72}
              label="CAPTURE" color={T.terracotta} seed={801}
            />
            <LeaderAnnotation
              x1={368} y1={200} pivotX={632} pivotY={186} x2={636} y2={172}
              label="PUBLIC FACING" color={T.teal} seed={802}
            />
            <LeaderAnnotation
              x1={330} y1={526} pivotX={460} pivotY={530} x2={468} y2={524}
              label="STATIC DEPLOY" color={T.inkLight} seed={803}
            />

            {/* Figure number (patent convention) */}
            <Mono x={636} y={536} size={9} color={T.inkLight} opacity={0.4} anchor="end">FIG. 3</Mono>

            {/* Dimension tick marks along Railway container */}
            {[100, 200, 300, 400, 500, 600].map((xp, i) => (
              <g key={`tick-${i}`} opacity={0.15}>
                <line x1={xp} y1={10} x2={xp} y2={16} stroke={T.ink} strokeWidth={0.5} />
              </g>
            ))}
            {[80, 160, 240].map((yp, i) => (
              <g key={`ytick-${i}`} opacity={0.15}>
                <line x1={16} y1={yp} x2={22} y2={yp} stroke={T.ink} strokeWidth={0.5} />
              </g>
            ))}
          </svg>

          {/* External link to research.travisgilbert.me */}
          <a
            href="https://research.travisgilbert.me"
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono"
            onClick={(e) => e.stopPropagation()}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              marginTop: 12,
              fontSize: 10,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: '#5CB8C8',
              textDecoration: 'none',
              padding: '5px 12px',
              border: '1px solid #5CB8C8',
              borderRadius: 1,
              transition: 'all 0.2s ease',
              opacity: 0.75,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = '1';
              e.currentTarget.style.background = 'rgba(92,184,200,0.12)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = '0.75';
              e.currentTarget.style.background = 'transparent';
            }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
            </svg>
            research.travisgilbert.me
          </a>

          {/* Footer stamp */}
          <div
            className="font-mono"
            style={{
              marginTop: 6,
              fontSize: 7,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: '#5A5652',
              opacity: 0.35,
            }}
          >
            Travis Gilbert / Connection Engine / v0.1
          </div>
        </div>
      )}
    </div>
  );
}
