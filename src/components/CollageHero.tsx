/**
 * CollageHero: Full-bleed parchment header with editorial typography.
 * Used on the homepage.
 *
 * Three-column grid (1fr 118px 1fr) aligns the name with the max-w-4xl
 * content area and the spacer with the RoughLine label gap below.
 */

interface CollageHeroProps {
  name: string;
  /** Content counters line, e.g. "4 essays · 12 projects · 8 field notes" */
  countersLabel: string;
  /** Slot for CyclingTagline component */
  tagline: React.ReactNode;
  /** Slot for NowPreviewCompact component */
  nowPreview: React.ReactNode;
}

export default function CollageHero({
  name,
  countersLabel,
  tagline,
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

            <div className="mt-2">{tagline}</div>

            <p
              className="font-mono mt-4 mb-0"
              style={{
                fontSize: 11,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: 'var(--color-ink-muted)',
              }}
            >
              {countersLabel}
            </p>
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
