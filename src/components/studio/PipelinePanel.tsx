'use client';

/**
 * PipelinePanel: vertical timeline for the Studio WorkbenchPanel Outline tab.
 *
 * Shows content lifecycle stages as a vertical list with filled connector,
 * checkmarks on completed stages, glow on current, and a word count progress
 * bar below. Dark ground palette using Studio design tokens.
 */

interface PipelinePanelProps {
  stages: Array<{ key: string; label: string }>;
  currentStage: string;
  /** Content type color (terracotta for essays, teal for notes, etc.) */
  color: string;
  wordCount: number;
  /** From WORD_TARGETS in WorkbenchPanel */
  wordTarget: number;
}

export default function PipelinePanel({
  stages,
  currentStage,
  color,
  wordCount,
  wordTarget,
}: PipelinePanelProps) {
  const currentIdx = stages.findIndex((s) => s.key === currentStage);
  const fillHeight =
    stages.length > 1 ? (currentIdx / (stages.length - 1)) * 100 : 0;
  const progress = wordTarget > 0 ? Math.min(wordCount / wordTarget, 1) : 0;

  return (
    <div>
      {/* Section header */}
      <div
        style={{
          fontFamily: 'var(--studio-font-mono)',
          fontSize: '10px',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.12em',
          color: 'var(--studio-text-3)',
          marginBottom: 14,
        }}
      >
        Pipeline
      </div>

      {/* Vertical timeline */}
      <div
        style={{
          position: 'relative',
          paddingLeft: 20,
        }}
        role="group"
        aria-label="Content pipeline stages"
      >
        {/* Background connector line */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: 5,
            top: 6,
            bottom: 6,
            width: 2,
            backgroundColor: 'var(--studio-border)',
            borderRadius: 1,
          }}
        />

        {/* Filled connector overlay (progress) */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: 5,
            top: 6,
            width: 2,
            height: `${fillHeight}%`,
            backgroundColor: color,
            borderRadius: 1,
            transition: 'height 0.5s ease',
          }}
        />

        {/* Stage rows */}
        {stages.map((stage, i) => {
          const isComplete = i < currentIdx;
          const isCurrent = i === currentIdx;
          const isUpcoming = i > currentIdx;

          return (
            <div
              key={stage.key}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                marginBottom: i < stages.length - 1 ? 10 : 0,
                position: 'relative',
              }}
            >
              {/* Dot */}
              <div
                style={{
                  position: 'absolute',
                  left: -20,
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  zIndex: 1,
                  backgroundColor: isComplete || isCurrent
                    ? color
                    : 'var(--studio-surface)',
                  border: `2px solid ${isUpcoming ? 'var(--studio-border)' : color}`,
                  boxShadow: isCurrent
                    ? `0 0 0 3px color-mix(in srgb, ${color} 13%, transparent), 0 0 8px color-mix(in srgb, ${color} 9%, transparent)`
                    : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {/* Checkmark for completed */}
                {isComplete && (
                  <svg
                    viewBox="0 0 12 12"
                    style={{ width: 7, height: 7 }}
                    aria-hidden="true"
                  >
                    <path
                      d="M2.5 6L5 8.5L9.5 3.5"
                      fill="none"
                      stroke="var(--studio-bg)"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </div>

              {/* Label */}
              <span
                style={{
                  fontFamily: 'var(--studio-font-mono)',
                  fontSize: 11,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  fontWeight: isCurrent ? 700 : 400,
                  color: isCurrent
                    ? color
                    : isComplete
                      ? 'var(--studio-text-2)'
                      : 'rgba(240, 235, 228, 0.3)',
                  flex: 1,
                }}
              >
                {stage.label}
              </span>

              {/* "Now" badge (current stage only) */}
              {isCurrent && (
                <span
                  style={{
                    fontFamily: 'var(--studio-font-mono)',
                    fontSize: 8,
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    color: `color-mix(in srgb, ${color} 50%, transparent)`,
                    padding: '2px 6px',
                    border: `1px solid color-mix(in srgb, ${color} 19%, transparent)`,
                    borderRadius: 4,
                  }}
                >
                  Now
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Word count section */}
      {wordTarget > 0 && (
        <div
          style={{
            borderTop: '1px solid var(--studio-border)',
            marginTop: 18,
            paddingTop: 14,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: 6,
            }}
          >
            <span
              style={{
                fontFamily: 'var(--studio-font-mono)',
                fontSize: 24,
                fontWeight: 700,
                color,
                lineHeight: 1,
              }}
            >
              {wordCount.toLocaleString()}
            </span>
            <span
              style={{
                fontFamily: 'var(--studio-font-mono)',
                fontSize: 11,
                color: 'var(--studio-text-3)',
              }}
            >
              / {wordTarget.toLocaleString()} target
            </span>
          </div>

          {/* Progress bar */}
          <div
            style={{
              height: 3,
              borderRadius: 2,
              backgroundColor: 'var(--studio-border)',
              marginTop: 8,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${progress * 100}%`,
                background: `linear-gradient(90deg, ${color}, color-mix(in srgb, ${color} 80%, transparent))`,
                borderRadius: 2,
                transition: 'width 0.5s ease',
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
