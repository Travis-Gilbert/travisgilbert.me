'use client';

import { useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import type { FC } from 'react';

export interface CitationSegment {
  kind: 'citation';
  source: string;
  year: number;
  confidence: number;
  anchor: string;
}

export type InlineSegment =
  | { kind: 'text'; value: string }
  | CitationSegment;

/**
 * Parse `[CITE:source:year:confidence]anchor text[/CITE]` anchors out of a
 * plain text block. Non-matching text flows through as text segments.
 * Accepts a missing confidence (falls back to 0).
 */
const CITE_RE = /\[CITE:([^:\]]+):(\d+)(?::([0-9.]+))?\]([\s\S]*?)\[\/CITE\]/g;

export function parseCitations(text: string): InlineSegment[] {
  if (!text) return [{ kind: 'text', value: '' }];
  const segments: InlineSegment[] = [];
  let cursor = 0;
  for (const match of text.matchAll(CITE_RE)) {
    const start = match.index ?? 0;
    if (start > cursor) {
      segments.push({ kind: 'text', value: text.slice(cursor, start) });
    }
    const year = Number.parseInt(match[2], 10);
    const confidence = match[3] ? Number.parseFloat(match[3]) : 0;
    segments.push({
      kind: 'citation',
      source: match[1],
      year: Number.isFinite(year) ? year : 0,
      confidence: Number.isFinite(confidence) ? confidence : 0,
      anchor: match[4],
    });
    cursor = start + match[0].length;
  }
  if (cursor < text.length) {
    segments.push({ kind: 'text', value: text.slice(cursor) });
  }
  if (segments.length === 0) return [{ kind: 'text', value: text }];
  return segments;
}

interface CitationPartProps {
  source: string;
  year: number;
  confidence: number;
  anchor: string;
}

/**
 * Inline citation span: dotted terracotta underline, superscript source
 * index, Radix Popover hover card with source/year/confidence metadata.
 */
const CitationPart: FC<CitationPartProps> = ({ source, year, confidence, anchor }) => {
  const [open, setOpen] = useState(false);
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <span
          role="button"
          tabIndex={0}
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          aria-label={`Citation: ${source}, ${year}`}
          className="aui-citation"
          style={{
            borderBottom: '1px dotted var(--color-terracotta)',
            cursor: 'help',
            color: 'inherit',
            textDecoration: 'none',
          }}
        >
          {anchor}
          <sup
            style={{
              marginLeft: 2,
              fontFamily: 'var(--font-mono)',
              fontSize: '0.7em',
              color: 'var(--color-terracotta)',
            }}
          >
            {source}
          </sup>
        </span>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          sideOffset={6}
          className="aui-citation-card"
          style={{
            background: 'var(--color-surface)',
            color: 'var(--color-ink)',
            border: '1px solid var(--color-border)',
            boxShadow: 'var(--shadow-warm)',
            borderRadius: 6,
            padding: '10px 12px',
            fontFamily: 'var(--font-body)',
            fontSize: 13,
            maxWidth: 320,
            zIndex: 60,
          }}
        >
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: 'var(--color-ink-light)',
              marginBottom: 4,
            }}
          >
            {source} · {year} · confidence {confidence.toFixed(2)}
          </div>
          <div>{anchor}</div>
          <Popover.Arrow style={{ fill: 'var(--color-terracotta)' }} />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
};

export default CitationPart;
