'use client';

import type { SpacetimeEvent } from '@/lib/spacetime/types';
import styles from '@/app/(spacetime)/spacetime/spacetime.module.css';

interface HoverNoteProps {
  event: SpacetimeEvent;
  /** Screen-space x,y of the event dot. */
  x: number;
  y: number;
  /** Font/accent color for the handwritten note text. */
  color: string;
  /** Stage size in px: used to flip the note left when the dot is on the right. */
  stageSize: number;
  prehistory: boolean;
}

/**
 * Marginalia card that pops up when the user hovers an event dot.
 * Apple Gothic on the body, paper card with a thin dark stroke, slightly
 * rotated for the field-notebook lean.
 */
export default function HoverNote({ event, x, y, color, stageSize, prehistory }: HoverNoteProps) {
  const flipLeft = x > stageSize * 0.55;
  const transform = flipLeft
    ? 'translate(calc(-100% - 14px), -100%)'
    : 'translate(14px, -100%)';

  const yearLabel = event.year < 0
    ? `${Math.abs(event.year).toFixed(2)} Mya`
    : String(event.year);

  return (
    <div
      className={styles.hoverNote}
      style={{ left: x, top: y - 16, transform }}
    >
      <div className={styles.noteTag}>
        <div className={styles.noteMeta}>
          {event.city} · {yearLabel}
          <span className={styles.dotSep}>·</span>
          {event.papers} {prehistory ? 'specimens' : 'papers'}
        </div>
        <div className={styles.noteText} style={{ color }}>
          {event.note}
        </div>
      </div>
    </div>
  );
}
