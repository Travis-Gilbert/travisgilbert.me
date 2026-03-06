'use client';

/**
 * CommentForm: streamlined paragraph-anchored comment input.
 *
 * Appears when a reader clicks a paragraph. Borderless JetBrains Mono inputs
 * blend into a glowing rough.js gold card. Collects author name and comment
 * body, gets a reCAPTCHA v3 token, then posts to /api/comments.
 *
 * On success the form closes and calls onSuccess with the new comment so the
 * parent can add it to the list without a page reload.
 */

import { useState, useEffect, useRef } from 'react';
import rough from 'roughjs';
import { useThemeVersion, readCssVar } from '@/hooks/useThemeColor';
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

  const formRef = useRef<HTMLFormElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const themeVersion = useThemeVersion();

  useEffect(() => {
    loadRecaptchaScript();
  }, []);

  // rough.js canvas border
  useEffect(() => {
    const form = formRef.current;
    const canvas = canvasRef.current;
    if (!form || !canvas) return;

    const strokeColor = readCssVar('--color-gold') || '#C49A4A';
    // Deterministic seed from paragraph index
    const seed = paragraphIndex * 7919;

    function draw() {
      const rect = form!.getBoundingClientRect();
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
        seed,
      });
    }

    draw();

    const observer = new ResizeObserver(() => draw());
    observer.observe(form);

    return () => observer.disconnect();
  }, [paragraphIndex, themeVersion]);

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
      <form
        ref={formRef}
        onSubmit={handleSubmit}
        className="comment-form relative"
        noValidate
      >
        {/* rough.js hand-drawn border */}
        <canvas
          ref={canvasRef}
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none"
        />

        <div className="comment-form-header relative z-10">
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
          className="comment-form-input relative z-10"
          maxLength={80}
          required
          disabled={status === 'submitting'}
        />

        <textarea
          placeholder="Your comment..."
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="comment-form-textarea relative z-10"
          rows={3}
          maxLength={600}
          required
          disabled={status === 'submitting'}
        />

        {status === 'error' && (
          <p className="comment-form-error relative z-10">{errorMsg}</p>
        )}

        <div className="comment-form-footer relative z-10">
          <span className="comment-form-recaptcha-note">
            Protected by reCAPTCHA
          </span>
          <button
            type="submit"
            className="comment-form-submit"
            disabled={status === 'submitting' || !name.trim() || !body.trim()}
          >
            {status === 'submitting' ? '...' : 'Post'}
          </button>
        </div>
      </form>
    </div>
  );
}
