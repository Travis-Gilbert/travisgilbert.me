'use client';

import { useState } from 'react';
import { ENGINE_PASSES, INTELLIGENCE_LEVELS, STACK_TAGS } from './theseus-data';

export default function EngineTerminal() {
  const [activePass, setActivePass] = useState<number | null>(null);

  return (
    <div>
      {/* Terminal panel */}
      <div
        style={{
          background: '#1A1C22',
          borderRadius: 10,
          overflow: 'hidden',
          boxShadow: '0 4px 24px rgba(0,0,0,0.2)',
          marginBottom: 40,
        }}
      >
        {/* Title bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '12px 16px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: '#FF5F56',
            }}
          />
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: '#FFBD2E',
            }}
          />
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: '#27C93F',
            }}
          />
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 10,
              color: 'rgba(255,255,255,0.35)',
              marginLeft: 8,
              letterSpacing: '0.06em',
            }}
          >
            theseus / connection-engine
          </span>
        </div>

        {/* Pass rows */}
        <div style={{ padding: '8px 0' }}>
          {ENGINE_PASSES.map((pass) => {
            const isActive = activePass === pass.num;
            return (
              <div key={pass.num}>
                <button
                  onClick={() =>
                    setActivePass(isActive ? null : pass.num)
                  }
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    width: '100%',
                    padding: '10px 16px',
                    background: isActive
                      ? 'rgba(196, 80, 60, 0.08)'
                      : 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'background 0.15s',
                  }}
                >
                  {/* Indicator dot */}
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: isActive
                        ? '#C4503C'
                        : 'rgba(255,255,255,0.2)',
                      boxShadow: isActive
                        ? '0 0 8px rgba(196,80,60,0.5)'
                        : 'none',
                      flexShrink: 0,
                    }}
                  />

                  {/* Pass number */}
                  <span
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 10,
                      fontWeight: 600,
                      color: isActive
                        ? '#C4503C'
                        : 'rgba(255,255,255,0.4)',
                      width: 24,
                      flexShrink: 0,
                    }}
                  >
                    {pass.num}
                  </span>

                  {/* Name */}
                  <span
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 12,
                      fontWeight: 500,
                      color: isActive
                        ? 'rgba(255,255,255,0.9)'
                        : 'rgba(255,255,255,0.55)',
                      flex: 1,
                    }}
                  >
                    {pass.name}
                  </span>

                  {/* Tool */}
                  <span
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 10,
                      color: 'rgba(255,255,255,0.25)',
                      flexShrink: 0,
                    }}
                  >
                    {pass.tool}
                  </span>
                </button>

                {/* Detail (expanded) */}
                {isActive && (
                  <div
                    style={{
                      padding: '8px 16px 14px 54px',
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 11,
                      lineHeight: 1.6,
                      color: 'rgba(255,255,255,0.5)',
                    }}
                  >
                    {pass.detail}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Intelligence levels */}
      <h3
        className="font-title text-xl font-bold mb-4"
        style={{ color: 'var(--color-ink)' }}
      >
        Eight Levels of Intelligence
      </h3>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: 12,
          marginBottom: 32,
        }}
      >
        {INTELLIGENCE_LEVELS.map((lvl) => (
          <div
            key={lvl.level}
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 6,
              padding: '14px 16px',
            }}
          >
            <span
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--color-terracotta)',
                display: 'block',
                marginBottom: 4,
              }}
            >
              L{lvl.level}
            </span>
            <span
              className="font-title"
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: 'var(--color-ink)',
                display: 'block',
                marginBottom: 4,
              }}
            >
              {lvl.name}
            </span>
            <span
              style={{
                fontSize: 12,
                color: 'var(--color-ink-muted)',
                lineHeight: 1.5,
              }}
            >
              {lvl.desc}
            </span>
          </div>
        ))}
      </div>

      {/* Compute architecture */}
      <p
        style={{
          fontSize: 13,
          color: 'var(--color-ink-muted)',
          lineHeight: 1.7,
          marginBottom: 20,
          maxWidth: 660,
        }}
      >
        The engine runs in two modes. Railway hosts the web service with ONNX Runtime
        for fast inference (no PyTorch). Modal dispatches GPU workloads: LoRA fine-tuning,
        GNN training, KGE embedding. PostgreSQL with pgvector stores embeddings; PostGIS
        handles spatial queries. Redis + RQ manages three task queues.
      </p>

      {/* Stack tags */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {STACK_TAGS.map((tag) => (
          <span
            key={tag}
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 10,
              fontWeight: 500,
              padding: '4px 10px',
              border: '1px solid var(--color-border)',
              borderRadius: 4,
              color: 'var(--color-ink-muted)',
              background: 'var(--color-surface)',
              letterSpacing: '0.03em',
            }}
          >
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}
