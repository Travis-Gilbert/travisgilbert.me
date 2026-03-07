/**
 * CollageHero: full-bleed homepage hero (transparent over DotGrid).
 *
 * Left column: featured essay (title as h1, thesis pull-quote, summary,
 * metadata, CyclingTagline ticker, PipelineCounter) + /now snapshot.
 * Right column: composed visual artifact.
 *
 * Two-column grid on desktop (55% text / 45% artifact).
 * Single-column stack on mobile.
 *
 * Transparent: DotGrid canvas shows through behind content.
 */

import Link from 'next/link';
import TagList from './TagList';
import CyclingTagline from './CyclingTagline';
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
  thesis?: string;
}

interface CollageHeroProps {
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
  pipelineStatus,
  nowPreview,
  artifact,
  featured,
}: CollageHeroProps) {
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
            {/* Left column: featured essay + studio status */}
            <div className="flex flex-col">
              {/* Fallback h1 when no essays exist */}
              {!featured && (
                <h1
                  className="m-0"
                  style={{
                    fontFamily: 'var(--font-title)',
                    fontWeight: 700,
                    lineHeight: 1.1,
                    fontSize: 'clamp(2rem, 8vw, 3.2rem)',
                    color: 'var(--color-ink)',
                  }}
                >
                  Research notes on how design decisions shape human outcomes
                </h1>
              )}

              {/* Featured Essay (promoted to h1) */}
              {featured && (
                <div>
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
                    <h1
                      className="m-0 transition-colors"
                      style={{
                        fontFamily: 'var(--font-title)',
                        fontSize: 'clamp(2rem, 8vw, 3.2rem)',
                        fontWeight: 700,
                        lineHeight: 1.1,
                        color: 'var(--color-ink)',
                        maxWidth: '18ch',
                      }}
                    >
                      <span className="group-hover:text-[var(--color-terracotta)] transition-colors">
                        {featured.title}
                      </span>
                    </h1>
                  </Link>

                  {/* Thesis pull-quote */}
                  {featured.thesis && (
                    <p
                      className="mt-3 mb-0"
                      style={{
                        fontFamily: 'var(--font-title)',
                        fontSize: 'clamp(1.05rem, 4vw, 1.2rem)',
                        fontWeight: 600,
                        fontStyle: 'italic',
                        lineHeight: 1.5,
                        color: 'var(--color-terracotta)',
                        maxWidth: '36ch',
                        borderLeft: '3px solid var(--color-terracotta)',
                        paddingLeft: '1rem',
                        opacity: 0.85,
                      }}
                    >
                      {featured.thesis}
                    </p>
                  )}

                  <p
                    className="mt-3 mb-0"
                    style={{
                      fontSize: 'clamp(1rem, 4.3vw, 1.08rem)',
                      color: 'var(--color-ink-secondary)',
                      lineHeight: 1.68,
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

                  {/* Callouts: CodeComment style workbench annotations */}
                  {featured.callouts && featured.callouts.length > 0 && (
                    <div className="mt-4 flex flex-col gap-2">
                      {featured.callouts.map((callout, i) => (
                        <p
                          key={i}
                          className="m-0 leading-snug select-none"
                          style={{
                            fontFamily: 'var(--font-code)',
                            fontSize: 12,
                            color: 'var(--color-terracotta)',
                            opacity: 0.7,
                          }}
                        >
                          <span
                            style={{ fontSize: 14, opacity: 0.5, marginRight: 6 }}
                            aria-hidden="true"
                          >
                            #
                          </span>
                          {callout}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Also working on: cycling topic ticker */}
              <div className="mt-6 flex items-baseline gap-2">
                <span
                  style={{
                    fontFamily: 'var(--font-metadata)',
                    fontSize: 10,
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    color: 'var(--color-ink-muted)',
                  }}
                >
                  Also working on
                </span>
              </div>
              <div className="mt-1">
                <CyclingTagline />
              </div>

              {/* Pipeline status (studio activity counts) */}
              <div className="mt-4">{pipelineStatus}</div>

              {/* /now snapshot */}
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
