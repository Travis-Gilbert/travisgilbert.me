'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { readCssVar, hexToRgb, useThemeVersion } from '@/hooks/useThemeColor';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';

// ---------------------------------------------------------------------------
// Close icon (Iconoir Xmark, inline SVG)
// ---------------------------------------------------------------------------

const XMARK_PATH =
  'M6.758 17.243L12.001 12m5.243-5.243L12 12m0 0L6.758 6.757M12.001 12l5.243 5.243';

function CloseIcon({ size = 14, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d={XMARK_PATH}
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Deterministic PRNG (mulberry32)
// ---------------------------------------------------------------------------

function mulberry32(seed: number): () => number {
  let s = seed;
  return function () {
    s += 0x6d2b79f5;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Terminal palette (always dark regardless of site theme)
// ---------------------------------------------------------------------------

const FIG_BLACK = '#1A1816';
const FIG_SURFACE = '#2A2622';
const FIG_BORDER_DIM = '#3A3632';
const FIG_BORDER = '#4A4642';
const FIG_TEXT_DIM = '#6A5E52';
const FIG_TEXT_MUTED = '#9A8E82';

// ---------------------------------------------------------------------------
// Gradient awareness (replicates DotGrid.tsx logic)
// ---------------------------------------------------------------------------

const INVERSION_DEPTH = 0.35;
const DARK_INVERSION_DEPTH = 0.25;
const GRADIENT_TAIL = 0.08;

function getInversionFactor(y: number, viewportH: number, isDark: boolean): number {
  const depth = isDark ? DARK_INVERSION_DEPTH : INVERSION_DEPTH;
  const gradEnd = viewportH * depth;
  const tailEnd = gradEnd + viewportH * GRADIENT_TAIL;

  if (y <= 0) return 1;
  if (y < gradEnd) {
    const t = y / gradEnd;
    return 1 - t * t * (3 - 2 * t);
  }
  if (y < tailEnd) {
    const t = (y - gradEnd) / (tailEnd - gradEnd);
    return (1 - t * t * (3 - 2 * t)) * 0.15;
  }
  return 0;
}

// ---------------------------------------------------------------------------
// Egg definitions
// ---------------------------------------------------------------------------

interface EggDef {
  id: string;
  label: string;
  color: string;
  colorVar: string;
  schematicType: string;
  description: string;
  hint: string;
}

const EGGS: EggDef[] = [
  {
    id: 'architecture',
    label: 'FIG. 1',
    color: '#B45A2D',
    colorVar: '--color-terracotta',
    schematicType: 'architecture',
    description: 'Site architecture tree. Shows the component hierarchy, route groups, and service layout.',
    hint: 'ctrl+shift+a',
  },
  {
    id: 'design-tokens',
    label: 'FIG. 2',
    color: '#C49A4A',
    colorVar: '--color-gold',
    schematicType: 'design-tokens',
    description: 'Design language and token system. Brand palette, typography scale, and surface utilities.',
    hint: 'ctrl+shift+d',
  },
  {
    id: 'research-api',
    label: 'FIG. 2B',
    color: '#2D5F6B',
    colorVar: '--color-teal',
    schematicType: 'research-api',
    description: 'Research API endpoint graph. 22 endpoints: search, graph algorithms, temporal analysis, webhooks.',
    hint: 'ctrl+shift+r',
  },
  {
    id: 'source-graph',
    label: 'FIG. 3',
    color: '#6B4F7A',
    colorVar: '',
    schematicType: 'source-graph',
    description: 'Knowledge source graph. PageRank, BFS shortest path, topological reading order.',
    hint: 'ctrl+shift+g',
  },
  {
    id: 'dot-grid',
    label: 'FIG. 4',
    color: '#2D5F6B',
    colorVar: '--color-teal',
    schematicType: 'dot-grid',
    description: 'Ambient dot grid engine. Gradient-aware canvas with hero zone inversion and DPR scaling.',
    hint: 'you are here',
  },
  {
    id: 'commonplace',
    label: 'FIG. 5',
    color: '#C49A4A',
    colorVar: '--color-gold',
    schematicType: 'commonplace',
    description: 'CommonPlace knowledge graph pipeline. Capture, NER, graph inference, and daily resurface.',
    hint: '/commonplace',
  },
];

// ---------------------------------------------------------------------------
// wobblePath: hand-drawn SVG line via quadratic bezier jitter (no roughjs)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Miniature schematic renderers (viewBox 0 0 50 65, no roughjs)
// ---------------------------------------------------------------------------

function SchematicArchitecture({ color, seed }: { color: string; seed: number }) {
  return (
    <svg viewBox="0 0 50 65" width="50" height="65" fill="none" overflow="visible">
      <rect x="18" y="4" width="14" height="7" rx="1" stroke={color} strokeWidth="0.8" />
      <text x="25" y="10" textAnchor="middle" fontSize="3.5" fill={color} fontFamily="monospace">/app</text>
      <path d={wobblePath(25, 11, 10, 20, seed + 1)} stroke={color} strokeWidth="0.7" />
      <path d={wobblePath(25, 11, 25, 20, seed + 2)} stroke={color} strokeWidth="0.7" />
      <path d={wobblePath(25, 11, 40, 20, seed + 3)} stroke={color} strokeWidth="0.7" />
      <rect x="3" y="20" width="14" height="7" rx="1" stroke={color} strokeWidth="0.8" />
      <text x="10" y="26" textAnchor="middle" fontSize="3.5" fill={color} fontFamily="monospace">src</text>
      <rect x="18" y="20" width="14" height="7" rx="1" stroke={color} strokeWidth="0.8" />
      <text x="25" y="26" textAnchor="middle" fontSize="3.5" fill={color} fontFamily="monospace">api</text>
      <rect x="33" y="20" width="14" height="7" rx="1" stroke={color} strokeWidth="0.8" />
      <text x="40" y="26" textAnchor="middle" fontSize="3.5" fill={color} fontFamily="monospace">cfg</text>
      <path d={wobblePath(10, 27, 6, 36, seed + 4)} stroke={color} strokeWidth="0.6" />
      <path d={wobblePath(10, 27, 14, 36, seed + 5)} stroke={color} strokeWidth="0.6" />
      <rect x="1" y="36" width="10" height="5" rx="1" stroke={color} strokeWidth="0.7" />
      <text x="6" y="40.5" textAnchor="middle" fontSize="3" fill={color} fontFamily="monospace">app</text>
      <rect x="9" y="36" width="12" height="5" rx="1" stroke={color} strokeWidth="0.7" />
      <text x="15" y="40.5" textAnchor="middle" fontSize="3" fill={color} fontFamily="monospace">comp</text>
      <path d={wobblePath(25, 27, 25, 36, seed + 6)} stroke={color} strokeWidth="0.6" />
      <rect x="19" y="36" width="12" height="5" rx="1" stroke={color} strokeWidth="0.7" />
      <text x="25" y="40.5" textAnchor="middle" fontSize="3" fill={color} fontFamily="monospace">drf</text>
      <path d={wobblePath(40, 27, 40, 36, seed + 7)} stroke={color} strokeWidth="0.6" />
      <rect x="34" y="36" width="12" height="5" rx="1" stroke={color} strokeWidth="0.7" />
      <text x="40" y="40.5" textAnchor="middle" fontSize="3" fill={color} fontFamily="monospace">env</text>
      <text x="2" y="60" fontSize="3" fill={FIG_TEXT_DIM} fontFamily="monospace">Next.js + Django</text>
    </svg>
  );
}

function SchematicDesignTokens({ color, seed }: { color: string; seed: number }) {
  const swatches: [string, string][] = [
    ['#B45A2D', 'terra'],
    ['#2D5F6B', 'teal'],
    ['#C49A4A', 'gold'],
    ['#3A3632', 'ink'],
    ['#9A8E82', 'muted'],
    ['#F0EBE4', 'paper'],
  ];
  return (
    <svg viewBox="0 0 50 65" width="50" height="65" fill="none" overflow="visible">
      <text x="2" y="8" fontSize="3.5" fill={color} fontFamily="monospace" fontWeight="bold">TOKENS</text>
      <path d={wobblePath(2, 10, 48, 10, seed)} stroke={color} strokeWidth="0.6" opacity={0.5} />
      {swatches.map((sw, i) => {
        const col = i % 3;
        const row = Math.floor(i / 3);
        const x = 2 + col * 16;
        const y = 14 + row * 20;
        return (
          <g key={sw[0]}>
            <rect x={x} y={y} width={13} height={13} rx="1" fill={sw[0]} opacity={0.75} />
            <rect x={x} y={y} width={13} height={13} rx="1" stroke={color} strokeWidth="0.6" opacity={0.3} />
            <text x={x + 6.5} y={y + 19} textAnchor="middle" fontSize="3" fill={FIG_TEXT_MUTED} fontFamily="monospace">{sw[1]}</text>
          </g>
        );
      })}
      <path d={wobblePath(2, 56, 48, 56, seed + 10)} stroke={color} strokeWidth="0.6" opacity={0.5} />
      <text x="2" y="62" fontSize="3" fill={FIG_TEXT_DIM} fontFamily="monospace">global.css tokens</text>
    </svg>
  );
}

function SchematicResearchAPI({ color, seed }: { color: string; seed: number }) {
  const boxes = [
    { label: '/search', y: 8 },
    { label: '/graph', y: 21 },
    { label: '/export', y: 34 },
    { label: '/sessions', y: 47 },
  ];
  return (
    <svg viewBox="0 0 50 65" width="50" height="65" fill="none" overflow="visible">
      <text x="2" y="5" fontSize="3" fill={FIG_TEXT_MUTED} fontFamily="monospace">research_api</text>
      {boxes.map((box, i) => (
        <g key={box.label}>
          <rect x="2" y={box.y} width="28" height="9" rx="1" stroke={color} strokeWidth="0.8" />
          <text x="6" y={box.y + 6} fontSize="4" fill={color} fontFamily="monospace">{box.label}</text>
          {i < boxes.length - 1 && (
            <path d={wobblePath(16, box.y + 9, 16, box.y + 12, seed + i)} stroke={color} strokeWidth="0.7" opacity={0.8} />
          )}
          <path d={wobblePath(30, box.y + 4.5, 44, box.y + 4.5, seed + i + 20)} stroke={color} strokeWidth="0.5" opacity={0.35} />
          <rect x="44" y={box.y + 1.5} width="4" height="6" rx="0.5" stroke={color} strokeWidth="0.5" opacity={0.5} />
        </g>
      ))}
      <text x="2" y="62" fontSize="3" fill={FIG_TEXT_DIM} fontFamily="monospace">22 endpoints</text>
    </svg>
  );
}

function SchematicSourceGraph({ color, seed }: { color: string; seed: number }) {
  const nodes = [
    { x: 25, y: 28, r: 3.5, label: 'hub' },
    { x: 10, y: 16, r: 2.5, label: 'src' },
    { x: 40, y: 16, r: 2.5, label: 'src' },
    { x: 8, y: 38, r: 2.5, label: 'ref' },
    { x: 42, y: 38, r: 2.5, label: 'ref' },
    { x: 25, y: 47, r: 2, label: 'tag' },
    { x: 14, y: 50, r: 1.5, label: '' },
    { x: 36, y: 50, r: 1.5, label: '' },
  ];
  const edges = [[0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [1, 5], [2, 4], [3, 6], [4, 7]];
  return (
    <svg viewBox="0 0 50 65" width="50" height="65" fill="none" overflow="visible">
      <text x="2" y="8" fontSize="3.5" fill={color} fontFamily="monospace" fontWeight="bold">SOURCES</text>
      {edges.map(([a, b], i) => (
        <path
          key={i}
          d={wobblePath(nodes[a].x, nodes[a].y, nodes[b].x, nodes[b].y, seed + i)}
          stroke={color}
          strokeWidth="0.6"
          opacity={0.4}
        />
      ))}
      {nodes.map((n, i) => (
        <g key={i}>
          <circle cx={n.x} cy={n.y} r={n.r} stroke={color} strokeWidth="0.8" fill={color} fillOpacity={0.12} />
          {n.label && (
            <text x={n.x} y={n.y + 1.3} textAnchor="middle" fontSize="2.5" fill={color} fontFamily="monospace">{n.label}</text>
          )}
        </g>
      ))}
      <text x="2" y="62" fontSize="3" fill={FIG_TEXT_DIM} fontFamily="monospace">PageRank + BFS</text>
    </svg>
  );
}

function SchematicDotGrid({ color, seed }: { color: string; seed: number }) {
  const rng = mulberry32(seed);
  const dots: { x: number; y: number; r: number; opacity: number }[] = [];
  const cx = 25;
  const cy = 32;
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 7; col++) {
      const x = 6 + col * 6;
      const y = 8 + row * 6;
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      const vignetteOpacity = Math.max(0, 1 - dist / 26);
      if (rng() > 0.15) {
        dots.push({ x, y, r: 1.2 + rng() * 0.6, opacity: vignetteOpacity * 0.85 });
      }
    }
  }
  return (
    <svg viewBox="0 0 50 65" width="50" height="65" fill="none" overflow="visible">
      {dots.map((d, i) => (
        <circle key={i} cx={d.x} cy={d.y} r={d.r} fill={color} opacity={d.opacity} />
      ))}
      <text x="2" y="62" fontSize="3" fill={FIG_TEXT_DIM} fontFamily="monospace">ambient engine</text>
    </svg>
  );
}

function SchematicCommonPlace({ color, seed }: { color: string; seed: number }) {
  const steps = [
    { label: 'Capture', c: color },
    { label: 'NER', c: '#2D5F6B' },
    { label: 'Graph', c: '#6B4F7A' },
    { label: 'Resurface', c: color },
  ];
  const stepH = 10;
  const gap = 3;
  const startY = 10;
  return (
    <svg viewBox="0 0 50 65" width="50" height="65" fill="none" overflow="visible">
      <text x="2" y="7" fontSize="3.5" fill={color} fontFamily="monospace" fontWeight="bold">PIPELINE</text>
      {steps.map((step, i) => {
        const y = startY + i * (stepH + gap);
        return (
          <g key={step.label}>
            <rect x="5" y={y} width="40" height={stepH} rx="1" stroke={step.c} strokeWidth="0.8" />
            <text x="25" y={y + 6.5} textAnchor="middle" fontSize="4.5" fill={step.c} fontFamily="monospace">{step.label}</text>
            {i < steps.length - 1 && (
              <path d={wobblePath(25, y + stepH, 25, y + stepH + gap, seed + i)} stroke={step.c} strokeWidth="0.8" opacity={0.7} />
            )}
          </g>
        );
      })}
      <text x="2" y="62" fontSize="3" fill={FIG_TEXT_DIM} fontFamily="monospace">commonplace</text>
    </svg>
  );
}

// Per-egg deterministic seeds for schematic rendering
const SCHEMATIC_SEEDS: Record<string, number> = {
  architecture: 0x4a1bc2e0,
  'design-tokens': 0x7f3da140,
  'research-api': 0x2c8e5b60,
  'source-graph': 0xb12f7d80,
  'dot-grid': 0x5e9a3ca0,
  commonplace: 0x8d4e1fc0,
};

function renderSchematic(egg: EggDef): React.ReactNode {
  const seed = SCHEMATIC_SEEDS[egg.id] ?? 0x1234;
  switch (egg.schematicType) {
    case 'architecture': return <SchematicArchitecture color={egg.color} seed={seed} />;
    case 'design-tokens': return <SchematicDesignTokens color={egg.color} seed={seed} />;
    case 'research-api': return <SchematicResearchAPI color={egg.color} seed={seed} />;
    case 'source-graph': return <SchematicSourceGraph color={egg.color} seed={seed} />;
    case 'dot-grid': return <SchematicDotGrid color={egg.color} seed={seed} />;
    case 'commonplace': return <SchematicCommonPlace color={egg.color} seed={seed} />;
    default: return null;
  }
}

// ---------------------------------------------------------------------------
// ParticleBurst (framer-motion binary digit scatter)
// ---------------------------------------------------------------------------

interface Particle {
  id: number;
  x: number;
  y: number;
  char: '0' | '1';
  angle: number;
  distance: number;
  size: number;
  delay: number;
}

function ParticleBurst({
  active,
  color,
  onComplete,
}: {
  active: boolean;
  color: string;
  onComplete: () => void;
}) {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    if (!active) {
      setParticles([]);
      return;
    }
    const rng = mulberry32(Date.now() & 0xffff);
    const batch: Particle[] = [];
    for (let i = 0; i < 28; i++) {
      const angle = rng() * Math.PI * 2;
      batch.push({
        id: i,
        x: 60,
        y: 50,
        char: rng() < 0.5 ? '0' : '1',
        angle,
        distance: 30 + rng() * 50,
        size: 8 + rng() * 5,
        delay: rng() * 0.1,
      });
    }
    setParticles(batch);
    const timer = setTimeout(onComplete, 700);
    return () => clearTimeout(timer);
  }, [active, color, onComplete]);

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 5, overflow: 'visible' }}>
      <AnimatePresence>
        {particles.map((p) => (
          <motion.span
            key={p.id}
            initial={{ x: p.x, y: p.y, opacity: 0.9, scale: 1 }}
            animate={{
              x: p.x + Math.cos(p.angle) * p.distance,
              y: p.y + Math.sin(p.angle) * p.distance,
              opacity: 0,
              scale: 0.3,
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, delay: p.delay, ease: [0.22, 1, 0.36, 1] }}
            style={{
              position: 'absolute',
              fontFamily: 'var(--font-code, monospace)',
              fontSize: p.size,
              color,
              pointerEvents: 'none',
              textShadow: `0 0 6px ${color}60`,
            }}
          >
            {p.char}
          </motion.span>
        ))}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CommonPlacePipelineDetail
