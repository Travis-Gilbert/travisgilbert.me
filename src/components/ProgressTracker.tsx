/**
 * ProgressTracker: milestone-style horizontal timeline for content lifecycle.
 * Generic: accepts any stages array, works for essays (4) and field notes (3).
 *
 * Layout: labels above dots, checkmarks on completed stages, pulse ring on
 * current stage, "Active" descriptor below the current dot. StampDot fires
 * when lastAdvanced is within 24h.
 *
 * Two variants:
 *   full (default): label + dot + connector for each stage
 *   compact: dots only with a single label for the current stage
 */

import StampDot from './StampDot';

/** Check if an ISO date string is within the last 24 hours */
function isRecent(isoDate: string): boolean {
  const then = new Date(isoDate).getTime();
  const now = Date.now();
  return now - then < 24 * 60 * 60 * 1000 && then <= now;
}

export interface Stage {
  key: string;
  label: string;
}

/** Predefined stage sets for convenience */
export const ESSAY_STAGES: Stage[] = [
  { key: 'research', label: 'Research' },
  { key: 'drafting', label: 'Drafting' },
  { key: 'production', label: 'Production' },
  { key: 'published', label: 'Published' },
];

export const NOTE_STAGES: Stage[] = [
  { key: 'observation', label: 'Observation' },
  { key: 'developing', label: 'Developing' },
  { key: 'connected', label: 'Connected' },
];

// ─── Full Tracker ────────────────────────────────────

interface ProgressTrackerProps {
  stages: Stage[];
  currentStage: string;
  color?: string;
  annotationCount?: number;
  /** When true, renders light colors for dark backgrounds (hero zone) */
  inverted?: boolean;
  /** ISO date when the stage last advanced (fires stamp animation if within 24h) */
  lastAdvanced?: string;
}

export default function ProgressTracker({
  stages,
  currentStage,
  color = 'var(--color-terracotta)',
  annotationCount,
  inverted = false,
  lastAdvanced,
}: ProgressTrackerProps) {
  const currentIdx = stages.findIndex((s) => s.key === currentStage);
  const showStamp = lastAdvanced ? isRecent(lastAdvanced) : false;

  return (
    <div
      className="mobile-tracker"
      style={{ display: 'flex', alignItems: 'flex-start', gap: 0 }}
      role="group"
      aria-label="Content pipeline"
    >
      {stages.map((stage, i) => {
        const isComplete = i < currentIdx;
        const isCurrent = i === currentIdx;
        const isUpcoming = i > currentIdx;

        return (
          <div key={stage.key} style={{ display: 'flex', alignItems: 'flex-start' }}>
            {/* Stage column: label on top, dot below, optional "Active" below dot */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 5,
              }}
            >
              {/* Label (above dot) */}
              <span
                className="tracker-label"
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  whiteSpace: 'nowrap',
                  lineHeight: 1,
                  fontWeight: isCurrent ? 700 : 400,
                  color: isCurrent
                    ? color
                    : isComplete
                      ? (inverted ? 'var(--color-hero-text-muted)' : 'var(--color-ink-muted)')
                      : (inverted ? 'rgba(240, 235, 228, 0.35)' : 'var(--color-ink-light)'),
                }}
              >
                {stage.label}
              </span>

              {/* Dot */}
              <div style={{ position: 'relative' }}>
                {isCurrent && showStamp ? (
                  <StampDot
                    size={14}
                    color={color}
                    glow={`0 0 0 4px color-mix(in srgb, ${color} 10%, transparent), 0 0 12px color-mix(in srgb, ${color} 13%, transparent)`}
                  />
                ) : (
                  <div
                    className="tracker-dot"
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: '50%',
                      position: 'relative',
                      background: isComplete || isCurrent ? color : 'transparent',
                      border: `2px solid ${isUpcoming ? (inverted ? 'rgba(240, 235, 228, 0.15)' : 'var(--color-border-light)') : color}`,
                      boxShadow: isCurrent
                        ? `0 0 0 4px color-mix(in srgb, ${color} 10%, transparent), 0 0 12px color-mix(in srgb, ${color} 13%, transparent)`
                        : 'none',
                      transition: 'all 0.3s ease',
                    }}
                  >
                    {/* Checkmark for completed stages */}
                    {isComplete && (
                      <svg
                        viewBox="0 0 12 12"
                        style={{
                          position: 'absolute',
                          top: 1,
                          left: 1,
                          width: 8,
                          height: 8,
                        }}
                        aria-hidden="true"
                      >
                        <path
                          d="M2.5 6L5 8.5L9.5 3.5"
                          fill="none"
                          stroke={inverted ? 'var(--color-hero-ground)' : 'var(--color-paper)'}
                          strokeWidth={2}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </div>
                )}

                {/* Pulse ring on current stage (CSS animated) */}
                {isCurrent && !showStamp && (
                  <span
                    aria-hidden="true"
                    style={{
                      position: 'absolute',
                      inset: -6,
                      borderRadius: '50%',
                      border: `1.5px solid color-mix(in srgb, ${color} 19%, transparent)`,
                      animation: 'pulseRing 2s ease-in-out infinite',
                      pointerEvents: 'none',
                    }}
                  />
                )}
              </div>

              {/* "Active" descriptor (current stage only) */}
              {isCurrent && (
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 9,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    color: `color-mix(in srgb, ${color} 56%, transparent)`,
                    lineHeight: 1,
                  }}
                >
                  Active
                </span>
              )}
            </div>

            {/* Connector line between stages */}
            {i < stages.length - 1 && (
              <div
                className="tracker-connector"
                style={{
                  width: 28,
                  height: 2,
                  borderRadius: 1,
                  background: isComplete
                    ? color
                    : (inverted ? 'rgba(240, 235, 228, 0.2)' : 'var(--color-border-light)'),
                  marginTop: 19,
                  marginLeft: 3,
                  marginRight: 3,
                  transition: 'background 0.3s ease',
                }}
              />
            )}
          </div>
        );
      })}

      {/* Annotation count badge */}
      {annotationCount != null && annotationCount > 0 && (
        <span
          className="font-mono ml-3 hidden sm:inline"
          style={{
            fontSize: 9,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: inverted
              ? 'color-mix(in srgb, var(--color-hero-text) 70%, transparent)'
              : 'var(--color-ink-light)',
            marginTop: 19,
          }}
        >
          {annotationCount} margin note{annotationCount !== 1 ? 's' : ''}
        </span>
      )}
    </div>
  );
}

// ─── Compact Tracker (for listing cards) ─────────────

interface CompactTrackerProps {
  stages: Stage[];
  currentStage: string;
  color?: string;
}

export function CompactTracker({
  stages,
  currentStage,
  color = 'var(--color-terracotta)',
}: CompactTrackerProps) {
  const currentIdx = stages.findIndex((s) => s.key === currentStage);

  return (
    <div className="flex items-center gap-[3px]">
      {stages.map((stage, i) => (
        <div
          key={stage.key}
          title={stage.label}
          className="rounded-full transition-all duration-300"
          style={{
            width: 6,
            height: 6,
            background: i <= currentIdx ? color : 'transparent',
            border: `1.5px solid ${i <= currentIdx ? color : 'var(--color-border)'}`,
          }}
        />
      ))}
      <span
        className="font-mono ml-1"
        style={{
          fontSize: 10,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color,
        }}
      >
        {stages[currentIdx]?.label}
      </span>
    </div>
  );
}
