'use client';

import { useState, type ReactNode, type CSSProperties } from 'react';
import Link from 'next/link';
import { studioMix } from '@/lib/studio';

/**
 * Reusable glow card for Studio surfaces.
 *
 * Replicates ProjectColumns' three-state tinting pattern:
 *   Rest:    5.5% type color background, invisible border, 2% shadow
 *   Hover:   9% background, 25% border, 5% shadow
 *   (Future) Expanded: 10% background, 35% border, 8% shadow
 *
 * Uses CSS color-mix() via the studioMix utility so raw hex
 * colors (from content type identity) work directly.
 *
 * Optional `href` wraps content in a Next.js Link.
 * 2.5px left border in type color provides visual anchoring.
 */
export default function StudioCard({
  typeColor,
  children,
  href,
  onClick,
  className = '',
  style,
}: {
  /** Hex color for the glow tint (e.g., '#B45A2D') */
  typeColor: string;
  children: ReactNode;
  /** If provided, card becomes a Next.js Link */
  href?: string;
  onClick?: () => void;
  className?: string;
  style?: CSSProperties;
}) {
  const [hovered, setHovered] = useState(false);

  /* Three-state glow percentages (boosted from original ProjectColumns values) */
  const bgPct = hovered ? 14 : 8;
  const borderPct = hovered ? 30 : 0;
  const shadowAlpha = hovered ? 0.08 : 0.03;

  const cardStyle: CSSProperties = {
    background: studioMix(typeColor, bgPct),
    border: `1px solid ${borderPct > 0 ? studioMix(typeColor, borderPct) : 'transparent'}`,
    borderLeft: `2.5px solid ${typeColor}`,
    borderRadius: '6px',
    padding: '14px 16px',
    transition: 'all 0.15s ease',
    boxShadow: hovered
      ? `0 1px 6px ${studioMix(typeColor, 8)}, 0 0 20px ${studioMix(typeColor, 4)}`
      : `0 1px 6px ${studioMix(typeColor, 3)}`,
    cursor: href || onClick ? 'pointer' : undefined,
    textDecoration: 'none',
    color: 'inherit',
    display: 'block',
    ...style,
  };

  const handlers = {
    onMouseEnter: () => setHovered(true),
    onMouseLeave: () => setHovered(false),
  };

  if (href) {
    return (
      <Link
        href={href}
        className={`studio-card-glow ${className}`.trim()}
        style={cardStyle}
        {...handlers}
      >
        {children}
      </Link>
    );
  }

  return (
    <div
      className={`studio-card-glow ${className}`.trim()}
      style={cardStyle}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      {...handlers}
    >
      {children}
    </div>
  );
}