// Full 9-step pipeline diagram for the CommonPlace slide-out panel.
// Rendered at natural pixel size (no scale transform needed).
// ---------------------------------------------------------------------------

function CommonPlacePipelineDetail({ seed }: { seed: number }) {
  const GOLD   = '#C49A4A';
  const TEAL   = '#2D5F6B';
  const TERRA  = '#B45A2D';
  const PURPLE = '#6B4F7A';

  const BW = 300;
  const BX = 20;
  const BH = 18;

  const boxes: { label: string; color: string; y: number; h?: number; sub?: string }[] = [
    { label: 'User types in Compose',                        color: GOLD,   y: 14 },
    { label: 'POST /api/v1/notebook/compose/related/',       color: TEAL,   y: 44 },
    { label: 'compose_engine.py',                            color: TERRA,  y: 74, h: 30, sub: '1. TF-IDF  2. SBERT  3. KGE  4. NER  5. NLI' },
    { label: 'LiveResearchGraph.tsx',                        color: PURPLE, y: 116 },
    { label: 'Entity chips bar',                             color: TEAL,   y: 146 },
    { label: 'User saves Object',                            color: GOLD,   y: 176 },
    { label: 'POST /api/v1/notebook/capture/',               color: TEAL,   y: 206 },
    { label: 'post_save signal: 7-pass engine',              color: TERRA,  y: 236 },
    { label: 'New Edges + Nodes + RetroNote',                color: GOLD,   y: 266 },
  ];

  return (
    <svg viewBox="0 0 340 288" width="100%" style={{ display: 'block' }} fill="none">
      <text
        x={BX}
        y="9"
        fontSize="6.5"
        fill={GOLD}
        fontFamily="monospace"
        fontWeight="bold"
        letterSpacing="0.08em"
      >
        COMMONPLACE PIPELINE
      </text>
      {boxes.map((box, i) => {
        const h = box.h ?? BH;
        const midY = box.y + h / 2;
        const nextBox = boxes[i + 1];
        return (
          <g key={box.label}>
            {nextBox && (
              <path
                d={wobblePath(BX + BW / 2, box.y + h, BX + BW / 2, nextBox.y, seed + i * 7)}
                stroke={box.color}
                strokeWidth="0.7"
                opacity={0.55}
              />
            )}
            <rect x={BX} y={box.y} width={BW} height={h} rx="2" stroke={box.color} strokeWidth="0.75" />
            <text
              x={BX + BW / 2}
              y={box.sub ? midY - 4.5 : midY + 2.8}
              textAnchor="middle"
              fontSize="7.5"
              fill={box.color}
              fontFamily="monospace"
            >
              {box.label}
            </text>
            {box.sub && (
              <text
                x={BX + BW / 2}
                y={midY + 7.5}
                textAnchor="middle"
                fontSize="5.8"
                fill={FIG_TEXT_DIM}
                fontFamily="monospace"
              >
                {box.sub}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// SlideOutPanel
// ---------------------------------------------------------------------------

function SlideOutPanel({
  egg,
  onClose,
  isDark,
}: {
  egg: EggDef;
  onClose: () => void;
  isDark: boolean;
}) {
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const borderColor = isDark ? '#3A3632' : 'var(--color-border, #D4CCC4)';

  useEffect(() => {
    closeBtnRef.current?.focus();
  }, []);

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: 'min(420px, 90vw)',
        zIndex: 91,
        background: FIG_BLACK,
        borderLeft: `1px solid ${borderColor}`,
        overflow: 'hidden auto',
        boxShadow: isDark ? '0 0 60px rgba(0,0,0,0.5)' : '0 0 40px rgba(0,0,0,0.25)',
      }}
    >
      {/* Scanline texture */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 0,
          backgroundImage:
            'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.015) 2px, rgba(255,255,255,0.015) 4px)',
        }}
      />
      <div style={{ position: 'relative', zIndex: 1, padding: 20 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 10, color: FIG_TEXT_DIM, fontFamily: 'var(--font-code, monospace)', letterSpacing: '0.08em' }}>
              FIG. INDEX
            </div>
            <div style={{ fontSize: 16, fontWeight: 600, color: egg.color, fontFamily: 'var(--font-code, monospace)', letterSpacing: '0.04em' }}>
              {egg.label}
            </div>
          </div>
          <button
            ref={closeBtnRef}
            onClick={onClose}
            aria-label="Close schematic panel"
            style={{
              background: FIG_SURFACE,
              border: `1px solid ${FIG_BORDER}`,
              borderRadius: 4,
              padding: '4px 8px',
              cursor: 'pointer',
              color: FIG_TEXT_MUTED,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <CloseIcon size={12} color={FIG_TEXT_MUTED} />
          </button>
        </div>

        <div style={{ height: 1, background: FIG_BORDER_DIM, marginBottom: 20 }} />

        {/* Schematic: full pipeline for commonplace, enlarged mini for others */}
        <div
          style={{
            background: FIG_SURFACE,
            border: `1px solid ${FIG_BORDER_DIM}`,
            borderRadius: 4,
            padding: egg.id === 'commonplace' ? '14px 12px' : 16,
            marginBottom: 20,
            ...(egg.id !== 'commonplace' && {
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              minHeight: 160,
            }),
          }}
        >
          {egg.id === 'commonplace' ? (
            <CommonPlacePipelineDetail seed={SCHEMATIC_SEEDS.commonplace} />
          ) : (
            <div style={{ transform: 'scale(2.5)', transformOrigin: 'center', lineHeight: 0 }}>
              {renderSchematic(egg)}
            </div>
          )}
        </div>

        {/* Metadata grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20 }}>
          {[
            { key: 'ID', val: egg.id, valColor: FIG_TEXT_MUTED },
            { key: 'ACCESS', val: egg.hint, valColor: egg.color },
            { key: 'TYPE', val: egg.schematicType, valColor: FIG_TEXT_MUTED },
            { key: 'STATUS', val: 'ACTIVE', valColor: '#4A9A6A' },
          ].map((item) => (
            <div
              key={item.key}
              style={{
                background: FIG_SURFACE,
                border: `1px solid ${FIG_BORDER_DIM}`,
                borderRadius: 4,
                padding: '8px 12px',
              }}
            >
              <div style={{ fontSize: 9, color: FIG_TEXT_DIM, fontFamily: 'var(--font-code, monospace)', letterSpacing: '0.1em', marginBottom: 4 }}>
                {item.key}
              </div>
              <div style={{ fontSize: 11, color: item.valColor, fontFamily: 'var(--font-code, monospace)' }}>
                {item.val}
              </div>
            </div>
          ))}
        </div>

        {/* Description */}
        <div style={{ background: FIG_SURFACE, border: `1px solid ${FIG_BORDER_DIM}`, borderRadius: 4, padding: '10px 12px', marginBottom: 16 }}>
          <div style={{ fontSize: 9, color: FIG_TEXT_DIM, fontFamily: 'var(--font-code, monospace)', letterSpacing: '0.1em', marginBottom: 6 }}>
            DESCRIPTION
          </div>
          <div style={{ fontSize: 12, color: FIG_TEXT_MUTED, fontFamily: 'var(--font-code, monospace)', lineHeight: 1.6 }}>
            {egg.description}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            paddingTop: 12,
            borderTop: `1px solid ${FIG_BORDER_DIM}`,
            fontSize: 9,
            color: FIG_TEXT_DIM,
            fontFamily: 'var(--font-code, monospace)',
            display: 'flex',
            justifyContent: 'space-between',
          }}
        >
          <span>travisgilbert.me</span>
          <span>ESC to close</span>
        </div>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// EggTile
// ---------------------------------------------------------------------------

function EggTile({
  egg,
  reduced,
  onTileClick,
}: {
  egg: EggDef;
  reduced: boolean;
  onTileClick: (egg: EggDef) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [burstActive, setBurstActive] = useState(false);

  const handleClick = useCallback(() => {
    if (reduced) {
      onTileClick(egg);
      return;
    }
    setBurstActive(true);
  }, [egg, reduced, onTileClick]);

  const handleBurstComplete = useCallback(() => {
    setBurstActive(false);
    onTileClick(egg);
  }, [egg, onTileClick]);

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Open ${egg.label} schematic`}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        background: hovered ? '#2A2622' : FIG_BLACK,
        border: `1px solid ${hovered ? egg.color : FIG_BORDER_DIM}`,
        borderRadius: 4,
        padding: '8px 6px 6px',
        cursor: 'pointer',
        transition: 'background 250ms ease, border-color 250ms ease, box-shadow 250ms ease',
        boxShadow: hovered ? `0 0 12px ${egg.color}30, inset 0 0 20px ${egg.color}10` : 'none',
        overflow: 'visible',
        userSelect: 'none',
      }}
    >
      <div
        style={{
          opacity: hovered ? 1.0 : 0.65,
          transition: 'opacity 250ms ease, filter 250ms ease',
          filter: hovered ? `drop-shadow(0 0 4px ${egg.color}60)` : 'none',
          lineHeight: 0,
        }}
      >
        {renderSchematic(egg)}
      </div>
      <div
        style={{
          marginTop: 5,
          fontSize: 7,
          letterSpacing: '0.08em',
          color: hovered ? egg.color : FIG_TEXT_DIM,
          fontFamily: 'var(--font-code, monospace)',
          textAlign: 'center',
          transition: 'color 250ms ease',
          textShadow: hovered ? `0 0 8px ${egg.color}80` : 'none',
        }}
      >
        {egg.label}
      </div>
      {!reduced && (
        <ParticleBurst active={burstActive} color={egg.color} onComplete={handleBurstComplete} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// TerminalWindow
// ---------------------------------------------------------------------------

function TerminalWindow({
  eggs,
  reduced,
  onClose,
  onTileClick,
}: {
  eggs: EggDef[];
  reduced: boolean;
  onClose: () => void;
  onTileClick: (egg: EggDef) => void;
}) {
  const [cursorVisible, setCursorVisible] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => setCursorVisible((v) => !v), 530);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ width: '100%', background: FIG_BLACK, position: 'relative' }}>
      {/* Scanline texture */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 0,
          backgroundImage:
            'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.015) 2px, rgba(255,255,255,0.015) 4px)',
        }}
      />
      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* Title bar */}
        <div
          style={{
            background: FIG_SURFACE,
            padding: '7px 12px',
            display: 'flex',
            alignItems: 'center',
            borderBottom: `1px solid ${FIG_BORDER_DIM}`,
          }}
        >
          <div style={{ display: 'flex', gap: 5, marginRight: 12 }}>
            <div
              role="button"
              aria-label="Close FIG. INDEX"
              tabIndex={0}
              onClick={onClose}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClose(); } }}
              style={{ width: 8, height: 8, borderRadius: '50%', background: '#B45A2D', cursor: 'pointer' }}
            />
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#C49A4A' }} />
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#2D5F6B' }} />
          </div>
          <div style={{ flex: 1, textAlign: 'center', fontSize: 10, color: FIG_TEXT_MUTED, fontFamily: 'var(--font-code, monospace)', letterSpacing: '0.1em' }}>
            FIG. INDEX
          </div>
          <div style={{ fontSize: 9, color: FIG_TEXT_DIM, fontFamily: 'var(--font-code, monospace)' }}>v1.0</div>
        </div>

        {/* Prompt */}
        <div
          style={{
            padding: '7px 12px',
            fontSize: 11,
            fontFamily: 'var(--font-code, monospace)',
            borderBottom: `1px solid ${FIG_BORDER_DIM}`,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <span style={{ color: '#2D5F6B' }}>$</span>
          <span style={{ color: FIG_TEXT_MUTED }}> ls schematics/</span>
          <span
            style={{
              display: 'inline-block',
              width: 6,
              height: 11,
              background: '#B45A2D',
              opacity: cursorVisible ? 0.9 : 0,
              transition: 'opacity 0.1s',
              marginLeft: 2,
            }}
          />
        </div>

        {/* 3x2 schematic grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, padding: 12 }}>
          {eggs.map((egg) => (
            <EggTile key={egg.id} egg={egg} reduced={reduced} onTileClick={onTileClick} />
          ))}
        </div>

        {/* Status bar */}
        <div
          style={{
            padding: '5px 12px',
            background: FIG_SURFACE,
            borderTop: `1px solid ${FIG_BORDER_DIM}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 9,
            fontFamily: 'var(--font-code, monospace)',
          }}
        >
          <span style={{ color: FIG_TEXT_DIM }}>6 SCHEMATICS</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#2D5F6B' }} />
            <span style={{ color: FIG_TEXT_MUTED }}>ALL ACTIVE</span>
          </div>
          <span style={{ color: FIG_TEXT_DIM }}>travisgilbert.me</span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Seed glyph: 6-dot 3x2 formation + scatter dots
// ---------------------------------------------------------------------------

interface SeedDot {
  x: number;
  y: number;
  r: number;
  phaseOffset: number;
  isBinary: boolean;
  char: '0' | '1';
}

function generateSeedDots(): SeedDot[] {
  const rng = mulberry32(0x9a6f1e00);
  const dots: SeedDot[] = [];
  // 3x2 grid centered at (28, 31) with 10px spacing
  const startX = 18;
  const startY = 26;
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 3; col++) {
      dots.push({
        x: startX + col * 10,
        y: startY + row * 10,
        r: 1.8 + rng() * 0.8,
        phaseOffset: rng() * Math.PI * 2,
        isBinary: rng() < 0.4,
        char: rng() < 0.5 ? '0' : '1',
      });
    }
  }
  // Scatter dots
  const scatter = [
    { x: 8, y: 12 }, { x: 44, y: 8 }, { x: 12, y: 58 },
    { x: 46, y: 54 }, { x: 22, y: 15 }, { x: 38, y: 62 },
  ];
  for (const pos of scatter) {
    dots.push({
      x: pos.x, y: pos.y,
      r: 0.8 + rng() * 0.6,
      phaseOffset: rng() * Math.PI * 2,
      isBinary: rng() < 0.6,
      char: rng() < 0.5 ? '0' : '1',
    });
  }
  return dots;
}

const SEED_DOTS = generateSeedDots();

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

type Phase = 'seed' | 'connecting' | 'expanding' | 'open' | 'collapsing';

export default function FigIndexEasterEgg() {
  const [phase, setPhase] = useState<Phase>('seed');
  const phaseRef = useRef<Phase>('seed');

  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const reduced = usePrefersReducedMotion();

  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const breatheRef = useRef(0);
  const connectProgressRef = useRef(0);

  const [activeEgg, setActiveEgg] = useState<EggDef | null>(null);
  const prevFocusRef = useRef<HTMLElement | null>(null);

  const themeVersion = useThemeVersion();
  const canvasColorsRef = useRef({
    roughLightRgb: [154, 142, 130] as [number, number, number],
    invertedDotRgb: [240, 235, 228] as [number, number, number],
    tealRgb: [45, 95, 107] as [number, number, number],
    isDark: false,
    borderColor: '#D4CCC4',
    backdropColor: 'rgba(240, 235, 228, 0.5)',
  });

  // Resolve theme-dependent colors
  useEffect(() => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const c = canvasColorsRef.current;
    c.isDark = isDark;

    const rl = readCssVar('--color-rough-light');
    if (rl) c.roughLightRgb = hexToRgb(rl);

    const heroText = readCssVar('--color-hero-text');
    const heroGround = readCssVar('--color-hero-ground');
    c.invertedDotRgb = isDark
      ? (heroGround ? hexToRgb(heroGround) : [42, 40, 36])
      : (heroText ? hexToRgb(heroText) : [240, 235, 228]);

    const tl = readCssVar('--color-teal');
    if (tl) c.tealRgb = hexToRgb(tl);

    c.borderColor = isDark
      ? (readCssVar('--color-dark-border') || '#3A3632')
      : (readCssVar('--color-border') || '#D4CCC4');
    c.backdropColor = isDark
      ? 'rgba(26, 24, 22, 0.6)'
      : 'rgba(240, 235, 228, 0.5)';
  }, [themeVersion]);

  // Detect touch device
  useEffect(() => {
    setIsTouchDevice(window.matchMedia('(hover: none)').matches);
  }, []);

  // Canvas animation loop (runs when phase is seed or connecting)
  useEffect(() => {
    if (phase !== 'seed' && phase !== 'connecting') {
      cancelAnimationFrame(rafRef.current);
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio ?? 1;
    canvas.width = 56 * dpr;
    canvas.height = 72 * dpr;
    canvas.style.width = '56px';
    canvas.style.height = '72px';
    ctx.scale(dpr, dpr);

    function draw() {
      if (!ctx) return;
      ctx.clearRect(0, 0, 56, 72);

      const p = phaseRef.current;
      if (p !== 'seed' && p !== 'connecting') return;

      breatheRef.current += 0.03;

      if (p === 'connecting') {
        connectProgressRef.current = Math.min(1, connectProgressRef.current + 1 / 24);
        if (connectProgressRef.current >= 1) {
          phaseRef.current = 'expanding';
          setPhase('expanding');
          return;
        }
      }

      const wrapperRect = wrapperRef.current?.getBoundingClientRect();
      if (!wrapperRect) {
        rafRef.current = requestAnimationFrame(draw);
        return;
      }

      const { roughLightRgb, invertedDotRgb, tealRgb, isDark } = canvasColorsRef.current;
      const vh = window.innerHeight;
      const breathe = breatheRef.current;

      for (const dot of SEED_DOTS) {
        const screenY = wrapperRect.top + dot.y;
        const inv = getInversionFactor(screenY, vh, isDark);
        const r = Math.round(roughLightRgb[0] + (invertedDotRgb[0] - roughLightRgb[0]) * inv);
        const g = Math.round(roughLightRgb[1] + (invertedDotRgb[1] - roughLightRgb[1]) * inv);
        const b = Math.round(roughLightRgb[2] + (invertedDotRgb[2] - roughLightRgb[2]) * inv);
        const alpha = 0.35 + 0.15 * Math.sin(breathe + dot.phaseOffset) + inv * 0.15;

        if (dot.isBinary) {
          ctx.font = `${Math.round(dot.r * 4)}px var(--font-code, monospace)`;
          ctx.fillStyle = `rgba(${r},${g},${b},${alpha * 0.7})`;
          ctx.fillText(dot.char, dot.x - dot.r * 1.5, dot.y + dot.r * 1.5);
        } else {
          ctx.beginPath();
          ctx.arc(dot.x, dot.y, dot.r, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
          ctx.fill();
        }
      }

      // Draw connecting lines when in connecting phase
      if (p === 'connecting') {
        const cp = connectProgressRef.current;
        const coreDots = SEED_DOTS.slice(0, 6);
        const connections = [[0, 1], [1, 2], [3, 4], [4, 5], [0, 3], [1, 4], [2, 5]];
        for (let ci = 0; ci < connections.length; ci++) {
          const progress = Math.max(0, Math.min(1, cp * connections.length - ci));
          if (progress <= 0) continue;
          const [ai, bi] = connections[ci];
          const a = coreDots[ai];
          const bDot = coreDots[bi];
          const ex = a.x + (bDot.x - a.x) * progress;
          const ey = a.y + (bDot.y - a.y) * progress;
          const inv2 = getInversionFactor(wrapperRect.top + a.y, vh, isDark);
          const cr = Math.round(roughLightRgb[0] * 0.4 + tealRgb[0] * 0.6 + (invertedDotRgb[0] - roughLightRgb[0]) * inv2 * 0.4);
          const cg = Math.round(roughLightRgb[1] * 0.4 + tealRgb[1] * 0.6 + (invertedDotRgb[1] - roughLightRgb[1]) * inv2 * 0.4);
          const cb = Math.round(roughLightRgb[2] * 0.4 + tealRgb[2] * 0.6 + (invertedDotRgb[2] - roughLightRgb[2]) * inv2 * 0.4);
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(ex, ey);
          ctx.strokeStyle = `rgba(${cr},${cg},${cb},${0.55 * progress})`;
          ctx.lineWidth = 0.6;
          ctx.stroke();
        }
      }

      rafRef.current = requestAnimationFrame(draw);
    }

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [phase]);

  // Expanding -> open after CSS transition
  useEffect(() => {
    if (phase !== 'expanding') return;
    const t = setTimeout(() => {
      phaseRef.current = 'open';
      setPhase('open');
    }, 400);
    return () => clearTimeout(t);
  }, [phase]);

  // Collapsing -> seed after fade
  useEffect(() => {
    if (phase !== 'collapsing') return;
    const t = setTimeout(() => {
      phaseRef.current = 'seed';
      setPhase('seed');
    }, 300);
    return () => clearTimeout(t);
  }, [phase]);

  const handleClick = useCallback(() => {
    if (phaseRef.current !== 'seed') return;
    if (reduced || isTouchDevice) {
      phaseRef.current = 'open';
      setPhase('open');
    } else {
      connectProgressRef.current = 0;
      phaseRef.current = 'connecting';
      setPhase('connecting');
    }
  }, [reduced, isTouchDevice]);

  const handleClose = useCallback(() => {
    setActiveEgg(null);
    if (reduced || isTouchDevice) {
      phaseRef.current = 'seed';
      setPhase('seed');
    } else {
      phaseRef.current = 'collapsing';
      setPhase('collapsing');
    }
  }, [reduced, isTouchDevice]);

  const handlePanelClose = useCallback(() => {
    setActiveEgg(null);
    setTimeout(() => prevFocusRef.current?.focus(), 0);
  }, []);

  // Keyboard: Escape closes panel then terminal
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (activeEgg) {
        handlePanelClose();
        return;
      }
      if (phaseRef.current === 'open') {
        handleClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeEgg, handlePanelClose]);

  const handleTileClick = useCallback((egg: EggDef) => {
    prevFocusRef.current = document.activeElement as HTMLElement;
    setActiveEgg(egg);
  }, []);

  const isExpanded = phase === 'open' || phase === 'expanding' || phase === 'collapsing';
  const { isDark, borderColor, backdropColor } = canvasColorsRef.current;
  const boxShadow = isDark
    ? '0 12px 40px rgba(0,0,0,0.4)'
    : '0 12px 40px rgba(0,0,0,0.15)';

  return (
    <>
      <div
        ref={wrapperRef}
        className="fig-index-easter-egg"
        role="complementary"
        aria-label="FIG. INDEX schematic board"
        style={{
          position: 'fixed',
          left: 16,
          ...(isTouchDevice ? { bottom: 16 } : { bottom: 'calc(25vh - 72px)' }),
          zIndex: 40,
          width: isExpanded ? 420 : 56,
          transition: reduced ? 'none' : 'width 0.35s ease',
        }}
      >
        {/* Seed glyph: canvas */}
        {!isExpanded && (
          <canvas
            ref={canvasRef}
            onClick={handleClick}
            aria-label="Open FIG. INDEX schematic board"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleClick();
              }
            }}
            style={{ cursor: 'pointer', display: 'block', borderRadius: 4 }}
          />
        )}

        {/* Terminal window */}
        {isExpanded && (
          <div
            style={{
              border: `1px solid ${borderColor}`,
              borderRadius: 6,
              boxShadow,
              overflow: 'hidden',
              opacity: phase === 'collapsing' ? 0 : 1,
              transition: reduced ? 'none' : 'opacity 0.25s ease',
            }}
          >
            <TerminalWindow
              eggs={EGGS}
              reduced={reduced}
              onClose={handleClose}
              onTileClick={handleTileClick}
            />
          </div>
        )}
      </div>

      {/* Slide-out panel + backdrop */}
      <AnimatePresence>
        {activeEgg && (
          <>
            <motion.div
              key="fig-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={handlePanelClose}
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 90,
                backdropFilter: 'blur(6px)',
                background: backdropColor,
              }}
            />
            <SlideOutPanel
              key="fig-panel"
              egg={activeEgg}
              onClose={handlePanelClose}
              isDark={isDark}
            />
          </>
        )}
      </AnimatePresence>
    </>
  );
}
