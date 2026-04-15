'use client';

/**
 * SidenoteMargin: positions sidenotes in the right margin of the reading surface.
 *
 * Measures the Y position of each `.sidenote-ref` anchor span in the prose,
 * then absolutely positions the corresponding sidenote beside it. When notes
 * would overlap, the lower note shifts down to avoid collision.
 *
 * Desktop (xl+): visible as margin notes to the right of the reading surface.
 * Mobile (<1280px): hidden; sidenotes appear inline via CSS on the anchor spans.
 *
 * Note: sidenote HTML comes from the author's own markdown footnotes processed
 * by remark-gfm at build time. This is trusted content (same as the prose body
 * itself), so dangerouslySetInnerHTML is safe here.
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import type { Sidenote } from '@/lib/content';

interface SidenoteMarginProps {
  sidenotes: Sidenote[];
  /** Ref to the prose container that holds .sidenote-ref spans */
  proseRef: React.RefObject<HTMLDivElement | null>;
}

interface PositionedNote {
  id: string;
  html: string;
  top: number;
}

const MIN_GAP = 12;

export default function SidenoteMargin({ sidenotes, proseRef }: SidenoteMarginProps) {
  const [positions, setPositions] = useState<PositionedNote[]>([]);
  const notesRef = useRef<(HTMLDivElement | null)[]>([]);

  const measure = useCallback(() => {
    const container = proseRef.current;
    if (!container || sidenotes.length === 0) return;

    const containerRect = container.getBoundingClientRect();
    const rawPositions: PositionedNote[] = [];

    for (const sidenote of sidenotes) {
      const anchor = container.querySelector(
        `.sidenote-ref[data-sidenote-id="${sidenote.id}"]`
      );
      if (!anchor) continue;

      const anchorRect = anchor.getBoundingClientRect();
      const top = anchorRect.top - containerRect.top;

      rawPositions.push({
        id: sidenote.id,
        html: sidenote.html,
        top,
      });
    }

    setPositions(rawPositions);
  }, [sidenotes, proseRef]);

  // Second pass: resolve overlaps once we know note heights
  useEffect(() => {
    if (positions.length < 2) return;

    const resolved = [...positions];
    let changed = false;

    for (let i = 1; i < resolved.length; i++) {
      const prevEl = notesRef.current[i - 1];
      if (!prevEl) continue;

      const prevBottom = resolved[i - 1].top + prevEl.offsetHeight + MIN_GAP;
      if (resolved[i].top < prevBottom) {
        resolved[i] = { ...resolved[i], top: prevBottom };
        changed = true;
      }
    }

    if (changed) {
      setPositions(resolved);
    }
  }, [positions]);

  useEffect(() => {
    document.fonts.ready.then(measure);

    const handleResize = () => measure();
    window.addEventListener('resize', handleResize, { passive: true });
    return () => window.removeEventListener('resize', handleResize);
  }, [measure]);

  if (sidenotes.length === 0) return null;

  return (
    <div
      className="sidenote-margin"
      aria-label="Margin notes"
    >
      {positions.map((note, i) => (
        <div
          key={note.id}
          ref={(el) => { notesRef.current[i] = el; }}
          className="sidenote-note"
          style={{ top: note.top }}
        >
          <span className="sidenote-number">{i + 1}</span>
          {/* Sidenote content is author-written markdown processed by remark-gfm
              at build time. This is trusted content, not user input. */}
          <span
            className="sidenote-text"
            dangerouslySetInnerHTML={{ __html: note.html }}
          />
        </div>
      ))}
    </div>
  );
}
