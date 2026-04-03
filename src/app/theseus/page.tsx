'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

export default function TheseusHomepage() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    router.push(`/theseus/ask?q=${encodeURIComponent(trimmed)}`);
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        height: '100%',
        padding: '0 24px',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ height: '40vh', flexShrink: 0 }} />

      <form
        onSubmit={handleSubmit}
        style={{
          width: '100%',
          maxWidth: '480px',
          flexShrink: 0,
          position: 'relative',
        }}
      >
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          autoFocus
          aria-label="Ask Theseus"
          style={{
            position: 'absolute',
            opacity: 0,
            width: 0,
            height: 0,
            overflow: 'hidden',
          }}
        />
        <div
          onClick={() => inputRef.current?.focus()}
          role="textbox"
          tabIndex={-1}
          style={{
            width: '100%',
            height: '44px',
            padding: '0 16px',
            fontSize: '15px',
            fontFamily: 'var(--vie-font-mono)',
            background: 'rgba(0,0,0,0.25)',
            border: focused ? '1px solid rgba(74,138,150,0.3)' : '1px solid rgba(255,255,255,0.04)',
            borderRadius: '10px',
            boxShadow: focused
              ? 'inset 0 1px 3px rgba(0,0,0,0.4), inset 0 0 0 1px rgba(0,0,0,0.15), 0 0 0 1px rgba(74,138,150,0.15)'
              : 'inset 0 1px 3px rgba(0,0,0,0.4), inset 0 0 0 1px rgba(0,0,0,0.15)',
            color: 'var(--vie-text)',
            transition: 'border-color 200ms ease, box-shadow 200ms ease',
            boxSizing: 'border-box',
            letterSpacing: '0.02em',
            display: 'flex',
            alignItems: 'center',
            cursor: 'text',
            overflow: 'hidden',
            whiteSpace: 'nowrap',
          }}
        >
          {query.length > 0 ? (
            <>
              <span>{query}</span>
              {focused && <span className="theseus-terminal-cursor" />}
            </>
          ) : focused ? (
            <span className="theseus-terminal-cursor" />
          ) : (
            <span style={{ color: 'var(--vie-text-dim)' }}>hello world</span>
          )}
        </div>
      </form>
    </div>
  );
}
