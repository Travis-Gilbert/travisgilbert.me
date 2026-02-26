'use client';

/**
 * StickyNote: individual reader comment rendered as a paper sticky note.
 *
 * Visual language: gold/amber tint (distinct from author's terracotta
 * annotations), Caveat handwritten font, slight deterministic rotation,
 * tape artifact at the top. Flagged notes turn red.
 *
 * Colors use CSS custom properties via color-mix() so they automatically
 * adapt to dark mode (lifted gold/error tokens).
 *
 * Rotation is derived from the comment UUID so it is stable across renders
 * and avoids React hydration mismatches (Math.random() would differ between
 * server and client).
 */

import type { Comment } from '@/lib/comments';

interface StickyNoteProps {
  comment: Comment;
  onFlag: (id: string) => void;
}

/** Maps a comment UUID to a small rotation angle (-2.5 to +2.5 degrees). */
function rotationFromId(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) & 0xffffffff;
  }
  const normalized = (hash >>> 0) / 0xffffffff;
  return (normalized - 0.5) * 5;
}

export default function StickyNote({ comment, onFlag }: StickyNoteProps) {
  const rotation = rotationFromId(comment.id);
  const date = new Date(comment.created_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });

  const bgColor = comment.is_flagged
    ? 'color-mix(in srgb, var(--color-error) 12%, transparent)'
    : 'color-mix(in srgb, var(--color-gold) 10%, transparent)';
  const borderColor = comment.is_flagged
    ? 'color-mix(in srgb, var(--color-error) 30%, transparent)'
    : 'color-mix(in srgb, var(--color-gold) 25%, transparent)';
  const tapeColor = comment.is_flagged
    ? 'var(--color-error)'
    : 'var(--color-gold)';

  return (
    <div
      className="sticky-note"
      style={{
        transform: `rotate(${rotation}deg)`,
        backgroundColor: bgColor,
        border: `1px solid ${borderColor}`,
      }}
    >
      {/* Tape artifact */}
      <div
        className="sticky-note-tape"
        style={{ backgroundColor: tapeColor }}
      />

      {/* Author name */}
      <div className="sticky-note-author">
        {comment.author_name}
      </div>

      {/* Comment body */}
      <p className="sticky-note-body">{comment.body}</p>

      {/* Footer: date + flag button */}
      <div className="sticky-note-footer">
        <span className="sticky-note-date">{date}</span>
        {!comment.is_flagged && (
          <button
            className="sticky-note-flag"
            onClick={() => onFlag(comment.id)}
            aria-label="Flag this comment"
            title="Flag as inappropriate"
          >
            Flag
          </button>
        )}
        {comment.is_flagged && (
          <span className="sticky-note-flagged-label">Flagged</span>
        )}
      </div>
    </div>
  );
}
