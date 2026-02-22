'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import rough from 'roughjs';
import RoughBox from '@/components/rough/RoughBox';
import { useConnectionHighlight } from '@/components/ConnectionContext';
import type { Connection } from '@/lib/connectionEngine';
import { WEIGHT_STROKE } from '@/lib/connectionEngine';

interface ConnectionMapProps {
  essayTitle: string;
  connections: Connection[];
}

// Seeded PRNG (same algorithm as PatternImage)
function createPRNG(seed: string) {
  let s = 0;
  for (let i = 0; i < seed.length; i++) {
    s = ((s << 5) - s + seed.charCodeAt(i)) | 0;
  }
  return () => {
    s = (s * 16807) % 2147483647;
    return (s & 0x7fffffff) / 0x7fffffff;
  };
}

// Layout computation

interface ItemPosition {
  x: number;
  y: number;
  connection: Connection;
}

/**
 * Place connected items in a freeform scatter to the right of the essay anchor.
 * Items cluster loosely by type (essays upper, field notes middle, shelf lower).
 * Minimum distance constraint prevents overlap.
 */
function computeScatterPositions(
  connections: Connection[],
  containerW: number,
  containerH: number,
): ItemPosition[] {
  if (connections.length === 0) return [];

  const rand = createPRNG(connections.map((c) => c.id).join(','));
  const positions: ItemPosition[] = [];

  // Vertical bands by type
  const typeBand: Record<string, [number, number]> = {
    essay: [0.1, 0.35],
    'field-note': [0.35, 0.65],
    shelf: [0.65, 0.9],
  };

  // Items scatter in the right 70% of the container
  const minX = containerW * 0.35;
  const maxX = containerW * 0.85;
  const minDist = 80;

  for (const connection of connections) {
    const [bandMin, bandMax] = typeBand[connection.type] || [0.2, 0.8];
    let x: number, y: number;
    let attempts = 0;

    do {
      x = minX + rand() * (maxX - minX);
      y = containerH * (bandMin + rand() * (bandMax - bandMin));
      attempts++;
    } while (
      attempts < 50 &&
      positions.some(
        (p) => Math.sqrt((p.x - x) ** 2 + (p.y - y) ** 2) < minDist
      )
    );

    positions.push({ x, y, connection });
  }

  return positions;
}

