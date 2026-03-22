'use client';

import { useState, useCallback, useRef } from 'react';
import type { RefObject, ReactNode } from 'react';

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface RubberBandSelectionProps {
  /** Ref to the scrollable/pannable container */
  containerRef: RefObject<HTMLDivElement | null>;
  /** Current items with bounding boxes, for intersection testing */
  items: Array<{ id: string; x: number; y: number; width: number; height: number }>;
  /** Called with IDs of items whose bounding boxes intersect the selection rect */
  onSelect: (ids: string[]) => void;
  children: ReactNode;
}

function rectsIntersect(a: Rect, b: Rect): boolean {
  return !(
    a.x + a.width < b.x ||
    b.x + b.width < a.x ||
    a.y + a.height < b.y ||
    b.y + b.height < a.y
  );
}

export default function RubberBandSelection({
  containerRef,
  items,
  onSelect,
  children,
}: RubberBandSelectionProps) {
  const [dragging, setDragging] = useState(false);
  const [rect, setRect] = useState<Rect | null>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Only start rubber-band on empty space (not on cards)
      if ((e.target as HTMLElement).closest('[data-board-item]')) return;
      if (e.button !== 0) return;

      const container = containerRef.current;
      if (!container) return;
      const bounds = container.getBoundingClientRect();
      const x = e.clientX - bounds.left + container.scrollLeft;
      const y = e.clientY - bounds.top + container.scrollTop;

      startRef.current = { x, y };
      setRect({ x, y, width: 0, height: 0 });
      setDragging(true);
      e.preventDefault();
    },
    [containerRef],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!dragging || !startRef.current) return;
      const container = containerRef.current;
      if (!container) return;
      const bounds = container.getBoundingClientRect();
      const cx = e.clientX - bounds.left + container.scrollLeft;
      const cy = e.clientY - bounds.top + container.scrollTop;

      const x = Math.min(startRef.current.x, cx);
      const y = Math.min(startRef.current.y, cy);
      const width = Math.abs(cx - startRef.current.x);
      const height = Math.abs(cy - startRef.current.y);
      setRect({ x, y, width, height });
    },
    [dragging, containerRef],
  );

  const handleMouseUp = useCallback(() => {
    if (!dragging || !rect) {
      setDragging(false);
      return;
    }

    const ids = items
      .filter((item) => rectsIntersect(rect, item))
      .map((item) => item.id);

    if (ids.length > 0) onSelect(ids);

    setDragging(false);
    setRect(null);
    startRef.current = null;
  }, [dragging, rect, items, onSelect]);

  return (
    <div
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      style={{ position: 'relative' }}
    >
      {children}
      {dragging && rect && rect.width > 2 && rect.height > 2 && (
        <div
          style={{
            position: 'absolute',
            left: rect.x,
            top: rect.y,
            width: rect.width,
            height: rect.height,
            border: '1px dashed #B8623D',
            backgroundColor: 'rgba(184, 98, 61, 0.03)',
            pointerEvents: 'none',
            zIndex: 50,
          }}
        />
      )}
    </div>
  );
}
