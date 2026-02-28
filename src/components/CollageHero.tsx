/**
 * CollageHero: Full-bleed parchment header with editorial typography.
 * Used on the homepage.
 *
 * Three-column grid (1fr 118px 1fr) aligns the name with the max-w-4xl
 * content area and the spacer with the RoughLine label gap below.
 */

import Link from 'next/link';

interface CollageHeroProps {
  name: string;
  /** URL to the newest piece of content (linked via "here" in subtitle) */
  latestHref: string;
  /** Slot for PipelineCounter component */
  pipelineStatus: React.ReactNode;
  /** Slot for NowPreviewCompact component */
  nowPreview: React.ReactNode;
}

export default function CollageHero({
  name,
  latestHref,
  pipelineStatus,
  nowPreview,
}: CollageHeroProps) {
  return (
    <div
      className="relative"
      style={{
        // Break out of max-w-4xl to span full viewport width
        marginLeft: 'calc(-50vw + 50%)',
        marginRight: 'calc(-50vw + 50%)',
        marginTop: 'calc(-1 * var(--main-pad-y, 1.5rem))',
        width: '100vw',
      }}
    >
      {/* Typography layer */}
      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6">
        <div
          className="flex flex-col lg:grid lg:items-end py-12 md:py-16 lg:py-20"
          style={{ gridTemplateColumns: '1fr 118px 1fr' }}
        >
          {/* Left: identity */}
          <div className="flex flex-col justify-end lg:pl-[128px]">
            <h1
              className="text-[2.5rem] sm:text-[3.5rem] md:text-[4rem] lg:text-[4.5rem] m-0"
              style={{
                fontFamily: 'var(--font-title)',
                fontWeight: 700,
                lineHeight: 1.0,
                color: 'var(--color-ink)',
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
                background:
                  'linear-gradient(to right, var(--color-ink-secondary), var(--color-terracotta))',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              Hey, I&apos;m working{' '}
              <Link
                href={latestHref}
                className="no-underline hover:opacity-80 transition-opacity"
              >
                here
              </Link>
            </p>

            <div className="mt-4">{pipelineStatus}</div>
          </div>

          {/* Center spacer: matches the "Essays on ..." label width */}
          <div className="hidden lg:block" aria-hidden="true" />

          {/* Right: /now snapshot */}
          <div className="flex flex-col justify-end mt-6 lg:mt-0">
            {nowPreview}
          </div>
        </div>
      </div>
    </div>
  );
}
