'use client';

import type { NodeDetailData } from '../NodeDetailPanel';
import { dispatchTheseusEvent } from '@/lib/theseus/events';

interface AtlasNodeDetailProps {
  node: NodeDetailData;
  onClose: () => void;
}

const TYPE_LABELS: Record<string, string> = {
  source: 'Source',
  person: 'Person',
  concept: 'Concept',
  claim: 'Claim',
  hunch: 'Hunch',
  tension: 'Tension',
  note: 'Note',
  code: 'Code',
  paper: 'Paper',
  finding: 'Finding',
};

/**
 * Atlas parchment-glass node detail popover — floats top-right over the
 * canvas. Preserves the NodeDetailData shape from the original
 * NodeDetailPanel; only the surface treatment changes.
 */
export default function AtlasNodeDetail({ node, onClose }: AtlasNodeDetailProps) {
  const kind = node.type.toLowerCase();
  const kindLabel = TYPE_LABELS[kind] ?? kind;

  const meta: Array<{ k: string; v: string | number | null | undefined }> = [
    { k: 'Kind', v: kindLabel },
    { k: 'ID', v: node.id },
    { k: 'Degree', v: node.degree },
    { k: 'Confidence', v: node.confidence != null ? node.confidence.toFixed(2) : undefined },
    { k: 'Community', v: node.community },
    { k: 'PageRank', v: node.pagerank != null ? node.pagerank.toFixed(3) : undefined },
  ].filter((r) => r.v != null && r.v !== '');

  function handleAsk() {
    dispatchTheseusEvent('theseus:switch-panel', { panel: 'ask', source: 'node-action' });
    requestAnimationFrame(() => {
      dispatchTheseusEvent('theseus:prefill-ask', {
        text: `Tell me more about ${node.label}.`,
        context: { nodeId: node.id },
      });
    });
  }

  function handleOpenNotebook() {
    dispatchTheseusEvent('theseus:switch-panel', { panel: 'notebook', source: 'node-action' });
  }

  return (
    <aside
      className="parchment-glass"
      role="complementary"
      aria-label="Node detail"
      style={{
        position: 'absolute',
        top: 14,
        right: 14,
        zIndex: 4,
        width: 340,
        maxHeight: 'calc(100% - 260px)',
        overflowY: 'auto',
        borderRadius: 5,
        padding: '16px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 10,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div
            style={{
              font: '500 10px/1 var(--font-mono)',
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              color: 'var(--paper-pencil)',
            }}
          >
            Selection · {kindLabel}
          </div>
          <h3
            style={{
              margin: 0,
              fontFamily: 'var(--font-display)',
              fontWeight: 500,
              fontSize: 22,
              letterSpacing: '-0.01em',
              lineHeight: 1.15,
              color: 'var(--paper-ink)',
            }}
          >
            {node.label}
          </h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close node detail"
          style={{
            border: 0,
            background: 'transparent',
            cursor: 'pointer',
            color: 'var(--paper-ink-3)',
            font: '500 16px/1 var(--font-mono)',
            padding: 0,
          }}
        >
          ×
        </button>
      </div>

      {node.description && (
        <p
          style={{
            margin: 0,
            fontFamily: 'var(--font-body)',
            fontSize: 14,
            lineHeight: 1.55,
            color: 'var(--paper-ink-2)',
          }}
        >
          {node.description}
        </p>
      )}

      {meta.length > 0 && (
        <dl
          style={{
            display: 'grid',
            gridTemplateColumns: '90px 1fr',
            gap: '6px 12px',
            margin: 0,
            paddingTop: 10,
            borderTop: '1px dashed var(--paper-rule)',
          }}
        >
          {meta.map((row) => (
            <div key={row.k} style={{ display: 'contents' }}>
              <dt
                style={{
                  font: '500 10px/1 var(--font-mono)',
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  color: 'var(--paper-ink-3)',
                }}
              >
                {row.k}
              </dt>
              <dd
                style={{
                  margin: 0,
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  color: 'var(--paper-ink)',
                  letterSpacing: '0.02em',
                }}
              >
                {row.v}
              </dd>
            </div>
          ))}
        </dl>
      )}

      <div
        style={{
          paddingTop: 10,
          borderTop: '1px dashed var(--paper-rule)',
          display: 'flex',
          flexWrap: 'wrap',
          gap: 6,
        }}
      >
        <button
          type="button"
          onClick={handleAsk}
          style={{
            all: 'unset',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '5px 10px',
            font: '500 10px/1 var(--font-mono)',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            border: '1px solid var(--paper-pencil)',
            color: 'var(--paper-pencil)',
            borderRadius: 2,
          }}
        >
          Ask about this ↵
        </button>
        <button
          type="button"
          onClick={handleOpenNotebook}
          style={{
            all: 'unset',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '5px 10px',
            font: '500 10px/1 var(--font-mono)',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            border: '1px solid var(--paper-rule)',
            color: 'var(--paper-ink-2)',
            borderRadius: 2,
          }}
        >
          Open in Notebook
        </button>
      </div>
    </aside>
  );
}
