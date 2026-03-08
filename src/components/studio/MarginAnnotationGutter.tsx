'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import type { Editor } from '@tiptap/react';

interface AnnotationDot {
  id: string;
  y: number;
  text: string;
  side: 'left' | 'right';
}

/**
 * Colored dots in the left margin gutter (0 to 62px zone)
 * showing where margin annotations exist in the document.
 *
 * Scans the editor DOM for `.margin-annotation-anchor` spans
 * (injected by `injectAnnotations()` when content is loaded).
 * Hover reveals a tooltip preview of the annotation text.
 */
export default function MarginAnnotationGutter({ editor }: { editor: Editor | null }) {
  const [dots, setDots] = useState<AnnotationDot[]>([]);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const gutterRef = useRef<HTMLDivElement>(null);

  const scanAnnotations = useCallback(() => {
    if (!editor) return;
    const pageEl = gutterRef.current?.closest('.studio-page');
    if (!pageEl) return;

    const anchors = pageEl.querySelectorAll('.margin-annotation-anchor');
    if (anchors.length === 0) {
      setDots([]);
      return;
    }

    const pageRect = pageEl.getBoundingClientRect();
    const newDots: AnnotationDot[] = [];

    anchors.forEach((anchor, i) => {
      const rect = anchor.getBoundingClientRect();
      newDots.push({
        id: `ann-${i}`,
        y: rect.top - pageRect.top + rect.height / 2,
        text: anchor.getAttribute('data-annotation-text') ?? '',
        side: (anchor.getAttribute('data-annotation-side') as 'left' | 'right') ?? 'right',
      });
    });

    setDots(newDots);
  }, [editor]);

  useEffect(() => {
    if (!editor) return;
    scanAnnotations();
    editor.on('update', scanAnnotations);
    return () => {
      editor.off('update', scanAnnotations);
    };
  }, [editor, scanAnnotations]);

  /* Re-scan on scroll (positions shift) */
  useEffect(() => {
    const scrollParent = gutterRef.current?.closest('.studio-writing-surface');
    if (!scrollParent) return;
    const handleScroll = () => scanAnnotations();
    scrollParent.addEventListener('scroll', handleScroll, { passive: true });
    return () => scrollParent.removeEventListener('scroll', handleScroll);
  }, [scanAnnotations]);

  if (dots.length === 0) return null;

  return (
    <div className="margin-annotation-gutter" ref={gutterRef}>
      {dots.map((dot) => (
        <div
          key={dot.id}
          className="margin-annotation-dot"
          style={{ top: dot.y }}
          onMouseEnter={() => setHoveredId(dot.id)}
          onMouseLeave={() => setHoveredId(null)}
        >
          <div className="margin-dot-circle" />
          {hoveredId === dot.id && dot.text && (
            <div className="margin-annotation-tooltip">
              {dot.text.slice(0, 80)}
              {dot.text.length > 80 ? '...' : ''}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
