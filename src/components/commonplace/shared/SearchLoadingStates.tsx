'use client';

import type { CSSProperties } from 'react';

type SearchState = 'loading' | 'empty' | 'error' | 'rate-limited';

interface SearchLoadingStatesProps {
  state: SearchState;
  query?: string;
  onRetry?: () => void;
}

const containerStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '24px 16px',
  gap: 8,
  color: 'var(--cp-text-muted)',
  fontFamily: 'var(--font-metadata)',
  fontSize: 12,
  textAlign: 'center',
};

function SkeletonCard() {
  return (
    <div
      style={{
        height: 56,
        borderRadius: 6,
        backgroundColor: 'var(--cp-surface)',
        margin: '4px 8px',
      }}
    >
      <div
        style={{
          height: 12,
          width: '60%',
          borderRadius: 3,
          backgroundColor: 'var(--cp-surface-hover)',
          margin: '10px 10px 6px',
        }}
      />
      <div
        style={{
          height: 10,
          width: '40%',
          borderRadius: 3,
          backgroundColor: 'var(--cp-surface-hover)',
          margin: '0 10px',
        }}
      />
    </div>
  );
}

export default function SearchLoadingStates({
  state,
  query,
  onRetry,
}: SearchLoadingStatesProps) {
  switch (state) {
    case 'loading':
      return (
        <div>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      );

    case 'empty':
      return (
        <div style={containerStyle}>
          <span>No results for &quot;{query}&quot;</span>
          <span style={{ color: 'var(--cp-text-faint)', fontSize: 11 }}>
            Try different keywords.
          </span>
        </div>
      );

    case 'error':
      return (
        <div style={containerStyle}>
          <span>Search unavailable.</span>
          {onRetry && (
            <button
              onClick={onRetry}
              style={{
                padding: '4px 12px',
                borderRadius: 4,
                border: '1px solid var(--cp-chrome-line)',
                backgroundColor: 'transparent',
                color: 'var(--cp-teal)',
                cursor: 'pointer',
                fontFamily: 'var(--font-metadata)',
                fontSize: 11,
                marginTop: 4,
              }}
            >
              Retry
            </button>
          )}
        </div>
      );

    case 'rate-limited':
      return (
        <div style={containerStyle}>
          <span>Search limit reached.</span>
          <span style={{ color: 'var(--cp-text-faint)', fontSize: 11 }}>
            Try again in a few minutes.
          </span>
        </div>
      );
  }
}
