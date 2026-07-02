'use client';

/**
 * PreActionPreview (HANDOFF-CODE-SURFACE-UI D10): the quiet strip that shows
 * the pending browser action before it runs. This deliverable renders from
 * the ActionCandidate FIXTURE only; Approve/Skip just advance the list. The
 * real pre-action engine is another spec, which is why the strip carries a
 * visible "fixture" tag.
 */

import { useState } from 'react';
import { Keyboard, MousePointerClick, MoveVertical } from 'lucide-react';
import { ACTION_CANDIDATE_FIXTURE, type ActionCandidate } from './action-candidate.fixture';

const strip: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-3)',
  padding: 'var(--space-2) var(--space-3)',
  borderTop: 'var(--hairline)',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--text--1)',
  color: 'var(--text-dim)',
};

const selectorStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  color: 'var(--text)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const quietButton: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--text--1)',
  color: 'var(--text-dim)',
  background: 'none',
  border: 'none',
  padding: 0,
  cursor: 'pointer',
  textDecoration: 'underline',
};

const fixtureTag: React.CSSProperties = {
  fontSize: 'var(--text--2)',
  color: 'var(--text-faint)',
  marginLeft: 'auto',
};

const quietLine: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--text--1)',
  color: 'var(--text-faint)',
  padding: 'var(--space-2) var(--space-3)',
  borderTop: 'var(--hairline)',
};

export default function PreActionPreview() {
  const [index, setIndex] = useState(0);
  const candidate = ACTION_CANDIDATE_FIXTURE[index] ?? null;

  // Fixture exhausted: collapse to one quiet line, never a labeled box.
  if (!candidate) {
    return (
      <div style={quietLine}>
        no pending actions{' '}
        <span style={fixtureTag}>fixture</span>
      </div>
    );
  }

  const advance = () => setIndex((i) => i + 1);
  const Icon = iconFor(candidate);

  return (
    <div style={strip}>
      <Icon size="1em" aria-hidden style={{ color: 'var(--text-faint)', flexShrink: 0 }} />
      <code style={selectorStyle}>{candidate.selector}</code>
      <span>{candidate.label}</span>
      <span style={{ color: 'var(--text-faint)' }}>
        confidence {candidate.confidence.toFixed(2)}
      </span>
      <button type="button" style={quietButton} onClick={advance}>
        approve
      </button>
      <button type="button" style={quietButton} onClick={advance}>
        skip
      </button>
      <span style={fixtureTag}>fixture</span>
    </div>
  );
}

function iconFor(candidate: ActionCandidate) {
  switch (candidate.kind) {
    case 'type':
      return Keyboard;
    case 'scroll':
      return MoveVertical;
    case 'click':
    default:
      return MousePointerClick;
  }
}
