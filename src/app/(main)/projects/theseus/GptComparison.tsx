'use client';

import { useState } from 'react';
import { COMPARISONS } from './theseus-data';

export default function GptComparison() {
  const [activeIdx, setActiveIdx] = useState(0);
  const active = COMPARISONS[activeIdx];

  return (
    <div>
      {/* Prompt cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
        {COMPARISONS.map((c, i) => (
          <button
            key={i}
            onClick={() => setActiveIdx(i)}
            className="text-left theseus-prompt-btn"
            style={{
              background: 'rgba(180, 90, 45, 0.04)',
              border: '1px solid var(--color-terracotta)',
              borderRadius: 6,
              padding: '14px',
              fontSize: 13,
              color: 'var(--color-ink-muted)',
              lineHeight: 1.55,
              cursor: 'pointer',
              transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s',
              boxShadow: i === activeIdx
                ? 'inset 0 0 12px rgba(180, 90, 45, 0.12), 0 2px 8px rgba(180, 90, 45, 0.08)'
                : 'inset 0 0 8px rgba(180, 90, 45, 0.06)',
              opacity: i === activeIdx ? 1 : 0.75,
            }}
          >
            <span
              style={{
                fontFamily: 'var(--font-code)',
                fontSize: 9,
                fontWeight: 600,
                letterSpacing: '0.1em',
                textTransform: 'uppercase' as const,
                color: 'var(--color-terracotta)',
                display: 'block',
                marginBottom: 6,
              }}
            >
              Prompt {i + 1}
            </span>
            {c.prompt}
          </button>
        ))}
      </div>

      {/* Comparison panel */}
      <div
        style={{
          background: 'var(--color-theseus-panel)',
          border: '1px solid var(--color-terracotta)',
          borderRadius: 10,
          overflow: 'hidden',
          boxShadow: 'inset 0 0 16px rgba(180, 90, 45, 0.06), 0 4px 20px rgba(0, 0, 0, 0.08)',
        }}
      >
        {/* Two columns on desktop, stacked on mobile */}
        <div className="theseus-compare-body">
          {/* Current AI section */}
          <div className="theseus-compare-col">
            <div className="theseus-compare-header">Current AI</div>
            <div style={{ padding: 24, fontSize: 14, lineHeight: 1.65, color: 'var(--color-ink)' }}>
              {active.gptResponse.map((line, i) => (
                <div
                  key={`gpt-${activeIdx}-${i}`}
                  className="theseus-response-line"
                  style={{ animationDelay: `${i * 80}ms` }}
                  // Safe: content is hardcoded in theseus-data.ts, not user-supplied
                  dangerouslySetInnerHTML={{ __html: line }}
                />
              ))}
            </div>
          </div>

          {/* Theseus section */}
          <div className="theseus-compare-col">
            <div className="theseus-compare-header">Theseus</div>
            <div style={{ padding: 24, fontSize: 14, lineHeight: 1.65, color: 'var(--color-ink)' }}>
              {active.theseusResponse.map((line, i) => (
                <div
                  key={`theseus-${activeIdx}-${i}`}
                  className="theseus-response-line"
                  style={{ animationDelay: `${i * 80 + 100}ms` }}
                  // Safe: content is hardcoded in theseus-data.ts, not user-supplied
                  dangerouslySetInnerHTML={{ __html: line }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes theseus-line-in {
          to { opacity: 1; transform: translateY(0); }
        }
        .theseus-response-line {
          margin-bottom: 10px;
          opacity: 0;
          transform: translateY(6px);
          animation: theseus-line-in 0.3s ease forwards;
        }
        .theseus-prompt-btn:hover {
          transform: translateY(-2px);
          box-shadow: inset 0 0 14px rgba(180, 90, 45, 0.15), 0 4px 12px rgba(180, 90, 45, 0.12) !important;
          opacity: 1 !important;
        }
        .theseus-compare-body {
          display: flex;
        }
        .theseus-compare-col {
          flex: 1;
        }
        .theseus-compare-col:first-child {
          border-right: 1px solid rgba(180, 90, 45, 0.2);
        }
        .theseus-compare-header {
          padding: 16px 20px;
          font-family: var(--font-code);
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          text-align: center;
          color: var(--color-ink-muted);
          border-bottom: 1px solid rgba(180, 90, 45, 0.2);
        }
        @media (max-width: 700px) {
          .theseus-compare-body {
            flex-direction: column;
          }
          .theseus-compare-col:first-child {
            border-right: none;
            border-bottom: 1px solid rgba(180, 90, 45, 0.2);
          }
        }
      `}</style>
    </div>
  );
}
