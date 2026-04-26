'use client';

/**
 * LensNodeSwitcher: top-right pill in the Tier 3 Lens close-read
 * view that lets the reader cycle prev / current / next without
 * leaving the Lens (ADR 0003 paragraph 47, ADR 0011).
 *
 * `related` is the ordered list of 1-hop neighbors from the
 * lens-focus payload. `current` is the focused Object's id. We do
 * not fetch from a new endpoint; we reuse the `neighbors` array
 * already on the page and cycle through it. When `related` is
 * empty we render nothing (CLAUDE.md "Empty states are honest").
 *
 * Optional `edgeMeta` lets the switcher print the human display
 * label and epistemic role for the prev / next edge slug, drawing
 * from the `loadEdgeTypeMeta()` cache primed by GraphLegend.
 */

import type { EdgeTypeMeta } from './edgeTypeMeta';

interface RelatedNode {
  id: string;
  title: string;
  kind: string;
  edgeType?: string;
}

interface Props {
  current: string;
  related: RelatedNode[];
  edgeMeta?: Map<string, EdgeTypeMeta>;
}

const NAV_STYLE: React.CSSProperties = {
  position: 'absolute',
  top: 16,
  right: 16,
  display: 'flex',
  gap: 8,
  alignItems: 'center',
  padding: '6px 10px',
  background: 'color-mix(in oklab, var(--paper) 92%, transparent)',
  border: '1px solid color-mix(in oklab, var(--paper-pencil) 30%, transparent)',
  borderRadius: 999,
  fontFamily: 'var(--font-body)',
  color: 'var(--paper-ink)',
  fontSize: 12,
};

const BUTTON_STYLE: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: 'var(--paper-ink)',
  cursor: 'pointer',
  padding: '2px 6px',
  fontFamily: 'var(--font-body)',
  fontSize: 12,
  maxWidth: 140,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const ROLE_PIP_STYLE: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 9,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  opacity: 0.6,
  marginRight: 4,
};

function pushNode(id: string) {
  const url = new URL(window.location.href);
  url.searchParams.set('view', 'lens');
  url.searchParams.set('node', id);
  window.history.pushState({}, '', url.toString());
  window.dispatchEvent(
    new CustomEvent('theseus:switch-panel', { detail: { panel: 'lens' } }),
  );
}

function rolePipFor(
  edgeType: string | undefined,
  edgeMeta: Map<string, EdgeTypeMeta> | undefined,
): string | null {
  if (!edgeType || !edgeMeta) return null;
  const meta = edgeMeta.get(edgeType);
  return meta ? meta.epistemic_role : null;
}

export default function LensNodeSwitcher({ current, related, edgeMeta }: Props) {
  if (related.length === 0) return null;
  const idx = related.findIndex((n) => n.id === current);
  const prev = idx > 0 ? related[idx - 1] : related[related.length - 1];
  const next = idx >= 0 && idx < related.length - 1 ? related[idx + 1] : related[0];
  const currentTitle = related[idx]?.title ?? current;
  const prevPip = rolePipFor(prev.edgeType, edgeMeta);
  const nextPip = rolePipFor(next.edgeType, edgeMeta);
  return (
    <nav className="lens-node-switcher" style={NAV_STYLE} aria-label="Switch focused node">
      <button
        type="button"
        onClick={() => pushNode(prev.id)}
        aria-label={`Previous: ${prev.title}`}
        style={BUTTON_STYLE}
      >
        {prevPip ? <span style={ROLE_PIP_STYLE}>{prevPip}</span> : null}
        {prev.title}
      </button>
      <span aria-current="true" style={{ opacity: 0.85, fontWeight: 600 }}>
        {currentTitle}
      </span>
      <button
        type="button"
        onClick={() => pushNode(next.id)}
        aria-label={`Next: ${next.title}`}
        style={BUTTON_STYLE}
      >
        {nextPip ? <span style={ROLE_PIP_STYLE}>{nextPip}</span> : null}
        {next.title}
      </button>
    </nav>
  );
}
