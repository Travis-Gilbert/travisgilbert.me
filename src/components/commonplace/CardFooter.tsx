'use client';

import type { CSSProperties } from 'react';

/**
 * CardFooter: shared bottom row for all ObjectCard types.
 *
 * Layout (flex row):
 *   [optional tag pill]  [spacer]  [edge graph icon + count]  [timestamp]
 *
 * Typography: Courier Prime 9.5px, --cp-text-faint throughout.
 */

interface CardFooterProps {
  capturedAt: string;
  edgeCount: number;
  /** First tag from the object's tag list, if any */
  firstTag?: string;
  /** Type accent color, used for the tag pill border */
  typeColor: string;
}

export default function CardFooter({
  capturedAt,
  edgeCount,
  firstTag,
  typeColor,
}: CardFooterProps) {
  const monoStyle: CSSProperties = {
    fontFamily: 'var(--cp-font-mono)',
    fontSize: 9.5,
    color: 'var(--cp-text-faint)',
    letterSpacing: '0.04em',
    lineHeight: 1,
  };

  return (
    <div
      className="cp-card-footer"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        marginTop: 8,
        paddingTop: 6,
        borderTop: '1px solid var(--cp-border-faint)',
      }}
    >
      {firstTag && (
        <span
          className="cp-card-tag-pill"
          style={{
            ...monoStyle,
            padding: '1px 5px',
            border: `1px solid ${typeColor}40`,
            borderRadius: 2,
            color: typeColor,
            opacity: 0.75,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            fontSize: 8,
            flexShrink: 0,
          }}
        >
          {firstTag}
        </span>
      )}

      {/* Spacer */}
      <span style={{ flex: 1 }} />

      {edgeCount > 0 && (
        <span
          className="cp-card-edge-count"
          style={{
            ...monoStyle,
            display: 'flex',
            alignItems: 'center',
            gap: 3,
          }}
        >
          {/* Minimal graph icon: two dots connected by a line */}
          <svg
            width={10}
            height={10}
            viewBox="0 0 10 10"
            fill="none"
            aria-hidden="true"
          >
            <circle cx={2} cy={5} r={1.5} fill="var(--cp-text-faint)" />
            <circle cx={8} cy={2} r={1.2} fill="var(--cp-text-faint)" />
            <circle cx={8} cy={8} r={1.2} fill="var(--cp-text-faint)" />
            <line x1={2} y1={5} x2={8} y2={2} stroke="var(--cp-text-faint)" strokeWidth={0.8} />
            <line x1={2} y1={5} x2={8} y2={8} stroke="var(--cp-text-faint)" strokeWidth={0.8} />
          </svg>
          {edgeCount}
        </span>
      )}

      <time
        dateTime={capturedAt}
        style={monoStyle}
      >
        {formatDate(capturedAt)}
      </time>
    </div>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: '2-digit',
  });
}
