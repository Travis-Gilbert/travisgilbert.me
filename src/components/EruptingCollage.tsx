'use client';

import { type ReactNode } from 'react';
import Image from 'next/image';

export interface CollageFragment {
  src: string;
  alt: string;
  width: number;
  height: number;
  left: string;
  top: number;
  rotate: number;
  z: number;
  scale?: number;
  opacity?: number;
  hideOnMobile?: boolean;
}

interface EruptingCollageProps {
  fragments: CollageFragment[];
  children: ReactNode;
  /** Height of the eruption zone above the card (default: 280) */
  eruptionHeight?: number;
  /** Enable hover lift animation (default: true) */
  hover?: boolean;
}

/**
 * Blake Cale inspired editorial collage container.
 * Renders overlapping image fragments erupting above a clean card.
 * Card uses CSS-only styling (accent border, warm shadow) instead of rough.js.
 */
export default function EruptingCollage({
  fragments,
  children,
  eruptionHeight = 280,
  hover = true,
}: EruptingCollageProps) {
  return (
    <div
      className="lg:-mx-4 xl:-mx-8 relative"
      style={{ paddingTop: fragments.length > 0 ? undefined : 0 }}
    >
      {/* Responsive top padding: full eruption at md+, none on mobile */}
      <div
        className={fragments.length > 0 ? 'pt-0 md:pt-[var(--eruption-h)]' : ''}
        style={{ '--eruption-h': `${eruptionHeight}px` } as React.CSSProperties}
      >
        {/* Erupting collage fragments: absolute positioned above the card */}
        {fragments.length > 0 && (
          <div
            className="absolute left-0 right-0 top-0 pointer-events-none hidden md:block"
            style={{ height: eruptionHeight, zIndex: 0 }}
            aria-hidden="true"
          >
            {fragments.map((frag) => (
              <div
                key={frag.src}
                className={`absolute ${frag.hideOnMobile ? 'hidden lg:block' : ''}`}
                style={{
                  left: frag.left,
                  top: frag.top,
                  width: frag.width * (frag.scale ?? 1),
                  height: frag.height * (frag.scale ?? 1),
                  transform: `rotate(${frag.rotate}deg)`,
                  zIndex: frag.z,
                  opacity: frag.opacity ?? 1,
                  filter: 'drop-shadow(2px 4px 8px var(--color-shadow, rgba(58, 54, 50, 0.18)))',
                }}
              >
                <Image
                  src={frag.src}
                  alt={frag.alt}
                  width={frag.width}
                  height={frag.height}
                  className="w-full h-full object-contain"
                />
              </div>
            ))}
          </div>
        )}

        {/* Card container: CSS-only styling, no rough.js border */}
        <div
          className={[
            'relative surface-tint-terracotta surface-elevated',
            hover ? 'surface-hover' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          style={{
            zIndex: 1,
            borderTop: '2px solid var(--color-terracotta)',
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
