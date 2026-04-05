'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { useGalaxy } from '@/components/theseus/TheseusShell';

const STARTER_QUERIES = [
  'What connects Shannon to Hamming?',
  'What unresolved tensions are active?',
  'What am I missing about GNNs?',
  'What new clusters formed this week?',
];

export default function TheseusHomepage() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { gridRef, setAskState } = useGalaxy();

  function submitQuery(nextQuery: string) {
    const trimmed = nextQuery.trim();
    if (!trimmed) return;

    setAskState('THINKING');

    const grid = gridRef.current;
    if (grid) {
      const { width, height } = grid.getSize();
      const cx = width / 2;
      const cy = height * 0.4;
      const count = grid.getDotCount();
      for (let i = 0; i < count; i++) {
        const pos = grid.getDotPosition(i);
        if (!pos) continue;
        const tx = pos.x + (cx - pos.x) * 0.3;
        const ty = pos.y + (cy - pos.y) * 0.3;
        grid.setDotTarget(i, tx, ty);
      }
      grid.wakeAnimation();
    }

    window.setTimeout(() => {
      router.push(`/theseus/ask?q=${encodeURIComponent(trimmed)}`);
    }, 250);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    submitQuery(query);
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
      <div style={{ height: '26vh', flexShrink: 0 }} />

      <header
        style={{
          textAlign: 'center',
          marginBottom: 18,
          pointerEvents: 'auto',
        }}
      >
        <h1
          style={{
            fontFamily: 'var(--font-vollkorn-sc), Georgia, serif',
            fontSize: 28,
            fontWeight: 600,
            color: '#3D8A96',
            margin: 0,
            lineHeight: 1.1,
            letterSpacing: '0.08em',
          }}
        >
          THESEUS
        </h1>
        <p
          style={{
            margin: '10px 0 0',
            fontFamily: 'var(--vie-font-body)',
            fontSize: 14,
            color: 'var(--vie-text-dim)',
          }}
        >
          What are you curious about?
        </p>
      </header>

      <form
        onSubmit={handleSubmit}
        style={{
          width: '100%',
          maxWidth: '480px',
          flexShrink: 0,
          position: 'relative',
          pointerEvents: 'auto',
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
          name="theseus_query"
          autoComplete="off"
          spellCheck={false}
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
            fontFamily: 'var(--vie-font-body)',
            background: 'rgba(0,0,0,0.25)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '10px',
            boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.4), inset 0 0 0 1px rgba(0,0,0,0.15)',
            color: 'var(--vie-text)',
            transition: 'border-color 200ms ease, box-shadow 200ms ease',
            boxSizing: 'border-box',
            letterSpacing: '0.04em',
            display: 'flex',
            alignItems: 'center',
            cursor: 'text',
            overflow: 'hidden',
            whiteSpace: 'nowrap',
          }}
        >
          {query.length > 0 ? (
            <>
              <span style={{ whiteSpace: 'pre' }}>{query}</span>
              {focused && <span className="theseus-terminal-cursor" />}
            </>
          ) : (
            <>
              {focused && <span className="theseus-terminal-cursor" />}
              <span style={{ color: 'var(--vie-text-dim)' }}>Ask Theseus...</span>
            </>
          )}
        </div>
      </form>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: 8,
          width: '100%',
          maxWidth: 680,
          marginTop: 14,
          pointerEvents: 'auto',
        }}
      >
        {STARTER_QUERIES.map((starter) => (
          <button
            key={starter}
            type="button"
            onClick={() => submitQuery(starter)}
            style={{
              borderRadius: 999,
              border: '1px solid rgba(255,255,255,0.08)',
              background: 'rgba(255,255,255,0.04)',
              color: 'var(--vie-text-muted)',
              fontFamily: 'var(--vie-font-body)',
              fontSize: 12,
              lineHeight: 1,
              padding: '8px 12px',
              cursor: 'pointer',
            }}
          >
            {starter}
          </button>
        ))}
      </div>
    </div>
  );
}
