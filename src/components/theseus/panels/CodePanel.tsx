'use client';

import Link from 'next/link';

/**
 * CodePanel: empty state for the Code surface inside the VIE shell.
 *
 * The richer CodeWorkshop scaffold (file tree, editor, agent ribbon, intel
 * panel) exists at src/components/theseus/code/CodeWorkshop.tsx but is not
 * backed by real code ingestion yet: its session hook (useCodeSession) runs
 * mock files, mock edits, and a setTimeout-driven fake agent loop. Shipping
 * that as the Code panel would be dishonest, so the panel renders this
 * empty state until the Code ingestion endpoints are wired.
 *
 * The /theseus/code route (CodeExplorer) is partially wired to real
 * endpoints and is the place to work on this feature.
 */
export default function CodePanel() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        width: '100%',
        padding: '48px 32px',
        gap: 16,
        fontFamily: 'var(--vie-font-mono, ui-monospace)',
        color: 'var(--vie-ink-2, #a09b93)',
        background: 'var(--vie-panel-bg, transparent)',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          fontFamily: 'var(--vie-font-mono, ui-monospace)',
          fontSize: 10.5,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: 'var(--vie-ink-3, #6b665d)',
        }}
      >
        Code intelligence
      </div>
      <h2
        style={{
          margin: 0,
          fontFamily: 'var(--vie-font-display, serif)',
          fontSize: 22,
          fontWeight: 400,
          color: 'var(--vie-ink-1, #e7e3da)',
        }}
      >
        No repository connected
      </h2>
      <p style={{ margin: 0, maxWidth: 440, fontSize: 13, lineHeight: 1.55 }}>
        The Code panel is not wired to a real ingestion backend yet. Open the
        graph-intelligence view to use the symbol/impact/drift endpoints that
        are connected, or ingest a repository from there.
      </p>
      <Link
        href="/theseus/code"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '8px 14px',
          borderRadius: 999,
          border: '1px solid var(--vie-border, rgba(255,255,255,0.12))',
          fontSize: 12,
          color: 'var(--vie-ink-1, #e7e3da)',
          textDecoration: 'none',
        }}
      >
        Open code graph view
      </Link>
    </div>
  );
}