function hashSeed(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

// Component

const MAP_HEIGHT = 400;
const ANCHOR_X = 60;
const WEIGHT_ORDER: Record<string, number> = { heavy: 0, medium: 1, light: 2 };
const RESIZE_DEBOUNCE_MS = 150;

export default function ConnectionMap({
  essayTitle,
  connections,
}: ConnectionMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [positions, setPositions] = useState<ItemPosition[]>([]);
  const [containerW, setContainerW] = useState(600);
  const [drawn, setDrawn] = useState(false);
  const [skipAnimation, setSkipAnimation] = useState(false);
  const { highlightedId, toggleHighlight, setHighlightedId } =
    useConnectionHighlight();

  // Measure container and compute positions (debounced for resize)
  const layoutTimerRef = useRef<ReturnType<typeof setTimeout>>(null);

  const layoutImmediate = useCallback(() => {
    if (!containerRef.current) return;
    const w = containerRef.current.clientWidth;
    setContainerW(w);
    setPositions(computeScatterPositions(connections, w, MAP_HEIGHT));
  }, [connections]);

  const layoutDebounced = useCallback(() => {
    if (layoutTimerRef.current) clearTimeout(layoutTimerRef.current);
    layoutTimerRef.current = setTimeout(layoutImmediate, RESIZE_DEBOUNCE_MS);
  }, [layoutImmediate]);

  useEffect(() => {
    layoutImmediate();
    const observer = new ResizeObserver(layoutDebounced);
    if (containerRef.current) observer.observe(containerRef.current);
    return () => {
      observer.disconnect();
      if (layoutTimerRef.current) clearTimeout(layoutTimerRef.current);
    };
  }, [layoutImmediate, layoutDebounced]);

  // Draw rough.js curves on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || positions.length === 0) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = containerW * dpr;
    canvas.height = MAP_HEIGHT * dpr;
    canvas.style.width = `${containerW}px`;
    canvas.style.height = `${MAP_HEIGHT}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, containerW, MAP_HEIGHT);

    const rc = rough.canvas(canvas);
    const anchorY = MAP_HEIGHT / 2;

    for (const pos of positions) {
      const isHighlighted = highlightedId === pos.connection.id;
      const isDimmed = highlightedId !== null && !isHighlighted;

      const strokeWidth =
        WEIGHT_STROKE[pos.connection.weight] + (isHighlighted ? 0.5 : 0);
      const opacity = isDimmed ? 0.15 : 1;

      ctx.globalAlpha = opacity;

      // Bezier control points: curve arcs organically
      const midX = (ANCHOR_X + pos.x) / 2;
      const cpOffsetY = (pos.y - anchorY) * 0.4;

      rc.curve(
        [
          [ANCHOR_X, anchorY],
          [midX, anchorY + cpOffsetY * 0.5],
          [midX + 20, pos.y - cpOffsetY * 0.3],
          [pos.x, pos.y],
        ],
        {
          roughness: 1.2,
          strokeWidth,
          stroke: pos.connection.color,
          bowing: 0.5,
          seed: hashSeed(pos.connection.id),
        },
      );
    }

    ctx.globalAlpha = 1;
  }, [positions, containerW, highlightedId]);

  // IntersectionObserver: trigger draw-on animation
  useEffect(() => {
    const el = containerRef.current;
    if (!el || drawn) return;

    const prefersReduced = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    if (prefersReduced) {
      setSkipAnimation(true);
      setDrawn(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setDrawn(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [drawn]);

  // Escape key deselects
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && highlightedId) {
        setHighlightedId(null);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [highlightedId, setHighlightedId]);

  if (connections.length === 0) return null;

  return (
    <section id="connection-map" className="py-6">
      <h2 className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-light mb-1">
        Connections
      </h2>
      <p
        className="text-xs text-ink-secondary mb-3 max-w-prose"
        style={{ fontFamily: 'var(--font-annotation)' }}
      >
        {connections.length} connected{' '}
        {connections.length === 1 ? 'piece' : 'pieces'}
      </p>
      <RoughBox tint="neutral" elevated={false} padding={0}>
        <div
          ref={containerRef}
          className="relative"
          style={{ height: MAP_HEIGHT, overflow: 'hidden' }}
          onClick={(e) => {
            if (
              e.target === e.currentTarget ||
              e.target === canvasRef.current
            ) {
              setHighlightedId(null);
            }
          }}
        >
          {/* Rough.js curve canvas */}
          <canvas
            ref={canvasRef}
            className="absolute inset-0 pointer-events-none"
            style={{
              opacity: drawn ? 1 : 0,
              transition: skipAnimation
                ? 'none'
                : 'opacity 600ms ease-out',
            }}
            aria-hidden="true"
          />

          {/* Essay anchor (left center) */}
          <div
            className="absolute flex items-center"
            style={{
              left: ANCHOR_X - 40,
              top: MAP_HEIGHT / 2 - 20,
              width: 80,
            }}
          >
            <div
              className="text-center w-full text-[11px] font-title font-bold leading-tight"
              style={{ color: 'var(--color-ink)' }}
            >
              {essayTitle.length > 30
                ? essayTitle.slice(0, 28) + '...'
                : essayTitle}
            </div>
          </div>

          {/* Scatter items */}
          {positions.map((pos, i) => {
            const isHighlighted = highlightedId === pos.connection.id;
            const isDimmed =
              highlightedId !== null && !isHighlighted;

            const staggerDelay =
              (WEIGHT_ORDER[pos.connection.weight] ?? 2) * 200 + i * 100;

            return (
              <button
                key={pos.connection.id}
                className="absolute text-left transition-all duration-300 rounded px-2 py-1.5 border-l-2 cursor-pointer bg-transparent"
                style={{
                  left: pos.x,
                  top: pos.y - 16,
                  maxWidth: 180,
                  borderLeftColor: pos.connection.color,
                  opacity: !drawn ? 0 : isDimmed ? 0.2 : 1,
                  transform: !drawn
                    ? 'translateY(8px)'
                    : 'translateY(0)',
                  transition: skipAnimation
                    ? 'opacity 300ms ease, transform 0ms'
                    : `opacity 400ms ease-out ${staggerDelay}ms, transform 400ms ease-out ${staggerDelay}ms`,
                  boxShadow: isHighlighted
                    ? `0 2px 8px ${pos.connection.color}30`
                    : 'none',
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleHighlight(pos.connection.id);
                }}
                aria-label={`${pos.connection.title} (${pos.connection.type})`}
              >
                <span
                  className="block font-mono uppercase tracking-[0.08em]"
                  style={{
                    fontSize: 9,
                    color: pos.connection.color,
                  }}
                >
                  {pos.connection.type === 'field-note'
                    ? 'field note'
                    : pos.connection.type}
                </span>
                <span
                  className="block font-title text-xs font-semibold leading-tight mt-0.5"
                  style={{ color: 'var(--color-ink)' }}
                >
                  {pos.connection.title}
                </span>
              </button>
            );
          })}
        </div>
      </RoughBox>
    </section>
  );
}
