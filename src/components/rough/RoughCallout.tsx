'use client';

import { useRef, useEffect, type ReactNode } from 'react';
import rough from 'roughjs';
import { useThemeVersion, readCssVar, TINT_CSS_VAR, TINT_CSS_REF } from '@/hooks/useThemeColor';

type CalloutSide = 'left' | 'right';
type CalloutTint = 'terracotta' | 'teal' | 'gold' | 'neutral';

interface RoughCalloutProps {
  children: ReactNode;
  /** Which side of the card the callout branches from */
  side?: CalloutSide;
  /** Color tint matching the parent card's brand color */
  tint?: CalloutTint;
  /** Vertical offset from the top of the positioned parent (px) */
  offsetY?: number;
  /** Length of the connecting line in px (desktop) */
  lineLength?: number;
  /** rough.js seed for deterministic hand-drawn look */
  seed?: number;
}

/**
 * Editor's-note callout that branches from a card border.
 *
 * Must be placed inside a `relative` parent (typically the card wrapper).
 * On desktop (lg+), it floats in the margin with a rough.js connecting line.
 * On mobile, it collapses to an inline annotation (no line).
 */
export default function RoughCallout({
  children,
  side = 'right',
  tint = 'neutral',
  offsetY = 16,
  lineLength = 48,
  seed,
}: RoughCalloutProps) {
  const themeVersion = useThemeVersion();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // CSS variable reference for inline text styles (auto-updates with theme)
  const textColor = TINT_CSS_REF[tint] ?? 'var(--color-rough)';

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Resolve actual hex for canvas drawing (theme-aware)
    const canvasColor =
      (readCssVar(TINT_CSS_VAR[tint] ?? '') || '#3A3632');

    const dpr = window.devicePixelRatio || 1;
    // Canvas draws a short horizontal line
    const w = lineLength;
    const h = 12; // enough vertical space for roughness wobble

    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    const rc = rough.canvas(canvas);
    const midY = h / 2;

    // Draw the connecting line from card edge to text
    rc.line(0, midY, w, midY, {
      roughness: 1.5,
      strokeWidth: 0.8,
      stroke: canvasColor,
      bowing: 0.5,
      seed,
    });
  }, [lineLength, tint, seed, themeVersion]);

  // Positioning for desktop: float outside the card in the margin
  const sideClasses =
    side === 'right'
      ? 'lg:left-full lg:ml-2'
      : 'lg:right-full lg:mr-2';

  return (
    <>
      {/* Desktop: absolute-positioned in the margin */}
      <div
        className={`hidden lg:flex items-start absolute ${sideClasses} z-20`}
        style={{
          top: `${offsetY}px`,
          width: 450,
          maxWidth: 'calc((100vw - 896px) / 2 - 1.5rem)',
        }}
      >
        {side === 'right' ? (
          <>
            <canvas
              ref={canvasRef}
              aria-hidden="true"
              className="block flex-shrink-0 mt-2"
            />
            <div
              className="max-w-[450px] pl-1 text-[15px] leading-snug select-none"
              style={{
                fontFamily: 'var(--font-annotation)',
                color: textColor,
              }}
            >
              {children}
            </div>
          </>
        ) : (
          <>
            <div
              className="max-w-[450px] pr-1 text-right text-[15px] leading-snug select-none"
              style={{
                fontFamily: 'var(--font-annotation)',
                color: textColor,
              }}
            >
              {children}
            </div>
            <canvas
              ref={canvasRef}
              aria-hidden="true"
              className="block flex-shrink-0 mt-2"
            />
          </>
        )}
      </div>

      {/* Mobile: inline annotation (no line) */}
      <div
        className="lg:hidden mt-2 text-[14px] leading-snug select-none"
        style={{
          fontFamily: 'var(--font-handwritten)',
          color: textColor,
        }}
      >
        {children}
      </div>
    </>
  );
}
