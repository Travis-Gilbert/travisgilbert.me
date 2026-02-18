'use client';

/**
 * CommentForm: paragraph-anchored comment input.
 *
 * Appears when a reader clicks a paragraph. Collects author name and comment
 * body, gets a reCAPTCHA v3 token, then posts to /api/comments.
 *
 * On success the form closes and calls onSuccess with the new comment so the
 * parent can add it to the list without a page reload.
 */

import { useState, useEffect } from 'react';
import { loadRecaptchaScript, getRecaptchaToken } from '@/lib/recaptcha';
import type { Comment, ContentType } from '@/lib/comments';

interface CommentFormProps {
  paragraphIndex: number;
  articleSlug: string;
  contentType: ContentType;
  onSuccess: (comment: Comment) => void;
  onClose: () => void;
}

export default function CommentForm({
  paragraphIndex,
  articleSlug,
  contentType,
  onSuccess,
  onClose,
}: CommentFormProps) {
  const [name, setName] = useState('');
  const [body, setBody] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    loadRecaptchaScript();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !body.trim()) return;

    setStatus('submitting');
    setErrorMsg('');

    try {
      const token = await getRecaptchaToken('submit_comment');

      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          article_slug: articleSlug,
          content_type: contentType,
          paragraph_index: paragraphIndex,
          author_name: name.trim(),
          body: body.trim(),
          recaptcha_token: token,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Something went wrong');
      }

      const newComment: Comment = await res.json();
      onSuccess(newComment);
    } catch (err) {
      setStatus('error');
      setErrorMsg(err instanceof Error ? err.message : 'Could not submit comment');
    }
  }

  return (
    <div className="comment-form-wrapper">
      <form onSubmit={handleSubmit} className="comment-form" noValidate>
        <div className="comment-form-header">
          <span className="comment-form-label">Add a note</span>
          <button
            type="button"
            className="comment-form-close"
            onClick={onClose}
            aria-label="Close comment form"
          >
            &times;
          </button>
        </div>

        <input
          type="text"
          placeholder="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="comment-form-input"
          maxLength={80}
          required
          disabled={status === 'submitting'}
        />

        <textarea
          placeholder="Your comment..."
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="comment-form-textarea"
          rows={3}
          maxLength={600}
          required
          disabled={status === 'submitting'}
        />

        {status === 'error' && (
          <p className="comment-form-error">{errorMsg}</p>
        )}

        <div className="comment-form-footer">
          <span className="comment-form-recaptcha-note">
            Protected by reCAPTCHA
          </span>
          <button
            type="submit"
            className="comment-form-submit"
            disabled={status === 'submitting' || !name.trim() || !body.trim()}
          >
            {status === 'submitting' ? 'Posting...' : 'Post'}
          </button>
        </div>
      </form>
    </div>
  );
}
