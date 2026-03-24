'use client';

import { useRef, useEffect, type ReactNode } from 'react';
import rough from 'roughjs';
import { useThemeVersion, readCssVar, TINT_CSS_VAR } from '@/hooks/useThemeColor';

type CardTint = 'terracotta' | 'teal' | 'gold' | 'neutral';
type RoughBoxVariant = 'light' | 'dark';

const tintClass: Record<CardTint, string> = {
  terracotta: 'surface-tint-terracotta',
  teal: 'surface-tint-teal',
  gold: 'surface-tint-gold',
  neutral: 'surface-tint-neutral',
};

const DARK_TINT_STROKES: Record<CardTint, string> = {
  terracotta: 'rgba(180, 90, 45, 0.4)',
  teal: 'rgba(45, 95, 107, 0.4)',
  gold: 'rgba(196, 154, 74, 0.4)',
  neutral: 'rgba(74, 74, 78, 0.35)',
};

interface RoughBoxProps {
  children: ReactNode;
  padding?: number;
  roughness?: number;
  strokeWidth?: number;
  stroke?: string;
  seed?: number;
  /** Show warm shadow (default: true) */
  elevated?: boolean;
  /** Enable hover lift animation (default: false, opt-in for linked cards) */
  hover?: boolean;
  /** Transparent brand-color wash (default: 'neutral') */
  tint?: CardTint;
  /** Light (default, main site) or dark (CommonPlace dark chrome) */
  variant?: RoughBoxVariant;
}

export default function RoughBox({
  children,
  padding = 16,
  roughness = 1.2,
  strokeWidth = 1,
  stroke,
  seed,
  elevated = true,
  hover = false,
  tint = 'neutral',
  variant = 'light',
}: RoughBoxProps) {
  const themeVersion = useThemeVersion();
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDark = variant === 'dark';

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    // Resolve stroke: explicit prop > dark variant map > CSS var > fallback
    let currentStroke: string;
    if (stroke) {
      currentStroke = stroke;
    } else if (isDark) {
      currentStroke = DARK_TINT_STROKES[tint] ?? 'rgba(74, 74, 78, 0.35)';
    } else {
      currentStroke = readCssVar(TINT_CSS_VAR[tint] ?? '') || '#3A3632';
    }

    function draw() {
      const rect = container!.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const w = rect.width;
      const h = rect.height;

      canvas!.width = w * dpr;
      canvas!.height = h * dpr;
      canvas!.style.width = `${w}px`;
      canvas!.style.height = `${h}px`;

      const ctx = canvas!.getContext('2d');
      if (!ctx) return;

      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, w, h);

      const rc = rough.canvas(canvas!);
      rc.rectangle(2, 2, w - 4, h - 4, {
        roughness,
        strokeWidth,
        stroke: currentStroke,
        bowing: 1,
        seed,
      });
    }

    draw();

    const observer = new ResizeObserver(() => draw());
    observer.observe(container);

    return () => observer.disconnect();
  }, [roughness, strokeWidth, stroke, tint, seed, themeVersion, isDark]);

  // Build className string from props
  // Dark variant skips tint class (no bg-warm fill) and uses dark shadow
  const classes = [
    'relative',
    'rough-box-pad',
    isDark ? '' : (elevated ? 'surface-elevated' : ''),
    isDark ? '' : (hover ? 'surface-hover' : ''),
    isDark ? '' : tintClass[tint],
  ]
    .filter(Boolean)
    .join(' ');

  const darkShadow = isDark && elevated
    ? 'var(--cp-shadow-card, 0 2px 8px rgba(0,0,0,0.15))'
    : undefined;

  return (
    <div
      ref={containerRef}
      className={classes}
      style={{
        padding: `${padding}px`,
        boxShadow: darkShadow,
        background: isDark ? 'transparent' : undefined,
      }}
    >
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
