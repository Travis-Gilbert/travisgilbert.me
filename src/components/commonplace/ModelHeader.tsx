'use client';

import type { EpistemicModelDetail } from '@/lib/commonplace-models';
import ModelTypeBadge from './ModelTypeBadge';

/**
 * ModelHeader: sticky header at the top of the model workbench.
 *
 * Shows the model title, type badge, thesis statement, anchor
 * question, and summary stats (assumptions, methods, questions).
 * Stays pinned as the user scrolls through the workspace.
 */

interface ModelHeaderProps {
  model: EpistemicModelDetail;
}

export default function ModelHeader({ model }: ModelHeaderProps) {
  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 10,
        background: 'var(--cp-surface, #F8F7F4)',
        borderBottom: '1px solid var(--cp-border-faint, #ECEAE6)',
        padding: '14px 20px 12px',
      }}
    >
      {/* Row 1: type badge + title */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: 6,
        }}
      >
        <ModelTypeBadge modelType={model.modelType} size="md" />
        <h2
          style={{
            fontFamily: 'var(--cp-font-title)',
            fontSize: 18,
            fontWeight: 600,
            color: 'var(--cp-text, #18181B)',
            margin: 0,
            lineHeight: 1.3,
          }}
        >
          {model.title}
        </h2>
      </div>

      {/* Row 2: thesis */}
      <p
        style={{
          fontFamily: 'var(--cp-font-body)',
          fontSize: 13,
          color: 'var(--cp-text-muted, #48464E)',
          margin: '0 0 8px',
          lineHeight: 1.5,
          maxWidth: 680,
        }}
      >
        {model.thesis}
      </p>

      {/* Row 3: question anchor + stats */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        {/* Question */}
        {model.question && (
          <div
            style={{
              fontFamily: 'var(--cp-font-mono)',
              fontSize: 11,
              color: 'var(--cp-text-faint, #68666E)',
              fontStyle: 'italic',
              flex: 1,
              minWidth: 200,
            }}
          >
            Q: {model.question}
          </div>
        )}

        {/* Stats */}
        <div
          style={{
            display: 'flex',
            gap: 14,
            fontFamily: 'var(--cp-font-mono)',
            fontSize: 10,
            color: 'var(--cp-text-faint, #68666E)',
            letterSpacing: '0.04em',
            flexShrink: 0,
          }}
        >
          <span>
            <strong style={{ color: 'var(--cp-text-muted, #48464E)' }}>
              {model.assumptionCount}
            </strong>{' '}
            assumptions
          </span>
          <span>
            <strong style={{ color: 'var(--cp-text-muted, #48464E)' }}>
              {model.methodCount}
            </strong>{' '}
            methods
          </span>
          <span>
            <strong style={{ color: 'var(--cp-text-muted, #48464E)' }}>
              {model.questionCount}
            </strong>{' '}
            questions
          </span>
        </div>
      </div>
    </div>
  );
}
