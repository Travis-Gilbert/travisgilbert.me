'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { X } from '@phosphor-icons/react';
import rough from 'roughjs';
import { readCssVar, hexToRgb as hexToRgbUtil, useThemeVersion } from '@/hooks/useThemeColor';

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

// ── Tree data types ──────────────────────────────────────────────

type TreeColor = 'terracotta' | 'teal' | 'gold' | 'ink';

interface SectionEntry {
  type: 'section';
  label: string;
  summary: string;
  color: TreeColor;
}

interface SpacerEntry {
  type: 'spacer';
}

interface NodeEntry {
  type?: undefined;
  name: string;
  color: TreeColor;
  comment?: string;
  children?: NodeEntry[];
}

type TreeEntry = SectionEntry | SpacerEntry | NodeEntry;

interface FlatRow {
  kind: 'section' | 'spacer' | 'node';
  label?: string;
  summary?: string;
  name?: string;
  comment?: string;
  color: TreeColor;
  depth: number;
  isLast: boolean;
  parentIsLast: boolean[];
}

// ── Color hex map ────────────────────────────────────────────────

const COLOR_HEX: Record<TreeColor, string> = {
  terracotta: '#B45A2D',
  teal: '#2D5F6B',
  gold: '#C49A4A',
  ink: '#6A5E52',
};

/** CSS var references for JSX inline styles (auto-resolve in light/dark) */
const COLOR_VAR: Record<TreeColor, string> = {
  terracotta: 'var(--color-terracotta)',
  teal: 'var(--color-teal)',
  gold: 'var(--color-gold)',
  ink: 'var(--color-ink-secondary)',
};

// ── Tree definition (static) ─────────────────────────────────────

const TREE: TreeEntry[] = [
  {
    type: 'section',
    label: 'FRONTEND',
    summary: 'Next.js 15 . React 19 . TypeScript . Tailwind v4',
    color: 'terracotta',
  },
  {
    name: 'src/app/',
    color: 'terracotta',
    comment: 'App Router pages + layouts',
    children: [
      { name: 'essays/', color: 'terracotta', comment: 'long-form + YouTube' },
      { name: 'field-notes/', color: 'terracotta', comment: 'observations' },
      { name: 'projects/', color: 'terracotta', comment: 'role-based columns' },
      { name: 'shelf/', color: 'terracotta', comment: 'annotated references' },
      { name: 'toolkit/', color: 'terracotta', comment: 'workflow docs' },
      { name: 'api/comments/', color: 'terracotta', comment: 'REST endpoints' },
    ],
  },
  {
    name: 'src/components/',
    color: 'terracotta',
    comment: 'Server + Client',
    children: [
      { name: 'rough/', color: 'terracotta', comment: 'RoughBox, RoughLine, Callouts' },
      { name: 'DotGrid.tsx', color: 'terracotta', comment: 'spring-physics canvas' },
      { name: 'CollageHero.tsx', color: 'terracotta', comment: 'dark-ground hero' },
      { name: 'PatternImage.tsx', color: 'terracotta', comment: 'seeded generative art' },
      { name: 'SketchIcon.tsx', color: 'terracotta', comment: '10 hand-drawn SVGs' },
    ],
  },
  { name: 'src/content/', color: 'gold', comment: 'Markdown + Zod schemas' },
  { name: 'src/lib/', color: 'gold', comment: 'content.ts, connectionEngine' },
  { name: 'src/styles/global.css', color: 'terracotta', comment: 'tokens, surfaces, prose' },
  { type: 'spacer' },
  {
    type: 'section',
    label: 'BACKEND',
    summary: 'Django . Python . Pillow',
    color: 'teal',
  },
  {
    name: 'publishing_api/',
    color: 'teal',
    comment: 'Django Studio',
    children: [
      { name: 'apps/editor/', color: 'teal', comment: 'HTMX writing interface' },
      { name: 'apps/publisher/', color: 'teal', comment: 'GitHub Contents API' },
      { name: 'apps/content/', color: 'teal', comment: 'models + import CLI' },
    ],
  },
  {
    name: 'collage-engine/',
    color: 'teal',
    comment: 'Python + Pillow',
    children: [
      { name: 'collage_engine.py', color: 'teal', comment: 'composition system' },
      { name: 'remove_bg.py', color: 'teal', comment: 'background removal' },
    ],
  },
  { name: 'django-comments/', color: 'teal', comment: 'comment backend' },
  { type: 'spacer' },
  { name: 'docs/plans/', color: 'ink', comment: 'design documents' },
  { name: 'public/collage/', color: 'ink', comment: 'hero images' },
  { name: 'CLAUDE.md', color: 'ink', comment: 'AI agent instructions' },
];

