'use client';

/**
 * EssayHero: Full-bleed editorial header for essay detail pages.
 *
 * Background priority (first match wins):
 *   1. Collage image from the Python engine (`/collage/<slug>.jpg`)
 *   2. YouTube thumbnail (via youtubeId)
 *   3. PatternImage generative fallback
 *
 * Collage images already contain the dark ground, grain, and vignette,
 * so the dark overlay is skipped when a collage is present.
 *
 * Reports its height to --hero-height so DotGrid renders cream dots over
 * the dark zone.
 */

import { useRef, useEffect } from 'react';
import Image from 'next/image';
import PatternImage from '@/components/PatternImage';

interface EssayHeroProps {
  title: string;
  date: Date;
  readingTime: number;
  slug: string;
  youtubeId?: string;
  /** First tag used as category label above title */
  category?: string;
  /** ProgressTracker component passed as a slot */
  progressTracker?: React.ReactNode;
  /** TagList component passed as a slot */
  tags?: React.ReactNode;
  summary?: string;
  /** Path to a pre-composited collage image (e.g. `/collage/my-essay.jpg`) */
  collageImage?: string;
}

export default function EssayHero({
  title,
  date,
  readingTime,
  slug,
  youtubeId,
  category,
  progressTracker,
  tags,
  summary,
  collageImage,
}: EssayHeroProps) {
  const heroRef = useRef<HTMLDivElement>(null);

  // Report hero height to CSS custom property for DotGrid zone awareness
  useEffect(() => {
    const el = heroRef.current;
    if (!el) return;

    function updateHeight() {
      const height = el!.offsetHeight;
      document.documentElement.style.setProperty('--hero-height', `${height}`);
    }

    updateHeight();

    const ro = new ResizeObserver(updateHeight);
    ro.observe(el);

    return () => {
      ro.disconnect();
      document.documentElement.style.removeProperty('--hero-height');
    };
  }, []);

  const formattedDate = date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div
      ref={heroRef}
      className="relative overflow-hidden"
      style={{
        // Break out of max-w-4xl parent to span full viewport
        marginLeft: 'calc(-50vw + 50%)',
        marginRight: 'calc(-50vw + 50%)',
        marginTop: 'calc(-1 * var(--main-pad-y, 1.5rem))',
        width: '100vw',
      }}
    >
      {/* Background layer: collage > YouTube thumbnail > PatternImage */}
      <div className="absolute inset-0">
        {collageImage ? (
          <Image
            src={collageImage}
            alt=""
            fill
            sizes="100vw"
            className="object-cover object-top"
            aria-hidden="true"
            priority
          />
        ) : youtubeId ? (
          <Image
            src={`https://img.youtube.com/vi/${youtubeId}/maxresdefault.jpg`}
            alt=""
            fill
            sizes="100vw"
            className="object-cover"
            aria-hidden="true"
            priority
          />
        ) : (
          <div className="w-full h-full">
            <PatternImage
              seed={slug}
              height={400}
              color="var(--color-terracotta)"
              className="!h-full"
            />
          </div>
        )}
      </div>

      {/* Dark overlay for text legibility (skipped for collage: ground is baked in) */}
      {!collageImage && (
        <div
          className="absolute inset-0"
          style={{ backgroundColor: 'var(--color-hero-overlay)' }}
        />
      )}

      {/* Subtle paper grain on the dark overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          opacity: 0.03,
          backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E\")",
          backgroundRepeat: 'repeat',
        }}
      />

      {/* Typography layer */}
      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 pt-16 md:pt-24 pb-10 md:pb-14">
        {/* Date + reading time: top-right corner */}
        <div
          className="absolute top-4 right-4 sm:right-6 md:top-6 text-right"
          style={{ zIndex: 10 }}
        >
          <span
            className="font-mono block"
            style={{
              fontSize: 9,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'rgba(240, 235, 228, 0.5)',
            }}
          >
            {formattedDate}
          </span>
          <span
            className="font-mono block"
            style={{
              fontSize: 9,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'rgba(240, 235, 228, 0.5)',
            }}
          >
            {readingTime} min read
          </span>
        </div>

        {/* Category label: Courier Prime, uppercase, terracotta, short rule */}
        {category && (
          <div className="flex items-center gap-3 mb-4">
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
                color: 'var(--color-terracotta-light)',
              }}
            >
              {category}
            </span>
            <div
              style={{
                width: 32,
                height: 1,
                backgroundColor: 'var(--color-terracotta-light)',
                opacity: 0.5,
              }}
            />
          </div>
        )}

        {/* Title: large, editorial, uncontained */}
        <h1
          className="font-title text-3xl sm:text-4xl md:text-[3.25rem] lg:text-[3.75rem] font-bold leading-[1.1] mb-4"
          style={{ color: 'var(--color-hero-text)' }}
        >
          {title}
        </h1>

        {/* Summary */}
        {summary && (
          <p
            className="text-lg md:text-xl max-w-prose leading-relaxed mb-5"
            style={{ color: 'var(--color-hero-text-muted)' }}
          >
            {summary}
          </p>
        )}

        {/* Tags */}
        {tags && <div className="mb-4">{tags}</div>}

        {/* Progress tracker */}
        {progressTracker && <div>{progressTracker}</div>}
      </div>

      {/* Bottom gradient fade to parchment: multi-stop for smoother dissolve */}
      <div
        className="absolute bottom-0 left-0 right-0 pointer-events-none"
        style={{
          height: 120,
          background: `linear-gradient(
            to bottom,
            transparent 0%,
            color-mix(in srgb, var(--color-paper) 15%, transparent) 30%,
            color-mix(in srgb, var(--color-paper) 50%, transparent) 55%,
            color-mix(in srgb, var(--color-paper) 80%, transparent) 75%,
            var(--color-paper) 100%
          )`,
        }}
      />
    </div>
  );
}
