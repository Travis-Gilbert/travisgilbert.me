'use client';

/**
 * GraphTooltip: shared hover tooltip for all D3 graph visualizations.
 *
 * Renders as an absolutely positioned div near the hovered node.
 * Parent graph container must have position: relative.
 *
 * Theme-adaptive via className prop:
 *   (none)              main site tokens (--color-paper, --font-metadata)
 *   "commonplace-theme" CommonPlace tokens (--cp-surface, --cp-font-body)
 *   "studio-theme"      Studio tokens (--studio-surface, --studio-font)
 *
 * Each graph passes its own position calculation (accounting for zoom transforms,
 * node radius offsets, etc). This component only handles rendering.
 */

import { SIGNAL_COLORS } from '@/lib/graph/colors';

export interface GraphTooltipProps {
  /** Primary label (node title) */
  title: string;
  /** Secondary label (content type, object type, etc.) */
  subtitle?: string;
  /** Detail lines (explanation text, connection counts, etc.) */
  lines?: string[];
  /** Signal indicators: colored dots with labels */
  signals?: Array<{ name: string; color: string }>;
  /** Absolute position within the graph container */
  position: { x: number; y: number };
  /** Whether the tooltip is visible */
  visible: boolean;
  /** Theme class for cross-route-group styling */
  className?: string;
}

export default function GraphTooltip({
  title,
  subtitle,
  lines,
  signals,
  position,
  visible,
  className,
}: GraphTooltipProps) {
  if (!visible) return null;

  return (
    <div
      className={className}
      style={{
        position: 'absolute',
        left: position.x,
        top: position.y,
        transform: 'translateX(-50%)',
        pointerEvents: 'none',
        zIndex: 10,
      }}
    >
      <div
        style={{
          background: 'var(--color-paper, var(--cp-surface, #F5F0E8))',
          border: '1px solid var(--color-border-light, var(--cp-border, #D4C4B0))',
          borderRadius: 6,
          padding: '6px 10px',
          fontFamily: 'var(--font-metadata, var(--cp-font-body, monospace))',
          fontSize: 11,
          color: 'var(--color-ink, var(--cp-text, #3A3632))',
          boxShadow: '0 2px 8px rgba(26, 22, 20, 0.15)',
          maxWidth: 280,
          whiteSpace: 'normal',
        }}
      >
        {/* Title */}
        <div style={{ fontWeight: 600, marginBottom: subtitle || lines?.length ? 2 : 0 }}>
          {title}
        </div>

        {/* Subtitle (type label) */}
        {subtitle && (
          <div
            style={{
              fontSize: 9,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              opacity: 0.6,
              marginBottom: lines?.length ? 4 : 0,
            }}
          >
            {subtitle}
          </div>
        )}

        {/* Detail lines (explanation, connection info) */}
        {lines && lines.length > 0 && (
          <div style={{ marginTop: 2 }}>
            {lines.map((line, i) => (
              <div
                key={i}
                style={{
                  fontSize: 10,
                  opacity: 0.75,
                  lineHeight: 1.4,
                }}
              >
                {line}
              </div>
            ))}
          </div>
        )}

        {/* Signal dots */}
        {signals && signals.length > 0 && (
          <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
            {signals.map((sig) => (
              <div
                key={sig.name}
                style={{ display: 'flex', alignItems: 'center', gap: 3 }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: sig.color,
                    display: 'inline-block',
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    fontSize: 8,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    opacity: 0.5,
                  }}
                >
                  {sig.name.replace('shared_', '').replace('_', ' ')}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Utility: build signal indicators from API signals object ────────

/**
 * Convert a signals record from the connection API into the signal indicator
 * format expected by GraphTooltip.
 */
export function buildSignalIndicators(
  signals: Record<string, { score: number; detail: string } | null>,
): Array<{ name: string; color: string }> {
  return Object.entries(signals)
    .filter(([, v]) => v !== null)
    .map(([key]) => ({
      name: key,
      color: SIGNAL_COLORS[key] ?? '#6A5E52',
    }));
}
