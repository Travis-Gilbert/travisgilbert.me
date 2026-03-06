'use client';

/**
 * HeroArtifact: composed image container for the homepage hero.
 *
 * Displays a pre-composed base image with a slight rotation and
 * geometric SVG accents layered on top. Falls back to a styled
 * empty panel when no image is provided or the image fails to load.
 */

import { useState } from 'react';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { useIsMobile } from '@/hooks/useIsMobile';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';

interface HeroArtifactProps {
  /** Path to the composed base image, e.g. "/hero/curb-extensions.webp" */
  imageSrc?: string;
  /** Alt text for the base image */
  imageAlt?: string;
  /** Essay tags, used to generate accent labels */
  tags?: string[];
  /** Essay category, used to pick the central SVG motif */
  category?: string;
}

const LazyHeroAccents = dynamic(() => import('./HeroAccents'), {
  ssr: false,
});

export default function HeroArtifact({
  imageSrc,
  imageAlt = 'Hero artifact',
  tags = [],
  category,
}: HeroArtifactProps) {
  const [imgError, setImgError] = useState(false);
  const showImage = imageSrc && !imgError;
  const isMobile = useIsMobile();
  const prefersReducedMotion = usePrefersReducedMotion();
  const reducedMotion = isMobile || prefersReducedMotion;
  const accentTags = isMobile ? tags.slice(0, 2) : tags;

  return (
    <div
      className="hero-artifact relative mx-auto"
      style={{
        aspectRatio: '3 / 4',
        maxWidth: '100%',
        transform: reducedMotion ? 'rotate(0deg)' : 'rotate(-1.5deg)',
        transition: reducedMotion ? 'none' : 'transform 0.4s cubic-bezier(0.22, 1, 0.36, 1)',
      }}
    >
      {/* Base image or fallback panel */}
      {showImage ? (
        <Image
          src={imageSrc}
          alt={imageAlt}
          fill
          className="object-cover rounded-lg"
          style={{
            boxShadow:
              '0 8px 32px rgba(42, 36, 32, 0.3), 0 2px 8px rgba(42, 36, 32, 0.15)',
          }}
          sizes="(max-width: 1024px) 320px, 45vw"
          onError={() => setImgError(true)}
        />
      ) : (
        <div
          className="absolute inset-0 rounded-lg"
          style={{
            background: 'var(--color-bg-alt)',
            border: '1px solid var(--color-border)',
            boxShadow:
              '0 8px 32px rgba(42, 36, 32, 0.3), 0 2px 8px rgba(42, 36, 32, 0.15)',
          }}
        />
      )}

      {/* SVG accent overlay */}
      <LazyHeroAccents tags={accentTags} category={category} />
    </div>
  );
}
