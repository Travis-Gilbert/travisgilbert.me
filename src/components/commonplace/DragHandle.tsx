'use client';

import { useCallback, useRef, useState } from 'react';
import type { SplitDirection } from '@/lib/commonplace-layout';
import styles from './DragHandle.module.css';

interface DragHandleProps {
  direction: SplitDirection;
  splitId: string;
  onResize: (splitId: string, ratio: number) => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

const SNAP_POINTS = [0.33, 0.5, 0.67];
const SNAP_THRESHOLD = 0.02;

function snapRatio(raw: number): number {
  for (const snap of SNAP_POINTS) {
    if (Math.abs(raw - snap) < SNAP_THRESHOLD) return snap;
  }
  return raw;
}

/**
 * Drag handle for resizing split panes.
 *
 * Uses pointer capture for reliable tracking even when
 * the cursor moves outside the handle during a fast drag.
 * The CSS hit area is expanded via ::before pseudo-element
 * (see commonplace.css) so the 1px visual line is easy to grab.
 *
 * Grip dots appear on hover. A floating ratio readout is shown
 * while dragging. Snap points at 33%, 50%, and 67% provide
 * tactile detents.
 */
export default function DragHandle({
  direction,
  splitId,
  onResize,
  containerRef,
}: DragHandleProps) {
  const dragging = useRef(false);
  const handleRef = useRef<HTMLDivElement>(null);
  const [activeRatio, setActiveRatio] = useState<number | null>(null);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      dragging.current = true;
      handleRef.current?.setPointerCapture(e.pointerId);
      document.body.style.cursor =
        direction === 'horizontal' ? 'col-resize' : 'row-resize';
      document.body.style.userSelect = 'none';
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

      const snapped = snapRatio(ratio);
      setActiveRatio(snapped);
      onResize(splitId, snapped);
    },
    [direction, splitId, onResize, containerRef]
  );

  const onPointerUp = useCallback(() => {
    dragging.current = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    setActiveRatio(null);
  }, []);

  return (
    <div
      ref={handleRef}
      className={styles.dragHandle}
      data-direction={direction}
      data-dragging={activeRatio !== null ? 'true' : 'false'}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      role="separator"
      aria-orientation={direction}
      aria-label={`Resize ${direction === 'horizontal' ? 'columns' : 'rows'}`}
      tabIndex={0}
    >
      {/* Grip indicator: three dots */}
      <div className={styles.grip} aria-hidden="true">
        <span /><span /><span />
      </div>
      {/* Ratio readout during drag */}
      {activeRatio !== null && (
        <div className={styles.readout}>
          {Math.round(activeRatio * 100)}% / {Math.round((1 - activeRatio) * 100)}%
        </div>
      )}
    </div>
  );
}
