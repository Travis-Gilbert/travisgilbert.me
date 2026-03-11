'use client';

import type { MockNode } from '@/lib/commonplace';

interface LineageSwimlaneProps {
  nodes: MockNode[];
  onOpenObject?: (objectRef: number) => void;
}

function ChainArrow() {
  return (
    <svg
      width={18}
      height={10}
      viewBox="0 0 18 10"
      fill="none"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      <line x1={0} y1={5} x2={12} y2={5} stroke="var(--cp-border)" strokeWidth={1} />
      <polyline
        points="9,1.5 13,5 9,8.5"
        stroke="var(--cp-chrome-dim)"
        strokeWidth={1}
        fill="none"
      />
    </svg>
  );
}

export default function LineageSwimlane({ nodes, onOpenObject }: LineageSwimlaneProps) {
  if (nodes.length === 0) return null;

  const chain = nodes.slice(0, 7);

  return (
    <div style={{ marginBottom: 20 }}>
      <div
        style={{
          fontFamily: 'var(--cp-font-mono)',
          fontSize: 9,
          fontWeight: 700,
          color: 'var(--cp-chrome-muted)',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          marginBottom: 8,
        }}
      >
        Recent Chain
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'stretch',
          overflowX: 'auto',
          paddingBottom: 4,
          scrollbarWidth: 'none',
        }}
      >
        {chain.map((node, i) => (
          <div
            key={node.id}
            style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}
          >
            <button
              type="button"
              onClick={() => onOpenObject?.(node.objectRef)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 3,
                padding: '7px 11px',
                background: 'var(--cp-surface)',
                border: '1px solid var(--cp-border)',
                borderRadius: 4,
                cursor: 'pointer',
                textAlign: 'left',
                minWidth: 100,
                maxWidth: 160,
                transition: 'border-color 120ms ease',
              }}
              className="cp-lineage-node"
            >
              <span
                style={{
                  fontFamily: 'var(--cp-font-mono)',
                  fontSize: 8,
                  fontWeight: 700,
                  color: 'var(--cp-accent)',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {node.objectType}
              </span>
              <span
                style={{
                  fontFamily: 'var(--cp-font-title)',
                  fontSize: 12,
                  fontWeight: 500,
                  color: 'var(--cp-text)',
                  lineHeight: 1.3,
                  fontFeatureSettings: 'var(--cp-kern-title)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {node.title}
              </span>
            </button>
            {i < chain.length - 1 && <ChainArrow />}
          </div>
        ))}
      </div>
    </div>
  );
}
