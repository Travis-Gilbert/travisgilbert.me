'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import type {
  EpistemicModelDetail,
  ModuleId,
} from '@/lib/commonplace-models';
import {
  MODULE_META,
  fetchModelDetail,
} from '@/lib/commonplace-models';
import DotField from '../shared/DotField';
import ModelHeader from './ModelHeader';
import ModuleToggleBar from './ModuleToggleBar';
import AssumptionRegister from './AssumptionRegister';
import ModuleBrick from './ModuleBrick';
import TensionBrick from './TensionBrick';
import MethodBrick from './MethodBrick';
import CompareBrick from './CompareBrick';
import FalsifyBrick from './FalsifyBrick';
import NarrativeBrick from './NarrativeBrick';

/**
 * ModelWorkbench: two-column workspace for model analysis.
 *
 * Layout (scrollable, not sticky):
 *   1. DotField canvas behind everything
 *   2. ModelHeader
 *   3. ModuleToggleBar
 *   4. Two-column body:
 *      Left: working summary, assumption register, falsify, narratives
 *      Right: tensions, methods, compare
 */

interface ModelWorkbenchProps {
  modelId: number;
  onOpenObject?: (objectRef: number, objectSlug?: string) => void;
}

export default function ModelWorkbench({
  modelId,
  onOpenObject,
}: ModelWorkbenchProps): React.ReactElement {
  const [model, setModel] = useState<EpistemicModelDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [focusedAssumptionId, setFocusedAssumptionId] = useState<number | null>(null);
  const [visibility, setVisibility] = useState<Record<ModuleId, boolean>>({
    tensions: true,
    methods: true,
    compare: true,
    falsify: true,
    narratives: true,
  });

  useEffect(() => {
    let isActive = true;
    fetchModelDetail(modelId)
      .then((detail) => {
        if (!isActive) return;
        setModel(detail);
        setLoadError(null);
        if (detail.assumptions.length > 0) {
          const sorted = [...detail.assumptions].sort(
            (a, b) => a.positionIndex - b.positionIndex,
          );
          setFocusedAssumptionId(sorted[0].id);
        }
      })
      .catch(() => {
        if (!isActive) return;
        setModel(null);
        setLoadError('Could not load this model from Index API.');
      })
      .finally(() => {
        if (isActive) setLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [modelId]);

  const handleToggle = useCallback((id: ModuleId) => {
    setVisibility((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const handleCloseModule = useCallback((id: ModuleId) => {
    setVisibility((prev) => ({ ...prev, [id]: false }));
  }, []);

  const handleOpenObject = useCallback(
    (objectRef: number, objectSlug?: string) => {
      onOpenObject?.(objectRef, objectSlug);
    },
    [onOpenObject],
  );

  const handleFocusAssumption = useCallback((assumptionId: number) => {
    setFocusedAssumptionId(assumptionId);
    requestAnimationFrame(() => {
      const node = document.querySelector<HTMLElement>(`[data-assumption-id="${assumptionId}"]`);
      if (node) node.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }, []);

  /**
   * Reorder assumptions: receives the new order of assumption IDs
   * (top to bottom) and updates each assumption's positionIndex
   * in local state. When the API is wired, this will also PATCH
   * the backend.
   */
  const handleReorderAssumptions = useCallback(
    (orderedIds: number[]) => {
      setModel((prev) => {
        if (!prev) return prev;

        const updated = prev.assumptions.map((a) => {
          const newIndex = orderedIds.indexOf(a.id);
          if (newIndex === -1) return a;
          return { ...a, positionIndex: newIndex };
        });

        return { ...prev, assumptions: updated };
      });

      toast.success('Argument order updated');
    },
    [],
  );

  if (loading) {
    return (
      <div
        style={{
          position: 'relative',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <DotField seed={`model-${modelId}`} />
        <div
          style={{
            fontFamily: 'var(--cp-font-mono)',
            fontSize: 11,
            color: 'var(--cp-text-faint, #68666E)',
            zIndex: 1,
          }}
        >
          Loading live model data...
        </div>
      </div>
    );
  }

  if (!model) {
    return (
      <div
        style={{
          position: 'relative',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <DotField seed={`model-${modelId}`} />
        <div
          style={{
            fontFamily: 'var(--cp-font-mono)',
            fontSize: 11,
            color: 'var(--cp-text-faint, #68666E)',
            zIndex: 1,
            maxWidth: 360,
            textAlign: 'center',
            lineHeight: 1.6,
          }}
        >
          {loadError || 'Model data unavailable.'}
        </div>
      </div>
    );
  }

  const moduleCounts: Record<ModuleId, number> = {
    tensions: model.tensions.length,
    methods: model.methods.length,
    compare: model.canonicalReferences.length,
    falsify: model.falsificationCriteria.length,
    narratives: model.narratives.length,
  };

  const hasRightColumn =
    (visibility.tensions && moduleCounts.tensions > 0) ||
    (visibility.methods && moduleCounts.methods > 0) ||
    (visibility.compare && moduleCounts.compare > 0);

  return (
    <div
      style={{
        position: 'relative',
        height: '100%',
        overflow: 'auto',
        background: 'var(--cp-bg, #F5E6D2)',
      }}
    >
      <DotField seed={`model-${modelId}`} />

      <div style={{ position: 'relative', zIndex: 1 }}>
        <ModelHeader model={model} />
        <ModuleToggleBar
          visibility={visibility}
          counts={moduleCounts}
          onToggle={handleToggle}
        />

        {/* Two-column workspace */}
        <div
          style={{
            display: 'flex',
            gap: 20,
            padding: '16px 24px 48px',
          }}
        >
          {/* Left column: summary, assumptions, falsify, narratives */}
          <div
            style={{
              flex: 1,
              minWidth: 0,
              maxWidth: 600,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            {/* Working summary card */}
            {model.summary && (
              <div
                style={{
                  background: '#1A7A8A0F',
                  border: '1px solid #1A7A8A40',
                  borderRadius: 4,
                  padding: '8px 12px',
                }}
              >
                <div
                  style={{
                    fontFamily: 'var(--cp-font-mono)',
                    fontSize: 8,
                    fontWeight: 600,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    color: '#1A7A8A',
                    marginBottom: 4,
                  }}
                >
                  WORKING SUMMARY
                </div>
                <div
                  style={{
                    fontFamily: 'var(--cp-font-body)',
                    fontSize: 12,
                    color: 'var(--cp-text, #18181B)',
                    lineHeight: 1.5,
                  }}
                >
                  {model.summary}
                </div>
              </div>
            )}

            {/* Assumption register (no ModuleBrick wrapper) */}
            <AssumptionRegister
              assumptions={model.assumptions}
              onOpenObject={handleOpenObject}
              onReorder={handleReorderAssumptions}
              focusedAssumptionId={focusedAssumptionId}
            />

            {/* Falsify brick */}
            {visibility.falsify && moduleCounts.falsify > 0 && (
              <ModuleBrick
                title={MODULE_META.falsify.label}
                accentColor={MODULE_META.falsify.accentColor}
                onClose={() => handleCloseModule('falsify')}
              >
                <FalsifyBrick criteria={model.falsificationCriteria} />
              </ModuleBrick>
            )}

            {/* Narratives brick */}
            {visibility.narratives && moduleCounts.narratives > 0 && (
              <ModuleBrick
                title={MODULE_META.narratives.label}
                accentColor={MODULE_META.narratives.accentColor}
                onClose={() => handleCloseModule('narratives')}
              >
                <NarrativeBrick
                  narratives={model.narratives}
                  onOpenObject={handleOpenObject}
                />
              </ModuleBrick>
            )}
          </div>

          {/* Right column: tensions, methods, compare */}
          {hasRightColumn && (
            <div
              style={{
                width: 240,
                flexShrink: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                overflow: 'hidden',
              }}
            >
              {visibility.tensions && moduleCounts.tensions > 0 && (
                <ModuleBrick
                  title={MODULE_META.tensions.label}
                  accentColor={MODULE_META.tensions.accentColor}
                  onClose={() => handleCloseModule('tensions')}
                >
                  <TensionBrick tensions={model.tensions} onFocusAssumption={handleFocusAssumption} />
                </ModuleBrick>
              )}

              {visibility.methods && moduleCounts.methods > 0 && (
                <ModuleBrick
                  title={MODULE_META.methods.label}
                  accentColor={MODULE_META.methods.accentColor}
                  onClose={() => handleCloseModule('methods')}
                >
                  <MethodBrick methods={model.methods} />
                </ModuleBrick>
              )}

              {visibility.compare && moduleCounts.compare > 0 && (
                <ModuleBrick
                  title={MODULE_META.compare.label}
                  accentColor={MODULE_META.compare.accentColor}
                  onClose={() => handleCloseModule('compare')}
                >
                  <CompareBrick
                    references={model.canonicalReferences}
                    onOpenObject={handleOpenObject}
                  />
                </ModuleBrick>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
