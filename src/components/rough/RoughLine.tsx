'use client';

import { useRef, useEffect } from 'react';
import rough from 'roughjs';
import { useThemeVersion, readCssVar } from '@/hooks/useThemeColor';

interface RoughLineProps {
  roughness?: number;
  strokeWidth?: number;
  stroke?: string;
  seed?: number;
  className?: string;
  /** Architectural label centered on the line */
  label?: string;
  /** Color for the label text (CSS value) */
  labelColor?: string;
}

/**
 * Draw a single rough.js horizontal line onto the given canvas,
 * fitting the width of the wrapper element.
 */
function drawSegment(
  canvas: HTMLCanvasElement,
  wrapper: HTMLElement,
  options: { roughness: number; strokeWidth: number; stroke: string; seed?: number },
) {
  const rect = wrapper.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const w = rect.width;
  const h = 8;

  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);

  const rc = rough.canvas(canvas);
  rc.line(0, h / 2, w, h / 2, {
    roughness: options.roughness,
    strokeWidth: options.strokeWidth,
    stroke: options.stroke,
    bowing: 1,
    seed: options.seed,
  });
}

export default function RoughLine({
  roughness = 1,
  strokeWidth = 1,
  stroke,
  seed,
  className,
  label,
  labelColor,
}: RoughLineProps) {
  const themeVersion = useThemeVersion();

  // Refs for the unlabeled (single line) variant
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Refs for the labeled (two segment) variant
  const leftCanvasRef = useRef<HTMLCanvasElement>(null);
  const leftWrapperRef = useRef<HTMLDivElement>(null);
  const rightCanvasRef = useRef<HTMLCanvasElement>(null);
  const rightWrapperRef = useRef<HTMLDivElement>(null);

  // Effect: labeled variant
  useEffect(() => {
    if (!label) return;

    // Resolve stroke from CSS (theme-aware)
    const currentStroke = stroke ?? (readCssVar('--color-rough') || '#3A3632');
    const drawOpts = { roughness, strokeWidth, stroke: currentStroke, seed };

    function draw() {
      if (leftCanvasRef.current && leftWrapperRef.current) {
        drawSegment(leftCanvasRef.current, leftWrapperRef.current, drawOpts);
      }
      if (rightCanvasRef.current && rightWrapperRef.current) {
        drawSegment(rightCanvasRef.current, rightWrapperRef.current, {
          ...drawOpts,
          seed: drawOpts.seed != null ? drawOpts.seed + 7 : undefined,
        });
      }
    }

    draw();

    const observer = new ResizeObserver(() => draw());
    if (leftWrapperRef.current) observer.observe(leftWrapperRef.current);
    if (rightWrapperRef.current) observer.observe(rightWrapperRef.current);

    return () => observer.disconnect();
  }, [label, roughness, strokeWidth, stroke, seed, themeVersion]);

  // Effect: unlabeled variant
  useEffect(() => {
    if (label) return;

    const currentStroke = stroke ?? (readCssVar('--color-rough') || '#3A3632');
    const drawOpts = { roughness, strokeWidth, stroke: currentStroke, seed };

    function draw() {
      if (canvasRef.current && wrapperRef.current) {
        drawSegment(canvasRef.current, wrapperRef.current, drawOpts);
      }
    }

    draw();

    const observer = new ResizeObserver(() => draw());
    if (wrapperRef.current) observer.observe(wrapperRef.current);

    return () => observer.disconnect();
  }, [label, roughness, strokeWidth, stroke, seed, themeVersion]);

  if (label) {
    return (
      <div className={`w-full my-8 ${className || ''}`}>
        <div className="relative flex items-center">
          {/* Left line segment: rough.js canvas */}
          <div ref={leftWrapperRef} className="flex-1">
            <canvas ref={leftCanvasRef} aria-hidden="true" className="block" />
          </div>
          {/* Center label */}
          <span
            className="px-3 font-mono text-[10px] uppercase tracking-[0.12em] whitespace-nowrap select-none"
            style={{ color: labelColor || 'var(--color-ink-light)' }}
          >
            {label}
          </span>
          {/* Right line segment: rough.js canvas (matching left) */}
          <div ref={rightWrapperRef} className="flex-1">
            <canvas ref={rightCanvasRef} aria-hidden="true" className="block" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={wrapperRef} className={`w-full my-4 ${className || ''}`}>
      <canvas ref={canvasRef} aria-hidden="true" className="block" />
    </div>
  );
}