// ── Flatten tree at module scope ─────────────────────────────────

function flattenTree(entries: TreeEntry[]): FlatRow[] {
  const rows: FlatRow[] = [];

  function walk(
    nodes: TreeEntry[],
    depth: number,
    parentIsLast: boolean[],
  ) {
    nodes.forEach((entry, i) => {
      const isLast = i === nodes.length - 1;

      if ('type' in entry && entry.type === 'section') {
        rows.push({
          kind: 'section',
          label: entry.label,
          summary: entry.summary,
          color: entry.color,
          depth,
          isLast,
          parentIsLast: [...parentIsLast],
        });
      } else if ('type' in entry && entry.type === 'spacer') {
        rows.push({
          kind: 'spacer',
          color: 'ink',
          depth,
          isLast,
          parentIsLast: [...parentIsLast],
        });
      } else {
        const node = entry as NodeEntry;
        rows.push({
          kind: 'node',
          name: node.name,
          comment: node.comment,
          color: node.color,
          depth,
          isLast,
          parentIsLast: [...parentIsLast],
        });
        if (node.children) {
          walk(node.children, depth + 1, [...parentIsLast, isLast]);
        }
      }
    });
  }

  walk(entries, 0, []);
  return rows;
}

const FLAT_ROWS = flattenTree(TREE);

// ── Seed dot positions: tree-skeleton glyph ──────────────────────
// Structured cluster that reads as a miniature circuit/tree notation.
// 3 trunk dots along center vertical, 13 branch dots radiating out.

interface SeedDot {
  x: number;
  y: number;
  r: number;
  isBinary: boolean;
  binaryChar: string;
  phaseOffset: number;
}

function generateDots(): SeedDot[] {
  const rng = mulberry32(42);
  const dots: SeedDot[] = [];

  // Trunk dots (always circles, centered at x=28)
  const trunk = [
    { x: 28, y: 12 },
    { x: 28, y: 36 },
    { x: 28, y: 60 },
  ];
  trunk.forEach((pos) => {
    dots.push({
      x: pos.x + (rng() - 0.5) * 2,
      y: pos.y + (rng() - 0.5) * 2,
      r: 1.0 + rng() * 0.4,
      isBinary: false,
      binaryChar: '0',
      phaseOffset: rng() * Math.PI * 2,
    });
  });

  // Branch dots radiating from trunk at varying depths
  const branches = [
    { x: 12, y: 8 }, { x: 44, y: 10 },
    { x: 8, y: 24 }, { x: 42, y: 28 }, { x: 50, y: 20 },
    { x: 14, y: 40 }, { x: 46, y: 38 }, { x: 38, y: 48 },
    { x: 10, y: 56 }, { x: 48, y: 54 }, { x: 20, y: 66 },
    { x: 36, y: 64 }, { x: 46, y: 68 },
  ];
  branches.forEach((pos) => {
    const jitter = 2.5;
    const isBin = rng() < 0.35;
    dots.push({
      x: pos.x + (rng() - 0.5) * jitter,
      y: pos.y + (rng() - 0.5) * jitter,
      r: 0.5 + rng() * 1.0,
      isBinary: isBin,
      binaryChar: rng() < 0.5 ? '0' : '1',
      phaseOffset: rng() * Math.PI * 2,
    });
  });

  return dots;
}

const SEED_DOTS = generateDots();

// ── Wobble path generator ────────────────────────────────────────

