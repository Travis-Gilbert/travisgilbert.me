'use client';

import { useCallback, useRef } from 'react';
import type { SplitDirection } from '@/lib/commonplace-layout';

interface DragHandleProps {
  direction: SplitDirection;
  splitId: string;
  onResize: (splitId: string, ratio: number) => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

/**
 * Drag handle for resizing split panes.
 *
 * Uses pointer capture for reliable tracking even when
 * the cursor moves outside the handle during a fast drag.
 * The CSS hit area is expanded via ::before pseudo-element
 * (see commonplace.css) so the 1px visual line is easy to grab.
 */
export default function DragHandle({
  direction,
  splitId,
  onResize,
  containerRef,
}: DragHandleProps) {
  const dragging = useRef(false);
  const handleRef = useRef<HTMLDivElement>(null);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      dragging.current = true;
      handleRef.current?.setPointerCapture(e.pointerId);
      document.body.style.cursor =
        direction === 'horizontal' ? 'col-resize' : 'row-resize';
      document.body.style.userSelect = 'none';
      handleRef.current?.setAttribute('data-dragging', 'true');
    },
    [direction]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging.current || !containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      let ratio: number;

      if (direction === 'horizontal') {
        ratio = (e.clientX - rect.left) / rect.width;
      } else {
        ratio = (e.clientY - rect.top) / rect.height;
      }

      onResize(splitId, ratio);
    },
    [direction, splitId, onResize, containerRef]
  );

  const onPointerUp = useCallback(() => {
    dragging.current = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    handleRef.current?.setAttribute('data-dragging', 'false');
  }, []);

  return (
    <div
      ref={handleRef}
      className="cp-drag-handle"
      data-direction={direction}
      data-dragging="false"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      role="separator"
      aria-orientation={direction}
      aria-label={`Resize ${direction === 'horizontal' ? 'columns' : 'rows'}`}
      tabIndex={0}
    />
  );
}
