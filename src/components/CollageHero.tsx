/**
 * CollageHero: full-bleed homepage hero (transparent over DotGrid).
 *
 * Unified editorial spread containing identity (name, tagline gradient,
 * PipelineCounter), the featured essay, and a /now snapshot in the left
 * column. Right column: composed visual artifact.
 *
 * Two-column grid on desktop (55% text / 45% artifact).
 * Single-column stack on mobile.
 *
 * Transparent: DotGrid canvas shows through behind content.
 */

import Link from 'next/link';
import TagList from './TagList';
import { CompactTracker, ESSAY_STAGES } from './ProgressTracker';

interface FeaturedEssay {
  slug: string;
  title: string;
  summary: string;
  /** ISO date string (Date objects can't cross RSC boundary) */
  date: string;
  tags: string[];
  stage?: string;
  lastAdvanced?: string;
  callouts?: string[];
}

interface CollageHeroProps {
  name: string;
  /** Slot for PipelineCounter component */
  pipelineStatus: React.ReactNode;
  /** Slot for NowPreviewCompact component */
  nowPreview: React.ReactNode;
  /** Optional artifact component for the right column */
  artifact?: React.ReactNode;
  /** Featured essay data (merged into the hero) */
  featured?: FeaturedEssay | null;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const month = d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
  const day = d.getDate().toString().padStart(2, '0');
  const year = d.getFullYear();
  return `${month} ${day}, ${year}`;
}

export default function CollageHero({
  name,
  pipelineStatus,
  nowPreview,
  artifact,
  featured,
}: CollageHeroProps) {
  const latestHref = featured ? `/essays/${featured.slug}` : '/essays';

  return (
    <div>
      <div
        className="relative"
        style={{
          marginLeft: 'calc(-50vw + 50%)',
          marginRight: 'calc(-50vw + 50%)',
          marginTop: 'calc(-1 * var(--main-pad-y, 1.5rem))',
          width: '100vw',
        }}
      >
        {/* Content layer */}
        <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col lg:grid lg:items-start py-12 md:py-16 lg:py-20 gap-8 lg:gap-12"
            style={{ gridTemplateColumns: '55% 1fr' }}
          >
            {/* Left column: identity + featured essay */}
            <div className="flex flex-col">
              {/* Zone A: Identity */}
              <div>
                <h1
                  className="text-[2.5rem] sm:text-[3.5rem] md:text-[4rem] lg:text-[4.5rem] m-0"
                  style={{
                    fontFamily: 'var(--font-title)',
                    fontWeight: 700,
                    lineHeight: 1.0,
                    color: 'var(--color-hero-text)',
                  }}
                >
                  {name}
                </h1>

                <p
                  className="mt-3 mb-0"
                  style={{
                    fontFamily: 'var(--font-title)',
                    fontWeight: 700,
                    fontSize: 26,
                    background: 'linear-gradient(to right, var(--color-hero-text), var(--color-terracotta))',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}
                >
                  <Link
                    href={latestHref}
                    className="no-underline"
                    style={{ color: 'inherit', WebkitTextFillColor: 'inherit' }}
                  >
                    Hey, I&apos;m working here
                  </Link>
                </p>

                <div className="mt-4">{pipelineStatus}</div>
              </div>

              {/* Zone B: Featured Essay */}
              {featured && (
                <div className="mt-8 lg:mt-10">
                  <span
                    className="block mb-2"
                    style={{
                      fontFamily: 'var(--font-metadata)',
                      fontSize: 9,
                      textTransform: 'uppercase',
                      letterSpacing: '0.12em',
                      color: 'var(--color-terracotta)',
                    }}
                  >
                    Currently Writing
                  </span>

                  <Link
                    href={`/essays/${featured.slug}`}
                    className="no-underline block group"
                  >
                    <h2
                      className="text-2xl sm:text-3xl lg:text-4xl m-0 transition-colors"
                      style={{
                        fontFamily: 'var(--font-title)',
                        fontWeight: 700,
                        lineHeight: 1.15,
                        color: 'var(--color-hero-text)',
                      }}
                    >
                      <span className="group-hover:text-[var(--color-terracotta)] transition-colors">
                        {featured.title}
                      </span>
                    </h2>
                  </Link>

                  <p
                    className="mt-3 mb-0 text-base lg:text-lg"
                    style={{
                      color: 'var(--color-hero-text-muted)',
                      lineHeight: 1.6,
                      maxWidth: '42ch',
                    }}
                  >
                    {featured.summary}
                  </p>

                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <time
                      dateTime={new Date(featured.date).toISOString()}
                      className="inline-block font-mono text-[11px] uppercase tracking-widest px-2 py-0.5 rounded select-none"
                      style={{
                        color: 'var(--color-terracotta)',
                        background: 'rgba(180, 90, 45, 0.08)',
                      }}
                    >
                      {formatDate(featured.date)}
                    </time>

                    {featured.stage && (
                      <CompactTracker
                        stages={ESSAY_STAGES}
                        currentStage={featured.stage}
                        color="var(--color-terracotta)"
                      />
                    )}
                  </div>

                  {featured.tags.length > 0 && (
                    <div className="mt-3">
                      <TagList tags={featured.tags} tint="terracotta" />
                    </div>
                  )}
                </div>
              )}

              {/* Zone C: /now snapshot */}
              <div className="mt-6 lg:mt-8">
                {nowPreview}
              </div>
            </div>

            {/* Right column: artifact only */}
            <div className="flex flex-col">
              <div className="max-w-sm mx-auto lg:max-w-none lg:mx-0">
                {artifact}
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
