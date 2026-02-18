'use client';

/**
 * ArticleComments: orchestrates the full comments experience.
 *
 * Fetches comments on mount, manages comment state (add, flag), and renders:
 * - StickyNoteLayer: absolute sticky notes in the margin (xl+, desktop)
 * - MobileCommentList: stacked list below the article (below xl)
 *
 * If NEXT_PUBLIC_COMMENTS_API_URL is not set (local dev without backend),
 * the component renders nothing silently.
 */

import { useState, useEffect, type RefObject } from 'react';
import StickyNoteLayer from '@/components/StickyNoteLayer';
import MobileCommentList from '@/components/MobileCommentList';
import type { Comment, ContentType } from '@/lib/comments';

interface ArticleCommentsProps {
  proseRef: RefObject<HTMLDivElement>;
  contentType: ContentType;
  articleSlug: string;
}

export default function ArticleComments({
  proseRef,
  contentType,
  articleSlug,
}: ArticleCommentsProps) {
  const [comments, setComments] = useState<Comment[]>([]);

  useEffect(() => {
    fetch(`/api/comments?type=${contentType}&slug=${articleSlug}`)
      .then((r) => r.ok ? r.json() : { comments: [] })
      .then((data) => {
        if (Array.isArray(data)) setComments(data);
        else if (Array.isArray(data.comments)) setComments(data.comments);
      })
      .catch(() => {
        // Silent failure: no backend configured or offline
      });
  }, [contentType, articleSlug]);

  function handleFlag(id: string) {
    // Optimistic update: mark as flagged immediately
    setComments((prev) =>
      prev.map((c) => (c.id === id ? { ...c, is_flagged: true } : c))
    );

    // Fire and forget: revert on failure
    fetch(`/api/comments/${id}/flag`, { method: 'POST' }).catch(() => {
      setComments((prev) =>
        prev.map((c) => (c.id === id ? { ...c, is_flagged: false } : c))
      );
    });
  }

  function handleNewComment(comment: Comment) {
    setComments((prev) => [...prev, comment]);
  }

  return (
    <>
      <StickyNoteLayer
        comments={comments}
        proseRef={proseRef}
        contentType={contentType}
        articleSlug={articleSlug}
        onFlag={handleFlag}
        onNewComment={handleNewComment}
      />
      <MobileCommentList
        comments={comments}
        onFlag={handleFlag}
      />
    </>
  );
}
