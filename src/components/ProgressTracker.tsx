/**
 * ProgressTracker: visualizes where content sits in its lifecycle.
 * Generic: accepts any stages array, works for essays (4) and field notes (3).
 *
 * Two variants:
 *   full (default): connected dots with labels beneath each stage
 *   compact: dots only with a single label for the current stage
 *
 * When `lastAdvanced` is within the last 24 hours, the current stage dot
 * renders as a StampDot (Client Component) with a brief stamp animation
 * and scatter micro-dots.
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
    <div className="flex items-center gap-0 mt-2">
      {stages.map((stage, i) => {
        const isComplete = i < currentIdx;
        const isCurrent = i === currentIdx;
        const isUpcoming = i > currentIdx;

        return (
          <div key={stage.key} className="flex items-center">
            <div className="flex flex-col items-center gap-1">
              {/* Dot (StampDot for current stage when recently advanced) */}
              {isCurrent && showStamp ? (
                <StampDot
                  size={10}
                  color={color}
                  glow={`0 0 0 3px color-mix(in srgb, ${color} 13%, transparent)`}
                />
              ) : (
                <div
                  className="rounded-full transition-all duration-300"
                  style={{
                    width: 10,
                    height: 10,
                    background: isComplete || isCurrent ? color : 'transparent',
                    border: `2px solid ${isUpcoming ? (inverted ? 'color-mix(in srgb, var(--color-hero-text) 40%, transparent)' : 'var(--color-border)') : color}`,
                    boxShadow: isCurrent ? `0 0 0 3px color-mix(in srgb, ${color} 13%, transparent)` : 'none',
                  }}
                />
              )}
              {/* Label */}
              <span
                className="font-mono whitespace-nowrap"
                style={{
                  fontSize: 11,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: isCurrent ? color : isComplete
                    ? (inverted ? 'var(--color-hero-text-muted)' : 'var(--color-ink-muted)')
                    : (inverted ? 'color-mix(in srgb, var(--color-hero-text) 55%, transparent)' : 'var(--color-ink-light)'),
                  fontWeight: isCurrent ? 700 : 400,
                }}
              >
                {stage.label}
              </span>
            </div>
            {/* Connector line between dots */}
            {i < stages.length - 1 && (
              <div
                className="transition-colors duration-300"
                style={{
                  width: 32,
                  height: 2,
                  background: isComplete ? color : (inverted ? 'color-mix(in srgb, var(--color-hero-text) 30%, transparent)' : 'var(--color-border-light)'),
                  marginBottom: 16,
                  marginLeft: 2,
                  marginRight: 2,
                }}
              />
            )}
          </div>
        );
      })}
      {annotationCount != null && annotationCount > 0 && (
        <span
          className="font-mono ml-3"
          style={{
            fontSize: 9,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: inverted ? 'color-mix(in srgb, var(--color-hero-text) 70%, transparent)' : 'var(--color-ink-light)',
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
