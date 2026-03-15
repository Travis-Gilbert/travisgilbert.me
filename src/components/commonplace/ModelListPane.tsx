'use client';

import { useState, useEffect } from 'react';
import type { EpistemicModelSummary } from '@/lib/commonplace-models';
import {
  fetchModels,
  MODEL_TYPE_META,
  ASSUMPTION_STATUS_META,
} from '@/lib/commonplace-models';

interface ModelListPaneProps {
  selectedModelId?: number;
  onSelectModel: (modelId: number) => void;
}

function CardCBar({
  value,
  color,
}: {
  value: number;
  color: string;
}): React.ReactElement {
  const pct = Math.round(value * 100);
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
      }}
    >
      <span
        style={{
          width: 28,
          height: 2,
          borderRadius: 1,
          background: 'var(--cp-border-faint, #ECEAE6)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            height: '100%',
            width: `${pct}%`,
            background: color,
            borderRadius: 1,
          }}
        />
      </span>
      <span
        style={{
          fontFamily: 'var(--cp-font-mono)',
          fontSize: 7,
          color: 'var(--cp-text-faint, #68666E)',
        }}
      >
        {pct}%
      </span>
    </span>
  );
}

export default function ModelListPane({
  selectedModelId,
  onSelectModel,
}: ModelListPaneProps): React.ReactElement {
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
      <div style={{ padding: 20, textAlign: 'center' }}>
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
          const typeMeta = MODEL_TYPE_META[model.modelType];
          const statusKey = (model.modelStatus ?? 'proposed') as keyof typeof ASSUMPTION_STATUS_META;
          const statusMeta = ASSUMPTION_STATUS_META[statusKey] ?? ASSUMPTION_STATUS_META.proposed;
          const confidence = model.modelConfidence ?? 0;

          return (
            <button
              key={model.id}
              onClick={() => onSelectModel(model.id)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                padding: 0,
                borderRadius: 4,
                overflow: 'hidden',
                border: isSelected
                  ? `1px solid ${typeMeta.color}66`
                  : '1px solid var(--cp-border-faint, #ECEAE6)',
                background: isSelected
                  ? `${typeMeta.color}08`
                  : 'var(--cp-surface, #F8F7F4)',
                cursor: 'pointer',
                textAlign: 'left',
                width: '100%',
                transition: 'all 0.1s ease',
              }}
            >
              {/* Gradient top bar */}
              <div
                style={{
                  height: 2,
                  background: `linear-gradient(to right, ${typeMeta.color}33, ${typeMeta.color}80)`,
                }}
              />

              <div style={{ padding: '6px 10px 8px' }}>
                {/* Title */}
                <div
                  style={{
                    fontFamily: 'var(--cp-font-body)',
                    fontSize: 12,
                    fontWeight: 500,
                    color: 'var(--cp-text, #18181B)',
                    lineHeight: 1.35,
                    marginBottom: 4,
                  }}
                >
                  {model.title}
                </div>

                {/* Type + status + confidence */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    flexWrap: 'wrap',
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'var(--cp-font-mono)',
                      fontSize: 7,
                      fontWeight: 600,
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                      color: typeMeta.color,
                    }}
                  >
                    {typeMeta.label}
                  </span>

                  <span
                    style={{
                      fontFamily: 'var(--cp-font-mono)',
                      fontSize: 7,
                      fontWeight: 500,
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                      color: statusMeta.color,
                    }}
                  >
                    {statusMeta.label}
                  </span>

                  <CardCBar value={confidence} color={statusMeta.color} />
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
