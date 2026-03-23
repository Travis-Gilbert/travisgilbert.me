'use client';

import { wobblePath } from '@/lib/prng';
import type { SchematicData, SchematicColor } from './readme-data';
import { SCHEMATIC_COLOR_MAP, SCHEMATIC_COLOR_LIGHT } from './readme-data';

interface SchematicTreeProps {
  data: SchematicData;
  variant: 'full' | 'mini';
  isVisible?: boolean;
}

// ── Connector SVG for full variant ───────────────────────────────

function WobbleConnector({
  seed,
  color,
}: {
  seed: number;
  color: SchematicColor;
}) {
  const w = 16;
  const h = 22;
  const midY = h / 2;
  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      style={{ flexShrink: 0, overflow: 'visible' }}
      aria-hidden="true"
    >
      {/* Vertical line from top to midpoint */}
      <path
        d={wobblePath(8, 0, 8, midY, seed)}
        fill="none"
        stroke="var(--color-connector)"
        strokeWidth={0.7}
        opacity={0.5}
      />
      {/* Horizontal line from midpoint to end */}
      <path
        d={wobblePath(8, midY, w - 1, midY, seed + 113)}
        fill="none"
        stroke={SCHEMATIC_COLOR_MAP[color]}
        strokeWidth={0.7}
        opacity={0.4}
      />
    </svg>
  );
}

// ── Complexity pips ──────────────────────────────────────────────

