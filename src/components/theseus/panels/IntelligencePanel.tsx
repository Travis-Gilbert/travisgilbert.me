'use client';

import type { CSSProperties } from 'react';
import { useSwitchPanel } from '../PanelManager';

// Mobile Shell 2.0 (2026-04-28): the in-panel Intelligence galaxy view
// was repurposed as the public /theseus landing. The panel slot now
// renders a deprecation card so old deep links (?view=intelligence)
// still resolve, with two clear next steps. The galaxy explainer code
// is preserved at src/components/theseus/intelligence/GalaxyExplainer
// for the landing page to consume.

const cardStyle: CSSProperties = {
  maxWidth: 520,
  margin: '64px auto',
  padding: '28px 32px',
  border: '1px dashed var(--rule)',
  borderRadius: 6,
  background: 'var(--panel)',
  display: 'flex',
  flexDirection: 'column',
  gap: 14,
};

const eyebrowStyle: CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 10,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: 'var(--brass, #c9a23a)',
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontFamily: 'var(--font-display)',
  fontSize: 24,
  fontWeight: 500,
  color: 'var(--ink)',
  letterSpacing: '-0.005em',
};

const bodyStyle: CSSProperties = {
  margin: 0,
  fontFamily: 'var(--font-body)',
  fontSize: 14,
  lineHeight: 1.55,
  color: 'var(--ink-2)',
};

const ctaRow: CSSProperties = {
  display: 'flex',
  gap: 10,
  marginTop: 6,
  flexWrap: 'wrap',
};

const ctaStyle: CSSProperties = {
  all: 'unset',
  cursor: 'pointer',
  padding: '8px 16px',
  border: '1px solid var(--rule-strong)',
  borderRadius: 4,
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'var(--ink)',
};

export default function IntelligencePanel() {
  const switchPanel = useSwitchPanel();
  return (
    <div
      style={{
        height: '100%',
        background: 'var(--app-base)',
        overflowY: 'auto',
        padding: 24,
      }}
    >
      <article style={cardStyle}>
        <div style={eyebrowStyle}>Moved</div>
        <h2 style={titleStyle}>Intelligence is now the public landing.</h2>
        <p style={bodyStyle}>
          The galaxy explainer that used to live in this panel is now the
          public <code>/theseus</code> page so anyone can see what the
          engine does without signing in. The two surfaces below cover
          everything that was here.
        </p>
        <div style={ctaRow}>
          <button
            type="button"
            style={ctaStyle}
            onClick={() => switchPanel('plugins')}
          >
            See Plugins
          </button>
          <button
            type="button"
            style={ctaStyle}
            onClick={() => switchPanel('code')}
          >
            See Code
          </button>
          <a
            href="/theseus"
            style={{ ...ctaStyle, display: 'inline-flex' }}
          >
            Open landing
          </a>
        </div>
      </article>
    </div>
  );
}
