'use client';

/**
 * StickyNote: individual reader comment rendered as a paper sticky note.
 *
 * Visual language: gold/amber tint (distinct from author's terracotta
 * annotations), Caveat handwritten font, slight deterministic rotation,
 * tape artifact at the top. Flagged notes turn red.
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
    ? 'rgba(164, 74, 58, 0.12)'
    : 'rgba(196, 154, 74, 0.10)';
  const borderColor = comment.is_flagged
    ? 'rgba(164, 74, 58, 0.30)'
    : 'rgba(196, 154, 74, 0.25)';
  const tapeColor = comment.is_flagged ? '#A44A3A' : '#C49A4A';

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