function ComplexityPips({
  level,
  variant,
  accentColor,
}: {
  level: number;
  variant: 'full' | 'mini';
  accentColor: string;
}) {
  const pipW = variant === 'full' ? 12 : 8;
  const pipH = variant === 'full' ? 3 : 2;
  return (
    <div style={{ display: 'flex', gap: variant === 'full' ? '2px' : '1px', alignItems: 'center' }}>
      {Array.from({ length: 5 }, (_, i) => (
        <div
          key={i}
          style={{
            width: `${pipW}px`,
            height: `${pipH}px`,
            borderRadius: '1px',
            background:
              i < level
                ? accentColor
                : variant === 'full'
                  ? 'var(--color-readme-border)'
                  : 'var(--color-patent-border)',
          }}
        />
      ))}
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────

export default function SchematicTree({
  data,
  variant,
  isVisible = true,
}: SchematicTreeProps) {
  const isFull = variant === 'full';

  // Build a flat render list: sections interleaved with their rows
  type RenderItem =
    | { type: 'section'; sectionIndex: number }
    | { type: 'row'; rowIndex: number };

  const items: RenderItem[] = [];
  let rowCursor = 0;

  for (let si = 0; si < data.sections.length; si++) {
    items.push({ type: 'section', sectionIndex: si });
    const section = data.sections[si];
    const nextSection = data.sections[si + 1];

    // Collect rows belonging to this section (matching color, or until next section color)
    while (rowCursor < data.rows.length) {
      const row = data.rows[rowCursor];
      // If the next section exists and this row matches the next section color, stop
      if (nextSection && row.color === nextSection.color && row.color !== section.color) {
        break;
      }
      items.push({ type: 'row', rowIndex: rowCursor });
      rowCursor++;
      // If the next row has a different color and matches the next section, stop
      if (
        rowCursor < data.rows.length &&
        nextSection &&
        data.rows[rowCursor].color === nextSection.color &&
        data.rows[rowCursor].color !== section.color
      ) {
        break;
      }
    }
  }

  let staggerIndex = 0;

  return (
    <div>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: isFull ? '8px' : '4px',
          marginBottom: isFull ? '16px' : '6px',
          paddingBottom: isFull ? '10px' : '4px',
          borderBottom: `1px solid ${isFull ? 'var(--color-readme-border)' : 'var(--color-patent-border)'}`,
        }}
      >
        <div
          style={{
            width: isFull ? '3px' : '2px',
            height: isFull ? '18px' : '10px',
            borderRadius: '1px',
            background: data.accentColor,
          }}
        />
        <span
          style={{
            fontFamily: 'var(--font-code)',
            fontSize: isFull ? '12px' : '8px',
            fontWeight: 600,
            textTransform: 'uppercase' as const,
            letterSpacing: '0.1em',
            color: data.accentColor,
          }}
        >
          {data.title}
        </span>
        {data.subtitle && (
          <span
            style={{
              fontFamily: 'var(--font-code)',
              fontSize: isFull ? '9px' : '7px',
              color: isFull ? 'var(--color-readme-text-dim)' : 'var(--color-patent-text-tertiary)',
              marginLeft: 'auto',
              letterSpacing: '0.04em',
            }}
          >
            {data.subtitle}
          </span>
        )}
      </div>

      {/* Sections + Rows */}
      {items.map((item) => {
        if (item.type === 'section') {
          const section = data.sections[item.sectionIndex];
          const currentStagger = staggerIndex++;
          const delay = isFull ? currentStagger * 0.04 : 0;

          return (
            <div
              key={`sec-${item.sectionIndex}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: isFull ? '6px' : '3px',
                margin: isFull
                  ? item.sectionIndex === 0
                    ? '0 0 4px'
                    : '10px 0 4px'
                  : item.sectionIndex === 0
                    ? '0 0 2px'
                    : '4px 0 2px',
                opacity: isFull ? (isVisible ? 1 : 0) : 1,
                transform: isFull
                  ? isVisible
                    ? 'none'
                    : 'translateY(5px)'
                  : 'none',
                transition: isFull
                  ? `opacity 0.3s ease ${delay}s, transform 0.3s ease ${delay}s`
                  : 'none',
              }}
            >
              <div
                style={{
                  width: isFull ? '2px' : '1.5px',
                  height: isFull ? '14px' : '8px',
                  borderRadius: '1px',
                  background: SCHEMATIC_COLOR_MAP[section.color],
                }}
              />
              <span
                style={{
                  fontFamily: 'var(--font-code)',
                  fontSize: isFull ? '10px' : '7.5px',
                  fontWeight: 600,
                  letterSpacing: '0.08em',
                  color: SCHEMATIC_COLOR_LIGHT[section.color],
                }}
              >
                {section.label}
              </span>
              {section.sub && (
                <span
                  style={{
                    fontFamily: 'var(--font-code)',
                    fontSize: isFull ? '9px' : '6.5px',
                    color: isFull
                      ? 'var(--color-readme-text-dim)'
                      : 'var(--color-patent-text-tertiary)',
                  }}
                >
                  {section.sub}
                </span>
              )}
            </div>
          );
        }

        // Row
        const row = data.rows[item.rowIndex];
        const currentStagger = staggerIndex++;
        const delay = isFull ? currentStagger * 0.04 : 0;
        const isRedacted = row.redacted;

        return (
          <div
            key={`row-${item.rowIndex}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              height: isFull ? '22px' : '14px',
              opacity: isFull ? (isVisible ? 1 : 0) : 1,
              transform: isFull
                ? isVisible
                  ? 'none'
                  : 'translateY(5px)'
                : 'none',
              transition: isFull
                ? `opacity 0.25s ease ${delay}s, transform 0.25s ease ${delay}s`
                : 'none',
            }}
          >
            {/* Wobble connector (full variant only) */}
            {isFull && (
              <WobbleConnector
                seed={item.rowIndex * 200 + data.id.charCodeAt(0)}
                color={row.color}
              />
            )}
            <span
              style={{
                fontFamily: 'var(--font-code)',
                fontSize: isFull ? '11px' : '8px',
                whiteSpace: 'nowrap' as const,
                flexShrink: 0,
                color: isRedacted
                  ? isFull
                    ? 'var(--color-readme-text-dim)'
                    : 'var(--color-patent-text-tertiary)'
                  : SCHEMATIC_COLOR_LIGHT[row.color],
              }}
            >
              {row.name}
            </span>
            {row.comment && (
              <span
                style={{
                  fontFamily: 'var(--font-code)',
                  fontSize: isFull ? '9px' : '7px',
                  color: isFull
                    ? 'var(--color-readme-text-dim)'
                    : 'var(--color-patent-text-tertiary)',
                  marginLeft: isFull ? '8px' : '4px',
                  whiteSpace: 'nowrap' as const,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  textDecoration: isRedacted ? 'line-through' : 'none',
                  opacity: isRedacted ? 0.5 : 1,
                }}
              >
                {row.comment}
              </span>
            )}
          </div>
        );
      })}

      {/* Footer */}
      <div
        style={{
          marginTop: isFull ? '14px' : '4px',
          paddingTop: isFull ? '10px' : '3px',
          borderTop: `1px solid ${isFull ? 'var(--color-readme-border)' : 'var(--color-patent-border)'}`,
          fontFamily: 'var(--font-code)',
          fontSize: isFull ? '9px' : '7px',
          color: isFull ? 'var(--color-readme-text-dim)' : 'var(--color-patent-text-tertiary)',
          display: 'flex',
          justifyContent: 'space-between',
          opacity: isFull ? (isVisible ? 0.6 : 0) : 1,
          transition: isFull
            ? `opacity 0.4s ease ${staggerIndex * 0.04 + 0.15}s`
            : 'none',
        }}
      >
        <span>{data.footerLeft}</span>
        <ComplexityPips
          level={data.complexityLevel}
          variant={variant}
          accentColor={data.accentColor}
        />
      </div>
    </div>
  );
}
