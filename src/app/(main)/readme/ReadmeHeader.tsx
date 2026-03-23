'use client';

import { BADGES, TAGLINE, TAGLINE_SUB } from './readme-data';
import type { ReadmeBadge } from './readme-data';

const BADGE_STYLES: Record<
  ReadmeBadge['color'],
  { color: string; bg: string; border: string; dot: string }
> = {
  green: {
    color: '#6FCF97',
    bg: 'rgba(111,207,151,0.1)',
    border: 'rgba(111,207,151,0.2)',
    dot: '#6FCF97',
  },
  teal: {
    color: '#6BC5D8',
    bg: 'rgba(107,197,216,0.1)',
    border: 'rgba(107,197,216,0.2)',
    dot: '#6BC5D8',
  },
  terracotta: {
    color: 'var(--color-terracotta-light)',
    bg: 'rgba(180,90,45,0.1)',
    border: 'rgba(180,90,45,0.2)',
    dot: 'var(--color-terracotta-light)',
  },
};

export default function ReadmeHeader() {
  return (
    <header
      style={{
        paddingTop: '64px',
        paddingBottom: 0,
        color: 'var(--color-readme-text)',
      }}
    >
      {/* File tab */}
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          fontFamily: 'var(--font-code)',
          fontSize: '12px',
          fontWeight: 500,
          color: 'var(--color-readme-text-dim)',
          background: 'var(--color-readme-bg-soft)',
          border: '1px solid var(--color-readme-border)',
          borderBottomColor: 'var(--color-readme-bg)',
          borderRadius: '6px 6px 0 0',
          padding: '8px 16px',
          marginBottom: '-1px',
        }}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="currentColor"
          style={{ opacity: 0.5 }}
          aria-hidden="true"
        >
          <path d="M2 1.75C2 .784 2.784 0 3.75 0h6.586c.464 0 .909.184 1.237.513l2.914 2.914c.329.328.513.773.513 1.237v9.586A1.75 1.75 0 0 1 13.25 16h-9.5A1.75 1.75 0 0 1 2 14.25Zm1.75-.25a.25.25 0 0 0-.25.25v12.5c0 .138.112.25.25.25h9.5a.25.25 0 0 0 .25-.25V6h-2.75A1.75 1.75 0 0 1 9 4.25V1.5Zm6.75.062V4.25c0 .138.112.25.25.25h2.688l-.011-.013-2.914-2.914-.013-.011Z" />
        </svg>
        README.md
      </div>

      {/* Header content */}
      <div
        style={{
          borderTop: '1px solid var(--color-readme-border)',
          paddingTop: '28px',
        }}
      >
        <h1
          className="readme-name"
          style={{
            fontFamily: 'var(--font-title)',
            fontSize: '42px',
            fontWeight: 700,
            lineHeight: 1.1,
            marginBottom: '6px',
            color: 'var(--color-readme-text)',
          }}
        >
          Travis Gilbert{' '}
          <span
            className="readme-ver-tag"
            style={{
              fontFamily: 'var(--font-code)',
              fontSize: '13px',
              fontWeight: 400,
              color: 'var(--color-readme-text-dim)',
              marginLeft: '10px',
            }}
          >
            v26, Flint, MI
          </span>
        </h1>

        <p
          style={{
            fontSize: '16px',
            color: 'var(--color-readme-text-muted)',
            marginBottom: '22px',
            maxWidth: '500px',
            lineHeight: 1.55,
            fontFamily: 'var(--font-body)',
          }}
        >
          {TAGLINE}
        </p>

        {/* Badge row */}
        <div
          style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '8px' }}
        >
          {BADGES.map((badge) => {
            const s = BADGE_STYLES[badge.color];
            return (
              <span
                key={badge.label}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  fontFamily: 'var(--font-code)',
                  fontSize: '11px',
                  fontWeight: 500,
                  padding: '4px 10px',
                  borderRadius: '4px',
                  color: s.color,
                  background: s.bg,
                  border: `1px solid ${s.border}`,
                }}
              >
                <span
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: s.dot,
                  }}
                />
                {badge.label}: {badge.value}
              </span>
            );
          })}
        </div>
      </div>

      {/* Sub-line */}
      <p
        style={{
          paddingTop: '20px',
          fontFamily: 'var(--font-body)',
          fontSize: '13px',
          color: 'var(--color-readme-text-dim)',
        }}
      >
        {TAGLINE_SUB}
      </p>
    </header>
  );
}
