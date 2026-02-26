'use client';

import { useRef, useEffect, type ReactNode } from 'react';
import rough from 'roughjs';
import { useThemeVersion, readCssVar, TINT_CSS_VAR, TINT_CSS_REF } from '@/hooks/useThemeColor';

type CalloutSide = 'left' | 'right';
type CalloutTint = 'terracotta' | 'teal' | 'gold' | 'neutral';

interface RoughPivotCalloutProps {
  children: ReactNode;
  /** Which side of the card the callout branches from */
  side?: CalloutSide;
  /** Color tint matching the parent card's brand color */
  tint?: CalloutTint;
  /** Vertical offset from the top of the positioned parent (px) */
  offsetY?: number;
  /** Total length of the leader line: horizontal + diagonal combined (px) */
  totalLength?: number;
  /** rough.js seed for deterministic hand-drawn look */
  seed?: number;
  /** Whether the diagonal pivots downward (true) or upward (false) */
  pivotDown?: boolean;
}

/**
 * Architectural leader-line callout with a 45° pivot.
 *
 * Used exclusively on the featured/hero content card to create visual
 * hierarchy. The line extends horizontally from the card edge, then
 * pivots 45° downward (or upward). Annotation text begins immediately
 * after the pivot point.
 *
 * Anatomy:
 *   ──────╲ Text starts here,
 *   horiz  ╲ flowing alongside
 *   (~1/3)  ╲ the diagonal
 *
 * The line is drawn with rough.js for the hand-drawn aesthetic.
 * On mobile, collapses to an inline annotation without the line.
 */
export default function RoughPivotCallout({
  children,
  side = 'right',
  tint = 'terracotta',
  offsetY = 16,
  totalLength = 187,
  seed,
  pivotDown = true,
}: RoughPivotCalloutProps) {
  const themeVersion = useThemeVersion();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // CSS variable reference for inline text styles (auto-updates with theme)
  const textColor = TINT_CSS_REF[tint] ?? 'var(--color-rough)';

  // Geometry: horizontal run is ~1/3, short diagonal stub ~15px
  const horizLength = Math.round(totalLength * 0.3);
  const stubLength = 18; // short diagonal stub before text begins
  const stubX = Math.round(stubLength * Math.cos(Math.PI / 4));
  const stubY = Math.round(stubLength * Math.sin(Math.PI / 4));

  // Canvas only needs to hold the horizontal + short stub
  const canvasW = horizLength + stubX + 4;
  const canvasH = stubY + 12;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Resolve actual hex for canvas drawing (theme-aware)
    const canvasColor =
      (readCssVar(TINT_CSS_VAR[tint] ?? '') || '#3A3632');

    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvasW * dpr;
    canvas.height = canvasH * dpr;
    canvas.style.width = `${canvasW}px`;
    canvas.style.height = `${canvasH}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, canvasW, canvasH);

    const rc = rough.canvas(canvas);

    const startY = pivotDown ? 6 : canvasH - 6;
    const endY = pivotDown ? 6 + stubY : canvasH - 6 - stubY;

    if (side === 'right') {
      // Horizontal segment: left to pivot point
      rc.line(0, startY, horizLength, startY, {
        roughness: 1.4,
        strokeWidth: 1.2,
        stroke: canvasColor,
        bowing: 0.3,
        seed,
      });
      // Short diagonal stub into the text
      rc.line(horizLength, startY, horizLength + stubX, endY, {
        roughness: 1.4,
        strokeWidth: 1.2,
        stroke: canvasColor,
        bowing: 0.3,
        seed: seed ? seed + 1 : undefined,
      });
    } else {
      // Mirror for left-side
      const rightEdge = canvasW - 2;
      rc.line(rightEdge, startY, rightEdge - horizLength, startY, {
        roughness: 1.4,
        strokeWidth: 1.2,
        stroke: canvasColor,
        bowing: 0.3,
        seed,
      });
      rc.line(rightEdge - horizLength, startY, rightEdge - horizLength - stubX, endY, {
        roughness: 1.4,
        strokeWidth: 1.2,
        stroke: canvasColor,
        bowing: 0.3,
        seed: seed ? seed + 1 : undefined,
      });
    }
  }, [canvasW, canvasH, horizLength, stubX, stubY, tint, seed, side, pivotDown, themeVersion]);

  // Desktop positioning: absolute in the margin
  const sideClasses =
    side === 'right'
      ? 'lg:left-full lg:ml-1'
      : 'lg:right-full lg:mr-1';

  // Text indentation from the pivot point
  const textIndent = horizLength + stubX - 4;

  return (
    <>
      {/* Desktop: absolute-positioned in the margin with pivot line */}
      <div
        className={`hidden lg:block absolute ${sideClasses} z-20`}
        style={{
          top: `${offsetY}px`,
          width: 450,
          maxWidth: 'calc((100vw - 960px) / 2 - 1rem)',
        }}
      >
        {/* Canvas draws horizontal + short diagonal stub */}
        <canvas
          ref={canvasRef}
          aria-hidden="true"
          className="block"
        />
        {/* Annotation text: starts right after the pivot point */}
        <div
          className="max-w-[450px] text-[17px] leading-snug select-none"
          style={{
            fontFamily: 'var(--font-annotation)',
            color: textColor,
            marginLeft: side === 'right' ? `${textIndent}px` : undefined,
            marginRight: side === 'left' ? `${textIndent}px` : undefined,
            textAlign: side === 'left' ? 'right' : 'left',
            marginTop: '-4px',
          }}
        >
          {children}
        </div>
      </div>

      {/* Mobile: inline annotation (no line) */}
      <div
        className="lg:hidden mt-2 text-[15px] leading-snug select-none"
        style={{
          fontFamily: 'var(--font-annotation)',
          color: textColor,
        }}
      >
        {children}
      </div>
    </>
  );
}
