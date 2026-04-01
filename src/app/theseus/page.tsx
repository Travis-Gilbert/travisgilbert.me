'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { SuggestionPills } from '@/components/theseus/SuggestionPills';
import { ProactiveIntel } from '@/components/theseus/ProactiveIntel';

export default function TheseusHomepage() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    router.push(`/theseus/ask?q=${encodeURIComponent(trimmed)}`);
  }

  function handlePillSelect(text: string) {
    setQuery(text);
    // Submit immediately
    router.push(`/theseus/ask?q=${encodeURIComponent(text)}`);
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        height: '100%',
        paddingTop: '40vh',
        padding: '0 24px',
        boxSizing: 'border-box',
      }}
    >
      {/* Push search bar to ~40% from top */}
      <div style={{ height: '40vh', flexShrink: 0 }} />

      <form
        onSubmit={handleSubmit}
        style={{
          width: '100%',
          maxWidth: '400px',
          flexShrink: 0,
        }}
      >
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ask Theseus anything..."
          autoFocus
          style={{
            width: '100%',
            height: '44px',
            padding: '0 16px',
            fontSize: '15px',
            fontFamily: 'var(--vie-font-body)',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(45,95,107,0.3)',
            borderRadius: '10px',
            color: 'var(--vie-text)',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
      </form>

      {/* 24px gap to suggestion pills */}
      <div style={{ marginTop: '24px', width: '100%', maxWidth: '400px' }}>
        <SuggestionPills onSelect={handlePillSelect} />
      </div>

      {/* 40px gap to proactive intel */}
      <div style={{ marginTop: '40px' }}>
        <ProactiveIntel />
      </div>
    </div>
  );
}
