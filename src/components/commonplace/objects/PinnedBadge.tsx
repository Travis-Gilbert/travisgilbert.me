'use client';

import { getObjectTypeIdentity } from '@/lib/commonplace';

export interface PinnedBadgeObject {
  edge_id: number;
  object_id: number;
  slug: string;
  title: string;
  object_type: string;
  position?: 'badge' | 'inline' | 'sidebar';
  sort_order?: number;
}

interface PinnedBadgeProps {
  object: PinnedBadgeObject;
  edgeId: number;
  compact?: boolean;
  onDetach?: (edgeId: number) => void;
  onClick?: (slug: string) => void;
}

/**
 * Compact inline chip that renders any object type at badge scale.
 * Used in the Lego composition system: when an object is "pinned" to
 * a parent card, it appears as one of these badges below the card body.
 *
 * Each object type has a distinct badge treatment that preserves its
 * visual identity at miniature scale.
 */
export default function PinnedBadge({
  object,
  edgeId,
  compact = true,
  onDetach,
  onClick,
}: PinnedBadgeProps) {
  const typeId = getObjectTypeIdentity(object.object_type);
  const height = compact ? 22 : 28;
  const fontSize = compact ? 10 : 11;
  const isPill = object.object_type === 'person' || object.object_type === 'concept';
  const borderRadius = isPill ? 100 : 4;

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onDetach?.(edgeId);
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClick?.(object.slug);
  };

  return (
    <button
      type="button"
      className="cp-pinned-badge"
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      title={`${typeId.label}: ${object.title}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: compact ? 3 : 4,
        height,
        maxWidth: 180,
        padding: `0 ${compact ? 6 : 8}px`,
        borderRadius,
        border: `1px solid ${getBorderStyle(object.object_type, typeId.color)}`,
        borderStyle: object.object_type === 'hunch' ? 'dashed' : 'solid',
        background: getBadgeBackground(object.object_type, typeId.color),
        cursor: 'pointer',
        fontFamily: object.object_type === 'script'
          ? 'var(--cp-font-mono)'
          : 'var(--cp-font-body)',
        fontSize,
        fontWeight: 500,
        fontStyle: object.object_type === 'hunch' || object.object_type === 'quote'
          ? 'italic'
          : 'normal',
        color: getBadgeTextColor(object.object_type, typeId.color),
        lineHeight: 1,
        overflow: 'hidden',
        whiteSpace: 'nowrap',
        textOverflow: 'ellipsis',
        transition: 'border-color 0.15s, background 0.15s',
        flexShrink: 0,
      }}
    >
      {renderLeadingElement(object.object_type, typeId, compact)}
      <span style={{
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>
        {getBadgeLabel(object)}
      </span>
    </button>
  );
}

/* ─────────────────────────────────────────────────
   Type-specific visual helpers
   ───────────────────────────────────────────────── */

function renderLeadingElement(
  typeSlug: string,
  typeId: { color: string; label: string },
  compact: boolean,
) {
  const dotSize = compact ? 6 : 7;

  switch (typeSlug) {
    case 'person':
      return (
        <span style={{
          width: compact ? 14 : 16,
          height: compact ? 14 : 16,
          borderRadius: '50%',
          background: typeId.color,
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: compact ? 8 : 9,
          fontWeight: 700,
          flexShrink: 0,
          letterSpacing: '-0.02em',
        }}>
          P
        </span>
      );

    case 'concept':
      return (
        <span style={{
          width: dotSize,
          height: dotSize,
          borderRadius: '50%',
          background: typeId.color,
          flexShrink: 0,
        }} />
      );

    case 'source':
      return (
        <span style={{
          width: compact ? 12 : 14,
          height: compact ? 12 : 14,
          borderRadius: 2,
          background: `${typeId.color}20`,
          border: `1px solid ${typeId.color}40`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: compact ? 7 : 8,
          flexShrink: 0,
        }}>
          S
        </span>
      );

    case 'task':
      return (
        <span style={{
          width: compact ? 10 : 12,
          height: compact ? 10 : 12,
          borderRadius: 2,
          border: `1.5px solid ${typeId.color}`,
          flexShrink: 0,
        }} />
      );

    case 'event':
      return (
        <span style={{
          fontFamily: 'var(--cp-font-mono)',
          fontSize: compact ? 7 : 8,
          fontWeight: 700,
          color: typeId.color,
          letterSpacing: '0.02em',
          flexShrink: 0,
        }}>
          EV
        </span>
      );

    case 'quote':
      return (
        <span style={{
          width: 2,
          height: compact ? 12 : 14,
          background: typeId.color,
          borderRadius: 1,
          flexShrink: 0,
        }} />
      );

    case 'place':
      return (
        <span style={{
          fontSize: compact ? 9 : 10,
          flexShrink: 0,
          lineHeight: 1,
        }}>
          {'\u{1F4CD}'}
        </span>
      );

    case 'script':
      return (
        <span style={{
          fontFamily: 'var(--cp-font-mono)',
          fontSize: compact ? 7 : 8,
          fontWeight: 600,
          opacity: 0.6,
          flexShrink: 0,
        }}>
          {'/>'}
        </span>
      );

    case 'hunch':
      return (
        <span style={{
          fontSize: compact ? 9 : 10,
          flexShrink: 0,
          lineHeight: 1,
          opacity: 0.7,
        }}>
          ?
        </span>
      );

    default:
      return (
        <span style={{
          width: dotSize,
          height: dotSize,
          borderRadius: '50%',
          background: typeId.color,
          opacity: 0.5,
          flexShrink: 0,
        }} />
      );
  }
}

function getBadgeLabel(object: PinnedBadgeObject): string {
  if (object.object_type === 'quote') {
    return object.title.length > 30
      ? object.title.slice(0, 30) + '\u2026'
      : object.title;
  }
  return object.title;
}

function getBorderStyle(typeSlug: string, color: string): string {
  switch (typeSlug) {
    case 'hunch':
      return `${color}60`;
    case 'script':
      return 'var(--cp-term-border, #2A2C32)';
    default:
      return `${color}30`;
  }
}

function getBadgeBackground(typeSlug: string, color: string): string {
  switch (typeSlug) {
    case 'script':
      return 'var(--cp-term, #1A1C22)';
    case 'hunch':
      return `${color}08`;
    default:
      return `${color}0A`;
  }
}

function getBadgeTextColor(typeSlug: string, color: string): string {
  switch (typeSlug) {
    case 'script':
      return 'var(--cp-term-text, #A4C8B0)';
    case 'note':
      return 'var(--cp-text, #3A3632)';
    default:
      return color;
  }
}
