'use client';

/**
 * StickyNote: reader comment displayed as a streamlined mono card.
 *
 * Visual language: "#N" header in JetBrains Mono Semi (--font-code),
 * comment body also in JetBrains Mono for uniform mono aesthetic,
 * wrapped in a glowing rough.js gold border. Rectangular proportions,
 * no rotation, no tape, no paper grain.
 *
 * Colors use CSS custom properties so they adapt to dark mode.
 * The hash derived from the comment UUID provides the rough.js seed,
 * so the hand-drawn wobble is stable across renders.
 */

import { useRef, useEffect } from 'react';
import rough from 'roughjs';
import { useThemeVersion, readCssVar } from '@/hooks/useThemeColor';
import type { Comment } from '@/lib/comments';

interface StickyNoteProps {
  comment: Comment;
  /** 1-based display index for the #N header */
  index: number;
  onFlag: (id: string) => void;
}

/** djb2 hash from comment UUID; used for rough.js seed. */
function hashFromId(id: string): number {
  let hash = 5381;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) + hash + id.charCodeAt(i)) & 0xffffffff;
  }
  return hash >>> 0;
}

export default function StickyNote({ comment, index, onFlag }: StickyNoteProps) {
  const hash = hashFromId(comment.id);

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const themeVersion = useThemeVersion();

  const date = new Date(comment.created_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });

  const bgColor = comment.is_flagged
    ? 'color-mix(in srgb, var(--color-error) 5%, transparent)'
    : 'color-mix(in srgb, var(--color-gold) 4%, transparent)';

  // rough.js canvas border
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const strokeColor = comment.is_flagged
      ? (readCssVar('--color-error') || '#c0392b')
      : (readCssVar('--color-gold') || '#C49A4A');

    function draw() {
      const rect = container!.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const w = rect.width;
      const h = rect.height;

      canvas!.width = w * dpr;
      canvas!.height = h * dpr;
      canvas!.style.width = `${w}px`;
      canvas!.style.height = `${h}px`;

      const ctx = canvas!.getContext('2d');
      if (!ctx) return;

      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, w, h);

      const rc = rough.canvas(canvas!);
      rc.rectangle(2, 2, w - 4, h - 4, {
        roughness: 0.8,
        strokeWidth: 0.8,
        stroke: strokeColor,
        bowing: 1,
        seed: hash,
      });
    }

    draw();

    const observer = new ResizeObserver(() => draw());
    observer.observe(container);

    return () => observer.disconnect();
  }, [comment.is_flagged, hash, themeVersion]);

  return (
    <div
      ref={containerRef}
      className="reader-note relative"
      style={{ backgroundColor: bgColor }}
    >
      {/* rough.js hand-drawn border */}
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
      />

      {/* #N header + author */}
      <div className="reader-note-header relative z-10">
        <span className="reader-note-number">#{index}</span>
        <span className="reader-note-author">{comment.author_name}</span>
        <span className="reader-note-date">{date}</span>
      </div>

      {/* Comment body */}
      <p className="reader-note-body relative z-10">{comment.body}</p>

      {/* Footer: flag action */}
      <div className="reader-note-footer relative z-10">
        {!comment.is_flagged && (
          <button
            className="reader-note-flag"
            onClick={() => onFlag(comment.id)}
            aria-label="Flag this comment"
            title="Flag as inappropriate"
          >
            Flag
          </button>
        )}
        {comment.is_flagged && (
          <span className="reader-note-flagged-label">Flagged</span>
        )}
      </div>
    </div>
  );
}
