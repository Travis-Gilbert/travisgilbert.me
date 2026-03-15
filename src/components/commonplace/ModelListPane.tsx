'use client';

import { useState, useEffect } from 'react';
import type { EpistemicModelSummary } from '@/lib/commonplace-models';
import { fetchModels } from '@/lib/commonplace-models';
import ModelTypeBadge from './ModelTypeBadge';

/**
 * ModelListPane: vertical card list for browsing models.
 *
 * Shows each model as a card with type badge, title, thesis excerpt,
 * and stats. The selected model gets a left-border accent. Clicking
 * a card calls onSelectModel with the model ID.
 */

interface ModelListPaneProps {
  selectedModelId?: number;
  onSelectModel: (modelId: number) => void;
}

export default function ModelListPane({
  selectedModelId,
  onSelectModel,
}: ModelListPaneProps) {
  const [models, setModels] = useState<EpistemicModelSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchModels()
      .then(setModels)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div
        style={{
          padding: 20,
          fontFamily: 'var(--cp-font-mono)',
          fontSize: 11,
          color: 'var(--cp-text-faint, #68666E)',
        }}
      >
        Loading models...
      </div>
    );
  }

  if (models.length === 0) {
    return (
      <div
        style={{
          padding: 20,
          textAlign: 'center',
        }}
      >
        <div
          style={{
            fontFamily: 'var(--cp-font-mono)',
            fontSize: 11,
            color: 'var(--cp-text-faint, #68666E)',
            letterSpacing: '0.04em',
            marginBottom: 6,
          }}
        >
          No models yet.
        </div>
        <div
          style={{
            fontFamily: 'var(--cp-font-body)',
            fontSize: 12,
            color: 'var(--cp-text-faint, #68666E)',
          }}
        >
          Create a model to start structuring your thinking.
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '14px 16px 10px',
          borderBottom: '1px solid var(--cp-border-faint, #ECEAE6)',
          flexShrink: 0,
        }}
      >
        <h3
          style={{
            fontFamily: 'var(--cp-font-title)',
            fontSize: 16,
            fontWeight: 600,
            color: 'var(--cp-text, #18181B)',
            margin: 0,
          }}
        >
          Models
        </h3>
        <div
          style={{
            fontFamily: 'var(--cp-font-mono)',
            fontSize: 10,
            color: 'var(--cp-text-faint, #68666E)',
            marginTop: 4,
            letterSpacing: '0.04em',
          }}
        >
          {models.length} model{models.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Card list */}
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          padding: '8px 10px',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}
      >
        {models.map((model) => {
          const isSelected = model.id === selectedModelId;
          return (
            <button
              key={model.id}
              onClick={() => onSelectModel(model.id)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                padding: '10px 12px',
                borderRadius: 4,
                border: isSelected
                  ? '1px solid var(--cp-border, #E2E0DC)'
                  : '1px solid var(--cp-border-faint, #ECEAE6)',
                borderLeft: isSelected
                  ? '3px solid var(--cp-red, #C4503C)'
                  : '3px solid transparent',
                background: isSelected
                  ? '#FFFFFF'
                  : 'var(--cp-surface, #F8F7F4)',
                cursor: 'pointer',
                textAlign: 'left',
                width: '100%',
                transition: 'all 0.1s ease',
              }}
            >
              {/* Type badge */}
              <ModelTypeBadge modelType={model.modelType} />

              {/* Title */}
              <div
                style={{
                  fontFamily: 'var(--cp-font-body)',
                  fontSize: 13,
                  fontWeight: 600,
                  color: 'var(--cp-text, #18181B)',
                  lineHeight: 1.35,
                }}
              >
                {model.title}
              </div>

              {/* Thesis excerpt */}
              <div
                style={{
                  fontFamily: 'var(--cp-font-body)',
                  fontSize: 11,
                  color: 'var(--cp-text-muted, #48464E)',
                  lineHeight: 1.45,
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {model.thesis}
              </div>

              {/* Stats row */}
              <div
                style={{
                  display: 'flex',
                  gap: 10,
                  fontFamily: 'var(--cp-font-mono)',
                  fontSize: 9,
                  color: 'var(--cp-text-faint, #68666E)',
                  letterSpacing: '0.04em',
                }}
              >
                <span>{model.assumptionCount}A</span>
                <span>{model.methodCount}M</span>
                <span>{model.questionCount}Q</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
