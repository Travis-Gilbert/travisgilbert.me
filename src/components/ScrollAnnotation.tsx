'use client';

/**
 * ScrollAnnotation: margin note that fades in when scrolled into view.
 *
 * Progressive enhancement layer on top of the existing CSS-only margin
 * annotations. Uses IntersectionObserver for one-way reveal, same pattern
 * as ScrollReveal but self-positioning via measureParagraphOffsets().
 *
 * Renders only at xl+ (1280px); hidden on smaller viewports via CSS.
 *
 * Includes a rough.js SVG leader line above the text that visually connects
 * the annotation to its paragraph.
 */

import { useRef, useEffect, useState, type RefObject } from 'react';
import rough from 'roughjs';
import { measureParagraphOffsets } from '@/lib/paragraphPositions';

type AnnotationStyle = 'handwritten' | 'typed';
type AnnotationSide = 'left' | 'right';

interface ScrollAnnotationProps {
  text: string;
  paragraphIndex: number;
  proseRef: RefObject<HTMLDivElement | null>;
  side?: AnnotationSide;
  style?: AnnotationStyle;
}

const STYLE_MAP: Record<AnnotationStyle, { fontFamily: string; fontSize: string }> = {
  handwritten: { fontFamily: 'var(--font-annotation)', fontSize: '15px' },
  typed: { fontFamily: 'var(--font-metadata)', fontSize: '11px' },
};

export default function ScrollAnnotation({
  text,
  paragraphIndex,
  proseRef,
  side = 'right',
  style = 'handwritten',
}: ScrollAnnotationProps) {
  const ref = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [visible, setVisible] = useState(false);
  const [topOffset, setTopOffset] = useState<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const prose = proseRef.current;
    if (!prose) return;

    const measure = () => {
      const offsets = measureParagraphOffsets(prose);
      const y = offsets.get(paragraphIndex);
      if (y != null) setTopOffset(y);
    };

    document.fonts.ready.then(measure);

    const ro = new ResizeObserver(measure);
    ro.observe(prose);
    return () => ro.disconnect();
  }, [proseRef, paragraphIndex]);

  // Draw rough.js SVG leader line once on mount
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    // Clear any previous drawing
    while (svg.firstChild) svg.removeChild(svg.firstChild);

    const rc = rough.svg(svg);
    const lineLength = 40;
    const midY = 4;

    const node = rc.line(0, midY, lineLength, midY, {
      roughness: 1.5,
      strokeWidth: 0.8,
      stroke: 'rgba(180, 90, 45, 0.4)',
      bowing: 1,
    });

    svg.appendChild(node);
  }, []);

  if (topOffset == null) return null;

  const font = STYLE_MAP[style];

  return (
    <div
      ref={ref}
      className="scroll-annotation"
      aria-hidden="true"
      data-side={side}
      style={{
        position: 'absolute',
        top: topOffset,
        fontFamily: font.fontFamily,
        fontSize: font.fontSize,
        lineHeight: 1.35,
        color: 'var(--color-terracotta)',
        opacity: visible ? 0.7 : 0,
        transition: 'opacity 600ms ease-out',
        pointerEvents: 'none',
        maxWidth: '200px',
      }}
    >
      {/* Rough.js hand-drawn leader line pointing toward the paragraph */}
      <svg
        ref={svgRef}
        aria-hidden="true"
        width={40}
        height={8}
        style={{
          display: 'block',
          marginBottom: 4,
          // Right-side: line aligns left (toward paragraph on the left)
          // Left-side: line aligns right (toward paragraph on the right)
          ...(side === 'left' ? { marginLeft: 'auto' } : {}),
        }}
      />
      {text}
    </div>
  );
}
