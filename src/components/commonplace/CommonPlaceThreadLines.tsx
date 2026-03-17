'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import rough from 'roughjs';

/**
 * Edge data from CommonPlace clusters or feed responses.
 */
export interface CommonPlaceEdge {
  id: number;
  from_slug: string;
  to_slug: string;
  edge_type: string;
  strength: number;
}

interface CommonPlaceThreadLinesProps {
  edges: CommonPlaceEdge[];
  /** CSS selector for the container holding cards with data-slug attributes */
  containerSelector?: string;
}

/** Debounce delay for ResizeObserver recalculation */
const RESIZE_DEBOUNCE_MS = 250;

/** Color mapping by edge_type */
const EDGE_TYPE_COLOR: Record<string, string> = {
  mentions: '#2D5F6B',
  shared_entity: '#2D5F6B',
  supports: '#5A7A4A',
  entailment: '#5A7A4A',
  contradicts: '#B8623D',
  similarity: '#8B6FA0',
  semantic: '#8B6FA0',
  causal: '#C49A4A',
  manual: 'rgba(244,243,240,0.25)',
};

const FALLBACK_COLOR = 'rgba(244,243,240,0.18)';

/** Map strength (0 to 1) to strokeWidth (0.4 to 2.0) */
function strengthToStroke(strength: number): number {
  const clamped = Math.max(0, Math.min(1, strength));
  return 0.4 + clamped * 1.6;
}

/** Deterministic seed from a string (djb2 variant) */
function hashSeed(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

interface ArcEndpoint {
  x: number;
  y: number;
}

interface ResolvedArc {
  from: ArcEndpoint;
  to: ArcEndpoint;
  edge: CommonPlaceEdge;
}

export default function CommonPlaceThreadLines({
  edges,
  containerSelector,
}: CommonPlaceThreadLinesProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [arcs, setArcs] = useState<ResolvedArc[]>([]);
  const [hoveredSlug, setHoveredSlug] = useState<string | null>(null);
  const [drawn, setDrawn] = useState(false);
  const resizeTimerRef = useRef<ReturnType<typeof setTimeout>>(null);

  // Measure card positions and resolve arcs
  const measureArcs = useCallback(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const container = containerSelector
      ? wrapper.closest(containerSelector) ?? wrapper.parentElement
      : wrapper.parentElement;
    if (!container) return;

    const containerRect = container.getBoundingClientRect();
    const resolved: ResolvedArc[] = [];

    for (const edge of edges) {
      const fromEl = container.querySelector(
        `[data-slug="${edge.from_slug}"]`,
      );
      const toEl = container.querySelector(`[data-slug="${edge.to_slug}"]`);
      if (!fromEl || !toEl) continue;

      const fromRect = fromEl.getBoundingClientRect();
      const toRect = toEl.getBoundingClientRect();

      resolved.push({
        from: {
          x: fromRect.left + fromRect.width / 2 - containerRect.left,
          y: fromRect.top + fromRect.height / 2 - containerRect.top,
        },
        to: {
          x: toRect.left + toRect.width / 2 - containerRect.left,
          y: toRect.top + toRect.height / 2 - containerRect.top,
        },
        edge,
      });
    }

    setArcs(resolved);
  }, [edges, containerSelector]);

  const measureDebounced = useCallback(() => {
    if (resizeTimerRef.current) clearTimeout(resizeTimerRef.current);
    resizeTimerRef.current = setTimeout(measureArcs, RESIZE_DEBOUNCE_MS);
  }, [measureArcs]);

  // Initial measurement + resize observer
  useEffect(() => {
    // Wait for layout to settle
    const timer = setTimeout(measureArcs, 100);

    const observer = new ResizeObserver(measureDebounced);
    const wrapper = wrapperRef.current;
    if (wrapper?.parentElement) {
      observer.observe(wrapper.parentElement);
    }

    return () => {
      clearTimeout(timer);
      observer.disconnect();
      if (resizeTimerRef.current) clearTimeout(resizeTimerRef.current);
    };
  }, [measureArcs, measureDebounced]);

  // Draw arcs on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper || arcs.length === 0) return;

    const parent = wrapper.parentElement;
    if (!parent) return;

    const dpr = window.devicePixelRatio || 1;
    const rawW = parent.clientWidth;
    const rawH = parent.clientHeight;

    // Dimension guards: min 1px, max 8192px
    if (rawW < 1 || rawH < 1) return;
    const w = Math.min(rawW, 8192);
    const h = Math.min(rawH, 8192);

    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    const rc = rough.canvas(canvas);

    for (const arc of arcs) {
      const isConnected =
        hoveredSlug === arc.edge.from_slug ||
        hoveredSlug === arc.edge.to_slug;
      const isDimmed = hoveredSlug !== null && !isConnected;

      const opacity = isDimmed ? 0.12 : hoveredSlug !== null ? 0.6 : 0.25;

      ctx.globalAlpha = opacity;

      // Bezier control points: arc curves outward
      const midX = (arc.from.x + arc.to.x) / 2;
      const midY = (arc.from.y + arc.to.y) / 2;
      const dx = arc.to.x - arc.from.x;
      const dy = arc.to.y - arc.from.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Avoid division by zero for overlapping cards
      if (dist < 1) continue;

      // Perpendicular offset for the arc (proportional to distance)
      const perpX = -dy / dist;
      const perpY = dx / dist;
      const arcOffset = Math.min(dist * 0.3, 80);

      const color = EDGE_TYPE_COLOR[arc.edge.edge_type] ?? FALLBACK_COLOR;
      const strokeWidth = strengthToStroke(arc.edge.strength);

      rc.curve(
        [
          [arc.from.x, arc.from.y],
          [midX + perpX * arcOffset, midY + perpY * arcOffset],
          [arc.to.x, arc.to.y],
        ],
        {
          roughness: 1.2,
          strokeWidth,
          stroke: color,
          bowing: 0.5,
          seed: hashSeed(`${arc.edge.id}`),
        },
      );
    }

    ctx.globalAlpha = 1;
  }, [arcs, hoveredSlug]);

  // IntersectionObserver: draw-on animation
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el || drawn) return;

    const prefersReduced = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    if (prefersReduced) {
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
      { threshold: 0.1 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [drawn]);

  // Listen for hover on cards with data-slug
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const parent = wrapper.parentElement;
    if (!parent) return;

    function handleMouseOver(e: MouseEvent) {
      const card = (e.target as HTMLElement).closest('[data-slug]');
      if (card) {
        setHoveredSlug(card.getAttribute('data-slug'));
      }
    }

    function handleMouseOut(e: MouseEvent) {
      const card = (e.target as HTMLElement).closest('[data-slug]');
      if (card) {
        const related = e.relatedTarget as HTMLElement | null;
        if (!related || !card.contains(related)) {
          setHoveredSlug(null);
        }
      }
    }

    parent.addEventListener('mouseover', handleMouseOver);
    parent.addEventListener('mouseout', handleMouseOut);

    return () => {
      parent.removeEventListener('mouseover', handleMouseOver);
      parent.removeEventListener('mouseout', handleMouseOut);
    };
  }, []);

  if (edges.length === 0) return null;

  return (
    <div
      ref={wrapperRef}
      className="absolute inset-0 pointer-events-none"
      aria-hidden="true"
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0"
        style={{
          zIndex: 0,
          opacity: drawn ? 1 : 0,
          transition: 'opacity 600ms ease-out',
        }}
      />
    </div>
  );
}
