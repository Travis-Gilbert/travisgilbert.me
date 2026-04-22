'use client';

import { useState, type CSSProperties } from 'react';
import { ATLAS_SOURCES } from '../atlas/sources';

/**
 * Atlas Connections panel.
 *
 * Matches the reference layout from the Atlas prototype: warm-dark
 * topbar with `+ Add source` / `SDK docs` affordances, then a paper
 * content area split into a 340px source list on the left and a detail
 * pane on the right. Paper ink tokens are scoped to the content area
 * via inline CSS custom properties so child elements inherit paper
 * colours without rewriting the shared sidebar tokens.
 *
 * The source-detail content is intentionally honest: item counts,
 * sync timestamps, and status pills are not rendered because the real
 * source-registry backend isn't wired yet. Per the no-fake-UI rule, we
 * show each source's concept (name + kind + description) and nothing
 * that looks like live data. `+ Add source` is a disabled button until
 * that pipeline lands.
 */
export default function ConnectionsPanel() {
  const [activeId, setActiveId] = useState<string>(ATLAS_SOURCES[0]?.id ?? '');
  const active = ATLAS_SOURCES.find((s) => s.id === activeId) ?? ATLAS_SOURCES[0];

  const paperTokens: CSSProperties & Record<string, string> = {
    background: 'var(--paper)',
    color: 'var(--paper-ink)',
    ['--ink']: 'var(--paper-ink)',
    ['--ink-2']: 'var(--paper-ink-2)',
    ['--ink-3']: 'var(--paper-ink-3)',
    ['--rule']: 'var(--paper-rule)',
    ['--rule-strong']: '#a89d8f',
    ['--accent-color']: 'var(--paper-pencil)',
    ['--pencil']: 'var(--paper-pencil)',
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        background: 'var(--app-base)',
      }}
    >
      <div className="atlas-topbar">
        <div className="atlas-crumbs">
          Connections
          <span className="sep">/</span>
          <span className="active">sources</span>
        </div>
        <div className="atlas-tools">
          <button
            type="button"
            className="atlas-tool"
            disabled
            aria-disabled="true"
            title="Source registry backend not connected yet"
            style={{ opacity: 0.45, cursor: 'not-allowed' }}
          >
            + Add source
          </button>
        </div>
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'grid',
          gridTemplateColumns: '340px 1fr',
          ...paperTokens,
        }}
      >
        {/* Source list */}
        <div
          style={{
            borderRight: '1px solid var(--rule)',
            padding: '28px 22px',
            overflowY: 'auto',
          }}
        >
          <div className="eyebrow" style={{ marginBottom: 14 }}>
            In registry · {ATLAS_SOURCES.length}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {ATLAS_SOURCES.map((s) => {
              const isActive = activeId === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setActiveId(s.id)}
                  style={{
                    all: 'unset',
                    cursor: 'pointer',
                    display: 'grid',
                    gridTemplateColumns: '14px 1fr',
                    gap: 10,
                    padding: '12px 8px',
                    borderLeft: isActive
                      ? '2px solid var(--pencil)'
                      : '2px solid transparent',
                    background: isActive ? 'var(--paper-2)' : 'transparent',
                  }}
                >
                  <span
                    aria-hidden
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      background: s.color,
                      marginTop: 8,
                    }}
                  />
                  <div>
                    <div
                      style={{
                        fontFamily: 'var(--font-body)',
                        fontSize: 17,
                        fontWeight: 500,
                        color: isActive ? 'var(--ink)' : 'var(--ink-2)',
                      }}
                    >
                      {s.name}
                    </div>
                    <div
                      style={{
                        font: '500 10px/1.4 var(--font-mono)',
                        letterSpacing: '0.1em',
                        textTransform: 'uppercase',
                        color: 'var(--ink-3)',
                        marginTop: 4,
                      }}
                    >
                      {s.kind}
                    </div>
                  </div>
                </button>
              );
            })}

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '14px 1fr',
                gap: 10,
                padding: '12px 8px',
                marginTop: 8,
                borderTop: '1px dashed var(--rule)',
                color: 'var(--ink-3)',
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 14,
                  paddingTop: 2,
                }}
              >
                +
              </span>
              <div>
                <div style={{ fontFamily: 'var(--font-body)', fontSize: 17, fontWeight: 400 }}>
                  Add source
                </div>
                <div className="eyebrow" style={{ marginTop: 4 }}>
                  backend not connected yet
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Detail */}
        <div
          style={{
            overflowY: 'auto',
            padding: '36px 36px 48px',
            display: 'flex',
            flexDirection: 'column',
            gap: 18,
          }}
        >
          {active && (
            <>
              <div>
                <div className="eyebrow">{active.kind}</div>
                <h2
                  style={{
                    margin: '6px 0 0',
                    fontFamily: 'var(--font-display)',
                    fontSize: 36,
                    fontWeight: 500,
                    color: 'var(--ink)',
                    letterSpacing: '-0.01em',
                  }}
                >
                  {active.name}
                </h2>
              </div>
              <p
                style={{
                  margin: 0,
                  maxWidth: 640,
                  fontFamily: 'var(--font-body)',
                  fontSize: 15,
                  lineHeight: 1.55,
                  color: 'var(--ink-2)',
                }}
              >
                {active.detail}
              </p>

              <div
                style={{
                  marginTop: 14,
                  padding: '16px 18px',
                  border: '1px dashed var(--rule)',
                  borderRadius: 4,
                  maxWidth: 640,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}
              >
                <div className="eyebrow">Status</div>
                <div
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: 14,
                    color: 'var(--ink)',
                  }}
                >
                  Not connected
                </div>
                <div
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: 13,
                    lineHeight: 1.5,
                    color: 'var(--ink-3)',
                  }}
                >
                  This source will sync into Theseus once the OAuth &amp; ingest
                  pipeline lands. Until then, captured items still flow through
                  the drop-anywhere file ingest.
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
