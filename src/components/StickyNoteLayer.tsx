'use client';

/**
 * StickyNoteLayer: positions sticky notes absolutely beside the prose.
 *
 * Paragraph positions are measured after document.fonts.ready (so Vollkorn
 * and Caveat don't shift positions after measurement) and re-measured on
 * resize via ResizeObserver.
 *
 * On desktop (xl+): sticky notes float in the right margin.
 * On mobile/tablet: this layer is hidden; MobileCommentList shows below.
 *
 * Clicking a paragraph opens CommentForm anchored to that paragraph.
 */

import {
  useState,
  useEffect,
  useCallback,
  type RefObject,
} from 'react';
import StickyNote from '@/components/StickyNote';
import CommentForm from '@/components/CommentForm';
import { measureParagraphOffsets } from '@/lib/paragraphPositions';
import type { Comment, ContentType } from '@/lib/comments';

interface StickyNoteLayerProps {
  comments: Comment[];
  proseRef: RefObject<HTMLDivElement>;
  contentType: ContentType;
  articleSlug: string;
  onFlag: (id: string) => void;
  onNewComment: (comment: Comment) => void;
}

export default function StickyNoteLayer({
  comments,
  proseRef,
  contentType,
  articleSlug,
  onFlag,
  onNewComment,
}: StickyNoteLayerProps) {
  const [offsets, setOffsets] = useState<Map<number, number>>(new Map());
  const [activeForm, setActiveForm] = useState<number | null>(null);

  const measure = useCallback(() => {
    if (!proseRef.current) return;
    setOffsets(measureParagraphOffsets(proseRef.current));
  }, [proseRef]);

  useEffect(() => {
    const container = proseRef.current;
    if (!container) return;

    // Wait for fonts to load before measuring (affects line heights)
    document.fonts.ready.then(measure);

    // Re-measure when the container size changes (resize, orientation change)
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => observer.disconnect();
  }, [measure, proseRef]);

  useEffect(() => {
    const container = proseRef.current;
    if (!container) return;

    function handleParagraphClick(e: MouseEvent) {
      const p = (e.target as Element).closest('#article-prose p');
      if (!p) return;

      const paragraphs = Array.from(container!.querySelectorAll('p'));
      const idx = paragraphs.indexOf(p as HTMLParagraphElement) + 1;
      if (idx > 0) setActiveForm(idx);
    }

    container.addEventListener('click', handleParagraphClick);
    return () => container.removeEventListener('click', handleParagraphClick);
  }, [proseRef]);

  // Group comments by paragraph for positioning
  const byParagraph = new Map<number, Comment[]>();
  for (const c of comments) {
    const list = byParagraph.get(c.paragraph_index) ?? [];
    list.push(c);
    byParagraph.set(c.paragraph_index, list);
  }

  function handleFormSuccess(comment: Comment) {
    onNewComment(comment);
    setActiveForm(null);
  }

  return (
    // hidden below xl, visible at xl+
    <div className="sticky-note-layer hidden xl:block">
      {/* Render existing sticky notes */}
      {Array.from(byParagraph.entries()).map(([paraIdx, paraComments]) => {
        const top = offsets.get(paraIdx);
        if (top === undefined) return null;

        // Stack multiple notes on same paragraph with small vertical offset
        return paraComments.map((comment, stackIdx) => (
          <div
            key={comment.id}
            className="sticky-note-positioner"
            style={{ top: top + stackIdx * 8 }}
          >
            <StickyNote comment={comment} onFlag={onFlag} />
          </div>
        ));
      })}

      {/* Render comment form anchored to clicked paragraph */}
      {activeForm !== null && (
        <div
          className="sticky-note-positioner"
          style={{ top: offsets.get(activeForm) ?? 0 }}
        >
          <CommentForm
            paragraphIndex={activeForm}
            articleSlug={articleSlug}
            contentType={contentType}
            onSuccess={handleFormSuccess}
            onClose={() => setActiveForm(null)}
          />
        </div>
      )}

      {/* Paragraph click hint (first load only, fades out) */}
      {offsets.size > 0 && comments.length === 0 && (
        <div className="sticky-note-hint">
          Click any paragraph to leave a note
        </div>
      )}
    </div>
  );
}
