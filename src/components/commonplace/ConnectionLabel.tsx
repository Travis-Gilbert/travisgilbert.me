'use client';

import { useState } from 'react';
import { getObjectTypeIdentity } from '@/lib/commonplace';

/**
 * ConnectionLabel: clickable connection badge on NodeCards.
 *
 * Pill-shaped badge showing "→ [Object Title]" with the
 * connected object's type color. On hover, shows the edge
 * reason as a tooltip and a subtle glow in the type color.
 */

interface ConnectionLabelProps {
  targetTitle: string;
  targetType: string;
  reason: string;
  onClick?: () => void;
}

export default function ConnectionLabel({
  targetTitle,
  targetType,
  reason,
  onClick,
}: ConnectionLabelProps) {
  const [isHovered, setIsHovered] = useState(false);
  const typeInfo = getObjectTypeIdentity(targetType);

  /* Truncate long titles */
  const displayTitle =
    targetTitle.length > 28 ? targetTitle.slice(0, 26) + '...' : targetTitle;

  return (
    <span
      className="cp-connection-label"
      role="button"
      tabIndex={0}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.stopPropagation();
          onClick?.();
        }
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      title={reason}
      style={{
        backgroundColor: isHovered
          ? `${typeInfo.color}18`
          : `${typeInfo.color}0A`,
        borderColor: isHovered
          ? `${typeInfo.color}40`
          : `${typeInfo.color}20`,
        boxShadow: isHovered
          ? `0 0 8px ${typeInfo.color}15`
          : 'none',
      }}
    >
      <span
        style={{
          width: 5,
          height: 5,
          borderRadius: '50%',
          backgroundColor: typeInfo.color,
          flexShrink: 0,
          opacity: 0.7,
        }}
      />
      <span
        style={{
          fontFamily: 'var(--cp-font-body)',
          fontSize: 10.5,
          color: isHovered ? 'var(--cp-text)' : 'var(--cp-text-muted)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          transition: 'color 150ms',
        }}
      >
        {displayTitle}
      </span>
    </span>
  );
}
