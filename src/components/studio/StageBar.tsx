'use client';

import {
  getStage,
  getNextStage,
  getPreviousStage,
  getContentTypeIdentity,
  STAGES,
} from '@/lib/studio';

/**
 * Stage bar: horizontal pipeline indicator at the top of the editor.
 *
 * Shows current stage with color, forward/back buttons,
 * content type badge, and last saved timestamp.
 * Stage dots show progress through the pipeline.
 */
export default function StageBar({
  stage,
  contentType,
  lastSaved,
  onStageChange,
}: {
  stage: string;
  contentType: string;
  lastSaved: string | null;
  onStageChange: (newStage: string) => void;
}) {
  const current = getStage(stage);
  const next = getNextStage(stage);
  const prev = getPreviousStage(stage);
  const typeInfo = getContentTypeIdentity(contentType);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '10px 20px',
        backgroundColor: 'var(--studio-surface)',
        borderBottom: '1px solid var(--studio-border)',
        flexWrap: 'wrap',
      }}
    >
      {/* Content type badge */}
      <span
        style={{
          fontFamily: 'var(--studio-font-mono)',
          fontSize: '9px',
          fontWeight: 600,
          letterSpacing: '0.1em',
          textTransform: 'uppercase' as const,
          color: typeInfo.color,
          backgroundColor: `${typeInfo.color}18`,
          padding: '3px 8px',
          borderRadius: '3px',
          border: `1px solid ${typeInfo.color}30`,
        }}
      >
        {typeInfo.label}
      </span>

      {/* Stage dots */}
      <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
        {STAGES.map((s) => {
          const isCompleted = s.order < current.order;
          const isCurrent = s.slug === current.slug;
          return (
            <div
              key={s.slug}
              title={s.label}
              style={{
                width: isCurrent ? '20px' : '8px',
                height: '8px',
                borderRadius: isCurrent ? '4px' : '50%',
                backgroundColor: isCurrent
                  ? s.color
                  : isCompleted
                    ? `${s.color}80`
                    : 'var(--studio-border)',
                transition: 'all 0.2s ease',
              }}
            />
          );
        })}
      </div>

      {/* Current stage label */}
      <span
        className="studio-stage-badge"
        data-stage={stage}
        style={{ fontSize: '11px' }}
      >
        {current.label}
      </span>

      {/* Stage navigation */}
      <div style={{ display: 'flex', gap: '4px' }}>
        {prev && (
          <button
            type="button"
            onClick={() => onStageChange(prev.slug)}
            style={{
              background: 'none',
              border: '1px solid var(--studio-border)',
              borderRadius: '4px',
              color: 'var(--studio-text-3)',
              fontSize: '11px',
              padding: '2px 8px',
              cursor: 'pointer',
              fontFamily: 'var(--studio-font-body)',
            }}
            title={`Back to ${prev.label}`}
          >
            ← {prev.label}
          </button>
        )}
        {next && (
          <button
            type="button"
            onClick={() => onStageChange(next.slug)}
            style={{
              background: `${next.color}20`,
              border: `1px solid ${next.color}40`,
              borderRadius: '4px',
              color: next.color,
              fontSize: '11px',
              fontWeight: 600,
              padding: '2px 10px',
              cursor: 'pointer',
              fontFamily: 'var(--studio-font-body)',
            }}
            title={`Advance to ${next.label}`}
          >
            {next.label} →
          </button>
        )}
      </div>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Last saved */}
      {lastSaved && (
        <span
          style={{
            fontFamily: 'var(--studio-font-mono)',
            fontSize: '10px',
            color: 'var(--studio-text-3)',
          }}
        >
          Saved {lastSaved}
        </span>
      )}
    </div>
  );
}