function wobblePath(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  seed: number,
): string {
  const rng = mulberry32(seed);
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  const steps = Math.max(2, Math.round(len / 8));
  const points: [number, number][] = [];

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const ox = i === 0 || i === steps ? 0 : (rng() - 0.5) * 2.4;
    const oy = i === 0 || i === steps ? 0 : (rng() - 0.5) * 2.4;
    points.push([x1 + dx * t + ox, y1 + dy * t + oy]);
  }

  let d = `M ${points[0][0].toFixed(1)} ${points[0][1].toFixed(1)}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const cpx = (prev[0] + curr[0]) / 2 + (rng() - 0.5) * 1.2;
    const cpy = (prev[1] + curr[1]) / 2 + (rng() - 0.5) * 1.2;
    d += ` Q ${cpx.toFixed(1)} ${cpy.toFixed(1)} ${curr[0].toFixed(1)} ${curr[1].toFixed(1)}`;
  }

  return d;
}

// ── SVG connector builder ────────────────────────────────────────
// Replaces ASCII box-drawing with all-wobble SVG connectors.
// Each depth level = 16px wide. Draws vertical continuation lines
// for non-last ancestors and L-shaped branch points.

const DEPTH_WIDTH = 16;

function ConnectorSVG({ row, rowIndex }: { row: FlatRow; rowIndex: number }) {
  if (row.depth === 0) return null;

  const totalWidth = row.depth * DEPTH_WIDTH;
  const h = 18;
  const paths: React.ReactElement[] = [];
  let pathKey = 0;

  // Vertical continuation lines for non-last ancestors
  for (let d = 1; d < row.depth; d++) {
    if (!row.parentIsLast[d]) {
      const x = (d - 0.5) * DEPTH_WIDTH;
      paths.push(
        <path
          key={pathKey++}
          d={wobblePath(x, 0, x, h, rowIndex * 200 + d * 31)}
          fill="none"
          style={{ stroke: 'var(--color-border-light)' }}
          strokeWidth={0.7}
          opacity={0.5}
        />,
      );
    }
  }

  // L-shaped branch at deepest level
  const branchX = (row.depth - 0.5) * DEPTH_WIDTH;
  const endX = totalWidth - 2;

  if (row.isLast) {
    // └ shape: vertical from top to midpoint, then horizontal to end
    paths.push(
      <path
        key={pathKey++}
        d={wobblePath(branchX, 0, branchX, h / 2, rowIndex * 200 + 97)}
        fill="none"
        style={{ stroke: 'var(--color-border-light)' }}
        strokeWidth={0.7}
        opacity={0.5}
      />,
    );
    paths.push(
      <path
        key={pathKey++}
        d={wobblePath(branchX, h / 2, endX, h / 2, rowIndex * 200 + 113)}
        fill="none"
        style={{ stroke: COLOR_VAR[row.color] }}
        strokeWidth={0.7}
        opacity={0.4}
      />,
    );
  } else {
    // ├ shape: vertical full height, horizontal from midpoint to end
    paths.push(
      <path
        key={pathKey++}
        d={wobblePath(branchX, 0, branchX, h, rowIndex * 200 + 97)}
        fill="none"
        style={{ stroke: 'var(--color-border-light)' }}
        strokeWidth={0.7}
        opacity={0.5}
      />,
    );
    paths.push(
      <path
        key={pathKey++}
        d={wobblePath(branchX, h / 2, endX, h / 2, rowIndex * 200 + 113)}
        fill="none"
        style={{ stroke: COLOR_VAR[row.color] }}
        strokeWidth={0.7}
        opacity={0.4}
      />,
    );
  }

  return (
    <svg
      width={totalWidth}
      height={h}
      viewBox={`0 0 ${totalWidth} ${h}`}
      style={{ flexShrink: 0, overflow: 'visible' }}
      aria-hidden="true"
    >
      {paths}
    </svg>
  );
}

// ── Paper grain data URI (matches global.css but at stronger 5% for panel) ──

const PAPER_GRAIN_URI =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E\")";

// ── Phase type ───────────────────────────────────────────────────

type Phase = 'seed' | 'connecting' | 'expanding' | 'open' | 'collapsing';

// ── Dynamic footer date ──────────────────────────────────────────

function getRevDate(): string {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = now.getFullYear();
  return `Rev. ${mm}/${yyyy}`;
}

// ── Component ────────────────────────────────────────────────────

export default function ArchitectureEasterEgg() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const borderCanvasRef = useRef<HTMLCanvasElement>(null);
  const treeContentRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<Phase>('seed');
  const phaseRef = useRef<Phase>('seed');
  const [isHovered, setIsHovered] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [hasScrolled, setHasScrolled] = useState(false);
  const borderDrawnRef = useRef(false);

  // Theme-aware canvas colors (read once per theme change, consumed by rAF loop via ref)
  const themeVersion = useThemeVersion();
  const canvasColorsRef = useRef({
    terracottaRgb: [180, 90, 45] as [number, number, number],
    roughHex: '#3A3632',
  });

  // Resolve CSS custom properties into concrete values on theme change
  useEffect(() => {
    const tc = readCssVar('--color-terracotta');
    if (tc) canvasColorsRef.current.terracottaRgb = hexToRgbUtil(tc);
    const rh = readCssVar('--color-rough');
    if (rh) canvasColorsRef.current.roughHex = rh;
    // Redraw border if panel is currently open (theme changed while open)
    if (phaseRef.current === 'open') {
      borderDrawnRef.current = false;
    }
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

  // ── Rough.js border drawing ──────────────────────────────────

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
      seed: 88,
    });

    borderDrawnRef.current = true;
  }, []);

  // Draw border when entering open phase or theme changes while open
  useEffect(() => {
    if (phase === 'open') {
      // Small delay for the panel to finish sizing
      const timer = setTimeout(drawBorder, 50);
      return () => clearTimeout(timer);
    }
    if (phase === 'seed') {
      borderDrawnRef.current = false;
    }
  }, [phase, drawBorder, themeVersion]);

  // ── Canvas drawing ──────────────────────────────────────────

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
          const [cr, cg, cb] = canvasColorsRef.current.terracottaRgb;
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

      // Connecting: draw parent-child bezier pairs from seed positions
      if (connectProg > 0) {
        const [lr, lg, lb] = canvasColorsRef.current.terracottaRgb;
        ctx.strokeStyle = `rgba(${lr}, ${lg}, ${lb}, 0.18)`;
        ctx.lineWidth = 0.8;

        // Connect trunk to branches in parent-child pairs
        // Trunk indices: 0, 1, 2. Branches: 3..15
        const pairs = [
          [0, 3], [0, 4], [1, 5], [1, 6], [1, 7],
          [2, 8], [2, 9], [2, 10], [0, 11], [1, 12],
          [2, 13], [2, 14], [2, 15],
        ];

        const segsToDraw = Math.floor(connectProg * pairs.length);
        for (let i = 0; i < segsToDraw && i < pairs.length; i++) {
          const a = SEED_DOTS[pairs[i][0]];
          const b = SEED_DOTS[pairs[i][1]];
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

  // ── Animation loop (mount-only; reads phase from ref) ───────

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

  // ── Click outside ───────────────────────────────────────────

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

  // ── Escape key ──────────────────────────────────────────────

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

  // ── Click handler ───────────────────────────────────────────

  const handleClick = useCallback(() => {
    if (phase === 'seed') {
      if (reducedMotion) {
        // Skip animation: jump straight to open
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

  // ── Close handler (reduced motion aware) ────────────────────

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

  // ── Scroll affordance ───────────────────────────────────────

  const handleTreeScroll = useCallback(() => {
    const el = treeContentRef.current;
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

  // ── Derived dimensions ──────────────────────────────────────

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

  return (
    <div
      ref={wrapperRef}
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        position: 'fixed',
        left: 16,
        top: '30vh',
        width: isExpanded ? openW : seedW,
        height: isExpanded ? openH : seedH,
        maxWidth: isExpanded ? 'calc(100vw - 32px)' : undefined,
        zIndex: 40,
        overflow: isExpanded ? 'hidden' : 'visible',
        cursor: phase === 'seed' ? 'pointer' : 'default',
        transition: wrapperTransition,
        // Panel surface: frosted parchment when expanded
        backgroundColor: isExpanded ? 'color-mix(in srgb, var(--color-paper) 95%, transparent)' : 'transparent',
        boxShadow: isExpanded ? 'var(--shadow-warm-lg)' : 'none',
        backdropFilter: isExpanded ? 'blur(4px)' : 'none',
        borderRadius: isExpanded ? 2 : 0,
      }}
      role="complementary"
      aria-label="Architecture file tree"
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

      {/* Hover label: SITE.MAP below seed */}
      {phase === 'seed' && (
        <div
          className="font-mono"
          style={{
            position: 'absolute',
            left: '50%',
            top: seedH + 4,
            transform: 'translateX(-50%)',
            fontSize: 10,
            color: 'var(--color-terracotta)',
            opacity: isHovered ? 0.8 : 0,
            transition: reducedMotion ? 'none' : 'opacity 200ms ease',
            whiteSpace: 'nowrap',
            letterSpacing: '0.08em',
            pointerEvents: 'none',
            textTransform: 'uppercase',
          }}
        >
          SITE.MAP
        </div>
      )}

      {/* Tree content (visible when open) */}
      {isExpanded && (
        <div
          ref={treeContentRef}
          onScroll={handleTreeScroll}
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
          {/* Panel header */}
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
                  backgroundColor: 'var(--color-terracotta)',
                }}
              />
              <div>
                <span
                  className="font-mono"
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: 'var(--color-terracotta)',
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                  }}
                >
                  Architecture
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
                  travisgilbert.me
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
              aria-label="Close file tree"
            >
              <X size={14} weight="regular" />
            </button>
          </div>

          {/* Tree rows */}
          <div style={{ marginTop: 0 }}>
            {FLAT_ROWS.map((row, i) => {
              const delay = stagger(i);

              if (row.kind === 'spacer') {
                return <div key={`spacer-${i}`} style={{ height: 8 }} />;
              }

              if (row.kind === 'section') {
                return (
                  <div
                    key={`section-${i}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      marginBottom: 6,
                      marginTop: i > 0 ? 4 : 0,
                      opacity: reducedMotion || phase === 'open' ? 1 : 0,
                      transform:
                        reducedMotion || phase === 'open'
                          ? 'translateY(0)'
                          : 'translateY(6px)',
                      transition: reducedMotion
                        ? 'none'
                        : `opacity 300ms ease ${delay}ms, transform 300ms ease ${delay}ms`,
                    }}
                  >
                    <div
                      style={{
                        width: 3,
                        height: 16,
                        borderRadius: 1,
                        backgroundColor: COLOR_VAR[row.color],
                      }}
                    />
                    <span
                      className="font-mono"
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: COLOR_VAR[row.color],
                        letterSpacing: '0.1em',
                      }}
                    >
                      {row.label}
                    </span>
                    <span
                      className="font-mono"
                      style={{
                        fontSize: 9,
                        color: 'var(--color-ink-muted)',
                        letterSpacing: '0.04em',
                      }}
                    >
                      {row.summary}
                    </span>
                  </div>
                );
              }

              // Regular node with all-wobble SVG connector
              return (
                <div
                  key={`node-${i}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0,
                    lineHeight: '18px',
                    opacity: reducedMotion || phase === 'open' ? 1 : 0,
                    transform:
                      reducedMotion || phase === 'open'
                        ? 'translateY(0)'
                        : 'translateY(6px)',
                    transition: reducedMotion
                      ? 'none'
                      : `opacity 300ms ease ${delay}ms, transform 300ms ease ${delay}ms`,
                  }}
                >
                  <ConnectorSVG row={row} rowIndex={i} />

                  <span
                    className="font-mono"
                    style={{
                      fontSize: 11,
                      color: COLOR_VAR[row.color],
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                    }}
                  >
                    {row.name}
                  </span>

                  {row.comment && (
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
                      # {row.comment}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Footer */}
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
                : `opacity 400ms ease ${FLAT_ROWS.length * 20}ms`,
            }}
          >
            <span
              className="font-mono"
              style={{ fontSize: 9, color: 'var(--color-ink-muted)', letterSpacing: '0.06em' }}
            >
              TS 53% . PY 28% . CSS 11%
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
