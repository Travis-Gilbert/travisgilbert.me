'use client';

import type { FC } from 'react';
import { dispatchTheseusEvent } from '@/lib/theseus/events';

export interface NodeDetailData {
  id: string;
  label: string;
  type: string;
  description?: string;
  pagerank?: number;
  community?: number | null;
  confidence?: number;
  degree?: number;
}

interface NodeDetailPanelProps {
  node: NodeDetailData | null;
  onClose?: () => void;
}

const TYPE_LABELS: Record<string, string> = {
  source: 'Source',
  person: 'Person',
  concept: 'Concept',
  claim: 'Claim',
  hunch: 'Hunch',
  tension: 'Tension',
  note: 'Note',
};

/**
 * Right-rail detail panel. Shows type badge, title, description, metadata
 * grid, and two actions: "Ask about this" fires prefill-ask and switches
 * to the chat panel; "Open in Notebook" switches panel.
 */
const NodeDetailPanel: FC<NodeDetailPanelProps> = ({ node, onClose }) => {
  if (!node) {
    return (
      <aside
        role="complementary"
        aria-label="Node detail"
        className="vie-node-detail-panel"
        style={{
          background: 'var(--color-theseus-panel)',
          borderLeft: '1px solid var(--color-border)',
          height: '100%',
          width: 460,
          padding: '24px',
          overflowY: 'auto',
          fontFamily: 'var(--font-body)',
          color: 'var(--color-ink-muted)',
        }}
      >
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
          }}
        >
          No node selected
        </div>
        <p style={{ marginTop: 12, fontSize: 14, lineHeight: 1.6 }}>
          Click a point in the graph to see its details, neighbourhood, and
          follow-up actions.
        </p>
      </aside>
    );
  }

  const typeLabel = TYPE_LABELS[node.type] ?? node.type;

  const askAbout = () => {
    dispatchTheseusEvent('theseus:switch-panel', { panel: 'ask', source: 'node-action' });
    window.requestAnimationFrame(() => {
      dispatchTheseusEvent('theseus:prefill-ask', {
        text: `Tell me about ${node.label}.`,
        submit: true,
        context: { nodeId: node.id },
      });
    });
  };

  const openInNotebook = () => {
    dispatchTheseusEvent('theseus:switch-panel', { panel: 'notebook', source: 'node-action' });
  };

  return (
    <aside
      role="complementary"
      aria-label={`Node detail: ${node.label}`}
      className="vie-node-detail-panel"
      style={{
        background: 'var(--color-theseus-panel)',
        borderLeft: '1px solid var(--color-border)',
        height: '100%',
        width: 460,
        padding: '24px',
        overflowY: 'auto',
        fontFamily: 'var(--font-body)',
        color: 'var(--color-ink)',
        boxShadow: 'var(--shadow-warm)',
      }}
    >
      <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div
            style={{
              display: 'inline-block',
              padding: '2px 8px',
              background: `color-mix(in srgb, var(--vie-type-${node.type}) 20%, transparent)`,
              color: `var(--vie-type-${node.type})`,
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              borderRadius: 3,
            }}
          >
            {typeLabel}
          </div>
          <h2
            style={{
              fontFamily: 'var(--font-title)',
              fontSize: 22,
              margin: '8px 0 0',
              lineHeight: 1.2,
            }}
          >
            {node.label}
          </h2>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close detail"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--color-ink-muted)',
              fontSize: 20,
              cursor: 'pointer',
            }}
          >
            ×
          </button>
        )}
      </header>

      {node.description && (
        <p
          style={{
            marginTop: 16,
            fontSize: 14,
            lineHeight: 1.6,
            color: 'var(--color-ink-muted)',
          }}
        >
          {node.description}
        </p>
      )}

      <dl
        style={{
          marginTop: 20,
          display: 'grid',
          gridTemplateColumns: 'auto 1fr',
          columnGap: 12,
          rowGap: 6,
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--color-ink-muted)',
        }}
      >
        <dt>Degree</dt>
        <dd>{node.degree ?? 'n/a'}</dd>
        <dt>PageRank</dt>
        <dd>{node.pagerank !== undefined ? node.pagerank.toFixed(3) : 'n/a'}</dd>
        <dt>Confidence</dt>
        <dd>{node.confidence !== undefined ? node.confidence.toFixed(2) : 'n/a'}</dd>
        <dt>Cluster</dt>
        <dd>{node.community ?? 'n/a'}</dd>
      </dl>

      <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button
          type="button"
          onClick={askAbout}
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            padding: '10px 14px',
            border: '1px solid var(--color-terracotta)',
            background: 'var(--color-terracotta)',
            color: '#FBF0E2',
            borderRadius: 4,
            cursor: 'pointer',
          }}
        >
          Ask about this
        </button>
        <button
          type="button"
          onClick={openInNotebook}
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            padding: '10px 14px',
            border: '1px solid var(--color-border)',
            background: 'var(--color-surface)',
            color: 'var(--color-ink)',
            borderRadius: 4,
            cursor: 'pointer',
          }}
        >
          Open in Notebook
        </button>
      </div>
    </aside>
  );
};

export default NodeDetailPanel;
