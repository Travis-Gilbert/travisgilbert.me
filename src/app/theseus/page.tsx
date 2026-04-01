'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function TheseusGalaxy() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);

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
        justifyContent: 'center',
        height: '100%',
        padding: '0 24px',
        fontFamily: 'var(--vie-font-body)',
      }}
    >
      <h1
        style={{
          fontFamily: 'var(--vie-font-title)',
          fontSize: '2.5rem',
          fontWeight: 500,
          color: 'var(--vie-text)',
          marginBottom: '8px',
        }}
      >
        Theseus
      </h1>
      <p
        style={{
          color: 'var(--vie-text-muted)',
          fontSize: '1rem',
          marginBottom: '48px',
          fontFamily: 'var(--vie-font-mono)',
        }}
      >
        Ask a question. See the model.
      </p>

      <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: '640px' }}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="What do you want to understand?"
          autoFocus
          style={{
            width: '100%',
            padding: '16px 24px',
            fontSize: '1.125rem',
            fontFamily: 'var(--vie-font-body)',
            background: 'var(--vie-card)',
            border: `1px solid var(${focused ? '--vie-border-active' : '--vie-border'})`,
            borderRadius: '12px',
            color: 'var(--vie-text)',
            outline: 'none',
            transition: 'border-color 0.2s',
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
      </form>
    </div>
  );
}
