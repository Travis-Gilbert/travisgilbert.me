'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { CAPTURE_PLACEHOLDERS, quickCapture } from '@/lib/networks';

/**
 * CaptureBar: the hero input for Networks.
 *
 * Rotating placeholder quotes cycle every 4 seconds with a fade transition.
 * Accepts a URL (auto-detected) or plain text. Submits via the QuickCapture
 * API endpoint. Calls `onCapture` after successful submission so the parent
 * can refresh the inbox.
 */
export default function CaptureBar({
  onCapture,
}: {
  onCapture?: () => void;
}) {
  const [value, setValue] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [placeholderVisible, setPlaceholderVisible] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  // Rotate placeholders every 4 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderVisible(false);
      setTimeout(() => {
        setPlaceholderIndex((i) => (i + 1) % CAPTURE_PLACEHOLDERS.length);
        setPlaceholderVisible(true);
      }, 300);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = value.trim();
      if (!trimmed || isSubmitting) return;

      setIsSubmitting(true);

      // Detect if the input looks like a URL
      const isUrl = /^https?:\/\//.test(trimmed) || /^www\./.test(trimmed);
      const payload = isUrl
        ? { url: trimmed.startsWith('www.') ? `https://${trimmed}` : trimmed }
        : { body: trimmed };

      const result = await quickCapture(payload);

      setIsSubmitting(false);

      if (result.ok) {
        setValue('');
        inputRef.current?.blur();
        onCapture?.();
      }
    },
    [value, isSubmitting, onCapture],
  );

  return (
    <form onSubmit={handleSubmit} style={{ width: '100%' }}>
      <div className="nw-capture-bar" style={{ position: 'relative' }}>
        <input
          ref={inputRef}
          id="networks-capture-input"
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={CAPTURE_PLACEHOLDERS[placeholderIndex]}
          className="nw-capture-input"
          disabled={isSubmitting}
          style={{
            opacity: isSubmitting ? 0.5 : 1,
          }}
          aria-label="Quick capture"
        />
        {/* Placeholder fade overlay (only visible when input is empty) */}
        {!value && (
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              pointerEvents: 'none',
              opacity: placeholderVisible ? 1 : 0,
              transition: 'opacity 300ms',
            }}
          />
        )}
        {/* Submit indicator */}
        {value.trim() && (
          <div
            style={{
              position: 'absolute',
              right: 16,
              top: '50%',
              transform: 'translateY(-50%)',
              fontFamily: 'var(--nw-font-mono)',
              fontSize: 10,
              color: 'var(--nw-text-faint)',
              letterSpacing: '0.05em',
            }}
          >
            {isSubmitting ? 'SAVING...' : 'ENTER'}
          </div>
        )}
      </div>
    </form>
  );
}
