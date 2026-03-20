'use client';

import { useState } from 'react';
import { DOMAINS } from './theseus-data';

export default function DomainCards() {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: 14,
      }}
    >
      {DOMAINS.map((d) => {
        const isOpen = openId === d.id;
        return (
          <button
            key={d.id}
            onClick={() => setOpenId(isOpen ? null : d.id)}
            className="text-left"
            style={{
              background: `${d.color}14`,
              border: '1px solid var(--color-border)',
              borderRadius: 8,
              borderTopWidth: 3,
              borderTopColor: d.color,
              padding: '20px 18px',
              cursor: 'pointer',
              transition: 'box-shadow 0.2s, border-color 0.2s, transform 0.2s',
              boxShadow: isOpen ? 'var(--shadow-warm)' : 'none',
            }}
          >
            {/* Domain tag */}
            <span
              style={{
                fontFamily: 'var(--font-code)',
                fontSize: 9,
                fontWeight: 600,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: d.color,
                display: 'block',
                marginBottom: 8,
              }}
            >
              {d.domain}
            </span>

            {/* Title */}
            <span
              style={{
                fontFamily: 'var(--font-title)',
                fontSize: 17,
                fontWeight: 700,
                color: 'var(--color-ink)',
                display: 'block',
                marginBottom: 8,
                lineHeight: 1.3,
              }}
            >
              {d.title}
            </span>

            {/* Teaser */}
            <span
              style={{
                fontSize: 13,
                color: 'var(--color-ink-muted)',
                lineHeight: 1.55,
                display: 'block',
              }}
            >
              {d.teaser}
            </span>

            {/* Expanded content */}
            {isOpen && (
              <div style={{ marginTop: 16 }}>
                <p
                  style={{
                    fontSize: 13,
                    color: 'var(--color-ink-muted)',
                    lineHeight: 1.65,
                    marginBottom: 14,
                  }}
                >
                  {d.scenario}
                </p>

                {/* Outcome bar */}
                <div
                  style={{
                    background: 'rgba(180, 90, 45, 0.06)',
                    borderRadius: 5,
                    padding: '10px 12px',
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'var(--font-code)',
                      fontSize: 9,
                      fontWeight: 600,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      color: 'var(--color-terracotta)',
                      display: 'block',
                      marginBottom: 4,
                    }}
                  >
                    Outcome
                  </span>
                  <span
                    style={{
                      fontSize: 13,
                      color: 'var(--color-ink)',
                      lineHeight: 1.55,
                    }}
                  >
                    {d.outcome}
                  </span>
                </div>
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
