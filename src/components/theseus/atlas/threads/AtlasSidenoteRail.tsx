'use client';

import type { AtlasFolioSidenote } from './AtlasFolio';

interface AtlasSidenoteRailProps {
  /** All sidenotes for the active folio(s). */
  sidenotes: AtlasFolioSidenote[];
}

/**
 * Right-column rail that stacks numbered sidenotes matching the `[n]`
 * citation refs inside the folio body. Paper background continues from
 * the folio surface; cards are separated by dashed rules.
 */
export default function AtlasSidenoteRail({ sidenotes }: AtlasSidenoteRailProps) {
  if (sidenotes.length === 0) return null;

  return (
    <aside
      aria-label="Sidenotes"
      style={{
        position: 'sticky',
        top: 32,
        alignSelf: 'start',
        paddingInlineStart: 8,
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
      }}
    >
      {sidenotes.map((sn, i) => (
        <div
          key={`${sn.ref}-${i}`}
          id={`sidenote-${sn.ref}`}
          style={{
            paddingTop: i === 0 ? 0 : 20,
            borderTop: i === 0 ? 'none' : '1px dashed var(--paper-rule)',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          <header
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              flexWrap: 'wrap',
            }}
          >
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: 18,
                height: 18,
                padding: '0 5px',
                background: 'var(--paper-pencil)',
                color: 'var(--paper)',
                borderRadius: 2,
                font: '600 10px/1 var(--font-mono)',
              }}
            >
              {sn.ref}
            </span>
            <span
              style={{
                font: '500 10px/1 var(--font-mono)',
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
                color: 'var(--paper-pencil)',
              }}
            >
              {sn.kind}
            </span>
            {sn.source && (
              <span
                style={{
                  marginLeft: 'auto',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  font: '500 10px/1 var(--font-mono)',
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  color: 'var(--paper-ink-3)',
                }}
              >
                <span
                  aria-hidden
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: sn.source.color,
                  }}
                />
                {sn.source.label}
              </span>
            )}
          </header>
          <div
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 14,
              fontWeight: 500,
              color: 'var(--paper-ink)',
            }}
          >
            {sn.title}
          </div>
          <div
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 13,
              lineHeight: 1.5,
              color: 'var(--paper-ink-2)',
            }}
          >
            {sn.body}
          </div>
        </div>
      ))}
    </aside>
  );
}
