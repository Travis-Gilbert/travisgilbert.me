'use client';

/**
 * Theseus homepage.
 *
 * Clean search interface. Not the galaxy. The user types a question,
 * gets routed to /theseus/ask with results.
 */

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

const T = {
  bg: '#0f1012',
  text: '#e8e5e0',
  textMuted: '#9a958d',
  textDim: '#5c5851',
  teal: '#2D5F6B',
  tealLight: '#4A8A96',
  amber: '#C49A4A',
  terra: '#C4503C',
  border: 'rgba(255,255,255,0.06)',
  mono: "'Courier Prime', monospace",
  body: "'IBM Plex Sans', sans-serif",
  title: "'Vollkorn', serif",
} as const;

const SUGGESTIONS = [
  'What connects Shannon to Hamming?',
  'What do I know about graph neural networks?',
  'Show me unresolved tensions',
  'What am I missing about knowledge graphs?',
  'How does belief revision work?',
  'What papers discuss structure mapping?',
];

export default function TheseusHome() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const interval = setInterval(() => {
      setPlaceholderIndex((i) => (i + 1) % SUGGESTIONS.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = () => {
    const trimmed = query.trim();
    if (!trimmed) return;
    router.push(`/theseus/ask?q=${encodeURIComponent(trimmed)}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 24px',
        gap: 32,
      }}
    >
      {/* Branding */}
      <div style={{ textAlign: 'center' }}>
        <h1
          style={{
            fontFamily: T.title,
            fontSize: 28,
            fontWeight: 600,
            color: T.text,
            margin: 0,
            letterSpacing: '0.02em',
          }}
        >
          What are you thinking about?
        </h1>
        <p
          style={{
            fontFamily: T.body,
            fontSize: 14,
            color: T.textMuted,
            marginTop: 8,
          }}
        >
          Ask a question. Theseus will search your knowledge graph and
          show you what it finds.
        </p>
      </div>

      {/* Search input */}
      <div
        style={{
          width: '100%',
          maxWidth: 640,
          position: 'relative',
        }}
      >
        <textarea
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={SUGGESTIONS[placeholderIndex]}
          rows={3}
          style={{
            width: '100%',
            padding: '16px 56px 16px 16px',
            background: T.bg,
            border: `1px solid ${T.border}`,
            borderRadius: 12,
            color: T.text,
            fontFamily: T.body,
            fontSize: 15,
            lineHeight: 1.5,
            resize: 'none',
            outline: 'none',
            transition: 'border-color 0.15s',
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = `${T.teal}66`;
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = T.border;
          }}
        />
        <button
          onClick={handleSubmit}
          disabled={!query.trim()}
          style={{
            position: 'absolute',
            right: 12,
            bottom: 12,
            width: 36,
            height: 36,
            borderRadius: 8,
            border: 'none',
            background: query.trim() ? T.teal : 'transparent',
            cursor: query.trim() ? 'pointer' : 'default',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background 0.15s',
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke={query.trim() ? T.text : T.textDim}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>

      {/* Suggestion pills */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
          justifyContent: 'center',
          maxWidth: 640,
        }}
      >
        {SUGGESTIONS.slice(0, 4).map((s) => (
          <button
            key={s}
            onClick={() => {
              setQuery(s);
              router.push(`/theseus/ask?q=${encodeURIComponent(s)}`);
            }}
            style={{
              padding: '6px 14px',
              background: 'rgba(255,255,255,0.02)',
              border: `1px solid ${T.border}`,
              borderRadius: 20,
              fontFamily: T.mono,
              fontSize: 11,
              color: T.textMuted,
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = `${T.teal}44`;
              e.currentTarget.style.color = T.text;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = T.border;
              e.currentTarget.style.color = T.textMuted;
            }}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
