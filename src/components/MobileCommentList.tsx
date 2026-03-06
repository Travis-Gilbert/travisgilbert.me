'use client';

/**
 * MobileCommentList: stacked comment list for viewports below xl (1280px).
 *
 * At narrow widths there is no margin space for reader notes, so comments
 * are shown below the article in a vertical list. Each item shows the
 * #N index, paragraph reference, author, body, and flag button.
 *
 * Uses the same JetBrains Mono Semi #N header + body font pattern as
 * the desktop StickyNote for visual consistency.
 *
 * Shown only on mobile/tablet via CSS (hidden xl:hidden at xl+).
 */

import { useState } from 'react';
import type { Comment } from '@/lib/comments';

interface MobileCommentListProps {
  comments: Comment[];
  onFlag: (id: string) => void;
}

export default function MobileCommentList({
  comments,
  onFlag,
}: MobileCommentListProps) {
  const [expanded, setExpanded] = useState(false);

  if (comments.length === 0) return null;

  const displayComments = expanded ? comments : comments.slice(0, 3);

  return (
    <section className="mobile-comment-list xl:hidden">
      <h2 className="mobile-comment-list-heading">
        Reader Notes
        <span className="mobile-comment-count">{comments.length}</span>
      </h2>

      <div className="mobile-comment-items">
        {displayComments.map((comment, i) => {
          const globalIndex = comments.indexOf(comment) + 1;
          const date = new Date(comment.created_at).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          });
          return (
            <div
              key={comment.id}
              className={`mobile-comment-item${comment.is_flagged ? ' mobile-comment-item--flagged' : ''}`}
            >
              <div className="mobile-comment-meta">
                <span className="mobile-comment-number">#{globalIndex}</span>
                <span className="mobile-comment-author">{comment.author_name}</span>
                <span className="mobile-comment-paragraph">
                  Para. {comment.paragraph_index}
                </span>
                <span className="mobile-comment-date">{date}</span>
              </div>
              <p className="mobile-comment-body">{comment.body}</p>
              <div className="mobile-comment-actions">
                {!comment.is_flagged ? (
                  <button
                    className="reader-note-flag"
                    onClick={() => onFlag(comment.id)}
                  >
                    Flag
                  </button>
                ) : (
                  <span className="reader-note-flagged-label">Flagged</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {comments.length > 3 && (
        <button
          className="mobile-comment-toggle"
          onClick={() => setExpanded(!expanded)}
          style={{ minHeight: 44 }}
        >
          {expanded
            ? 'Show fewer'
            : `Show all ${comments.length} notes`}
        </button>
      )}
    </section>
  );
}
