'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import type { EpistemicModelSummary, ModelType } from '@/lib/commonplace-models';
import {
  fetchModels,
  createModel,
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
          background: 'var(--cp-border-faint)',
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
          color: 'var(--cp-text-faint)',
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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState<ModelType>('explanatory');
  const [creating, setCreating] = useState(false);

  const loadModels = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    fetchModels()
      .then(setModels)
      .catch(() => {
        setModels([]);
        setLoadError('Could not load models from Index API.');
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadModels(); }, [loadModels]);

  const handleCreateModel = useCallback(async () => {
    if (!newTitle.trim()) return;
    setCreating(true);
    try {
      const created = await createModel({
        title: newTitle.trim(),
        model_type: newType,
      });
      setNewTitle('');
      setShowCreate(false);
      loadModels();
      onSelectModel(created.id);
    } catch (err) {
      toast.error('Failed to create model');
    } finally {
      setCreating(false);
    }
  }, [newTitle, newType, loadModels, onSelectModel]);

  if (loading) {
    return (
      <div
        style={{
          padding: 20,
          fontFamily: 'var(--cp-font-mono)',
          fontSize: 11,
          color: 'var(--cp-text-faint)',
        }}
      >
        Loading models...
      </div>
    );
  }

  if (loadError) {
    return (
      <div style={{ padding: 20, textAlign: 'center' }}>
        <div
          style={{
            fontFamily: 'var(--cp-font-mono)',
            fontSize: 11,
            color: 'var(--cp-text-faint)',
            letterSpacing: '0.04em',
            marginBottom: 6,
          }}
        >
          Live model data unavailable.
        </div>
        <div
          style={{
            fontFamily: 'var(--cp-font-body)',
            fontSize: 12,
            color: 'var(--cp-text-faint)',
          }}
        >
          {loadError}
        </div>
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
            color: 'var(--cp-text-faint)',
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
            color: 'var(--cp-text-faint)',
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
        background: 'rgba(42, 36, 32, 0.04)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '14px 16px 10px',
          borderBottom: '1px solid var(--cp-border-faint)',
          flexShrink: 0,
        }}
      >
        <h3
          style={{
            fontFamily: 'var(--cp-font-title)',
            fontSize: 16,
            fontWeight: 600,
            color: 'var(--cp-text)',
            margin: 0,
          }}
        >
          Models
        </h3>
        <div
          style={{
            fontFamily: 'var(--cp-font-mono)',
            fontSize: 10,
            color: 'var(--cp-text-faint)',
            marginTop: 4,
            letterSpacing: '0.04em',
          }}
        >
          {models.length} model{models.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* New Model button / inline form */}
      {showCreate ? (
        <div style={{ margin: '8px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Model title"
            autoFocus
            className="cp-input"
            style={{ fontSize: 12 }}
            onKeyDown={(e) => { if (e.key === 'Enter') handleCreateModel(); if (e.key === 'Escape') setShowCreate(false); }}
          />
          <select
            value={newType}
            onChange={(e) => setNewType(e.target.value as ModelType)}
            className="cp-input"
            style={{ fontSize: 11 }}
          >
            {(Object.keys(MODEL_TYPE_META) as ModelType[]).map((t) => (
              <option key={t} value={t}>{MODEL_TYPE_META[t].label}</option>
            ))}
          </select>
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              type="button"
              className="cp-btn-accent"
              style={{ flex: 1 }}
              onClick={handleCreateModel}
              disabled={creating || !newTitle.trim()}
            >
              {creating ? 'Creating...' : 'Create'}
            </button>
            <button
              type="button"
              className="cp-btn-ghost"
              onClick={() => setShowCreate(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="cp-btn-accent"
          style={{ margin: '8px 10px', width: 'calc(100% - 20px)' }}
        >
          <span className="cp-btn-accent-dot" />
          New Model
        </button>
      )}

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
          const confidence = model.modelConfidence ?? 0;

          return (
            <button
              key={model.id}
              onClick={() => onSelectModel(model.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 10px',
                borderRadius: 5,
                border: 'none',
                background: isSelected
                  ? 'rgba(107, 79, 122, 0.06)'
                  : 'transparent',
                cursor: 'pointer',
                textAlign: 'left',
                width: '100%',
                transition: 'background 150ms ease',
              }}
              onMouseEnter={(e) => {
                if (!isSelected) e.currentTarget.style.background = 'rgba(26, 24, 22, 0.03)';
              }}
              onMouseLeave={(e) => {
                if (!isSelected) e.currentTarget.style.background = 'transparent';
              }}
            >
              {/* Purple concept-style type mark */}
              <div style={{
                width: 22, height: 22, borderRadius: '50%',
                background: 'rgba(107, 79, 122, 0.1)',
                border: '1.5px solid rgba(107, 79, 122, 0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#6B4F7A' }} />
              </div>

              {/* Title + type badge */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontFamily: 'var(--cp-font-body)',
                  fontSize: 12,
                  fontWeight: 500,
                  color: 'var(--cp-text)',
                  lineHeight: 1.35,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {model.title}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                  <span style={{
                    fontFamily: 'var(--cp-font-mono)',
                    fontSize: 8,
                    fontWeight: 600,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    color: typeMeta.color,
                  }}>
                    {typeMeta.label}
                  </span>
                  <CardCBar value={confidence} color={typeMeta.color} />
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
