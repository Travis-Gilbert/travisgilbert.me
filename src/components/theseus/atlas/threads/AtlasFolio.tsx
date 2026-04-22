'use client';

import { type CSSProperties, type ReactNode } from 'react';

export interface AtlasFolioSidenote {
  ref: number;
  /** Category / block label, e.g. "CORRESPONDENCE", "PAPER", "NOTE". */
  kind: string;
  /** Source chip: the integration that produced the sidenote. */
  source?: { id: string; label: string; color: string };
  /** Short title of the sidenote (un-italicized display serif). */
  title: string;
  /** Body quote or description of the sidenote. */
  body: string;
}

export interface AtlasFolioProps {
  /** Folio index + total, rendered top-right of the folio metadata strip. */
  index: number;
  total: number;
  /** Eyebrow line: `Threads · NOV 14 · 14:02` etc. */
  meta: string;
  /** User's question (display serif, big). */
  question: string;
  /** Model responder line, e.g. "THESEUS · 31B". */
  responder?: string;
  /** Response body. May contain inline numbered citations rendered by
   *  the caller; we just lay out the paper folio chrome. */
  children: ReactNode;
  /** Optional action cluster rendered below the response body. */
  actions?: ReactNode;
  /** Whether the response has completed — drives the signoff + actions
   *  visibility. Streaming folios hide the signoff. */
  complete?: boolean;
  /** Whether this folio is the active one (controls the accent colour of
   *  the left pencil-red line). */
  active?: boolean;
  /** DOM id used by the folio rail to scroll into view. */
  domId?: string;
}

const folioFrameStyle: CSSProperties = {
  position: 'relative',
  padding: '0 0 0 36px',
  marginBottom: 64,
};
const folioAccentStyle: CSSProperties = {
  position: 'absolute',
  left: 0,
  top: 0,
  bottom: 0,
  width: 2,
  background: 'var(--paper-pencil)',
  opacity: 0.85,
};

/**
 * Atlas folio — renders a single question/answer pair as a paper letter.
 * Structure matches the Atlas reference:
 *   metadata strip (meta · folio N of M)
 *   ── horizontal rule ──
 *   YOU WROTE eyebrow
 *   Vollkorn question (not italicized, matches ui-ux choice)
 *   THESEUS · 31B responder line
 *   body (paragraphs with inline citation refs, provided by caller)
 *   action cluster (Open in Explorer / Trace Citations / Pin Folio / etc.)
 *   signoff
 */
export default function AtlasFolio({
  index,
  total,
  meta,
  question,
  responder = 'Theseus · 31B',
  children,
  actions,
  complete = false,
  active = false,
  domId,
}: AtlasFolioProps) {
  return (
    <article id={domId} style={folioFrameStyle}>
      <span aria-hidden style={{ ...folioAccentStyle, opacity: active ? 0.95 : 0.35 }} />

      <header
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          paddingBottom: 14,
          borderBottom: '1px solid var(--paper-rule)',
          marginBottom: 22,
          gap: 18,
        }}
      >
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 22,
            fontWeight: 500,
            letterSpacing: '-0.005em',
            color: 'var(--paper-ink)',
          }}
        >
          {meta}
        </div>
        <div
          style={{
            font: '500 10px/1 var(--font-mono)',
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color: 'var(--paper-ink-3)',
            whiteSpace: 'nowrap',
          }}
        >
          Folio {index} of {total}
        </div>
      </header>

      <div
        style={{
          font: '500 10px/1 var(--font-mono)',
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          color: 'var(--paper-pencil)',
          marginBottom: 12,
        }}
      >
        You wrote
      </div>
      <h1
        style={{
          margin: '0 0 28px',
          fontFamily: 'var(--font-display)',
          fontWeight: 500,
          fontSize: 40,
          lineHeight: 1.15,
          letterSpacing: '-0.015em',
          color: 'var(--paper-ink)',
        }}
      >
        {question}
      </h1>

      <div
        style={{
          font: '500 10px/1 var(--font-mono)',
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: 'var(--paper-ink-3)',
          marginBottom: 16,
        }}
      >
        {responder}
      </div>

      <div
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: 17,
          lineHeight: 1.6,
          color: 'var(--paper-ink)',
        }}
      >
        {children}
      </div>

      {complete && actions && (
        <div
          style={{
            marginTop: 28,
            paddingTop: 20,
            borderTop: '1px dashed var(--paper-rule)',
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
          }}
        >
          {actions}
        </div>
      )}

      {complete && (
        <div
          style={{
            marginTop: 22,
            fontFamily: 'var(--font-display)',
            fontSize: 18,
            color: 'var(--paper-ink-2)',
          }}
        >
          — yours, Θ
        </div>
      )}
    </article>
  );
}

/**
 * Small inline citation marker — `[n]` pencil-red pill used inside
 * response paragraphs. Clicking scrolls the matching sidenote into
 * view (handled by the surface).
 */
export function CitationRef({ n, onClick }: { n: number; onClick?: (n: number) => void }) {
  return (
    <button
      type="button"
      onClick={() => onClick?.(n)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 18,
        height: 18,
        padding: '0 5px',
        marginInline: '0 2px',
        verticalAlign: 'baseline',
        background: 'var(--paper-pencil)',
        color: 'var(--paper)',
        border: 'none',
        borderRadius: 2,
        font: '600 10px/1 var(--font-mono)',
        letterSpacing: '0.02em',
        cursor: onClick ? 'pointer' : 'default',
      }}
      aria-label={`Sidenote ${n}`}
    >
      {n}
    </button>
  );
}

/** Mono-bordered action button rendered in the folio action cluster. */
export function FolioAction({
  label,
  onClick,
  primary = false,
  disabled = false,
  title,
}: {
  label: string;
  onClick?: () => void;
  primary?: boolean;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        all: 'unset',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        padding: '7px 14px',
        font: '500 10px/1 var(--font-mono)',
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        border: `1px solid ${primary ? 'var(--paper-pencil)' : 'var(--paper-rule)'}`,
        color: primary ? 'var(--paper-pencil)' : 'var(--paper-ink-2)',
        borderRadius: 2,
      }}
    >
      {label}
    </button>
  );
}
