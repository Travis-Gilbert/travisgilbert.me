'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  DragDropContext,
  Droppable,
  Draggable,
} from '@hello-pangea/dnd';
import type { DropResult } from '@hello-pangea/dnd';
import type {
  EpistemicModelDetail,
  ModuleId,
} from '@/lib/commonplace-models';
import {
  MODULE_META,
  fetchModelDetail,
} from '@/lib/commonplace-models';
import DotField from './DotField';
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
 * ModelWorkbench: full model workspace with argument register,
 * module bricks, and drag reordering.
 *
 * Layout (top to bottom):
 *   1. DotField canvas behind everything
 *   2. ModelHeader (sticky)
 *   3. ModuleToggleBar
 *   4. AssumptionRegister (always visible)
 *   5. CompareBrick (always visible, not draggable)
 *   6. Draggable module bricks (tensions, methods, falsify, narratives)
 *
 * The draggable modules use @hello-pangea/dnd (already installed).
 * Module visibility is toggled via ModuleToggleBar.
 */

interface ModelWorkbenchProps {
  modelId: number;
  onOpenObject?: (paneId: string, objectRef: number) => void;
  paneId?: string;
}

type DraggableModuleId = Exclude<ModuleId, 'compare'>;

const INITIAL_MODULE_ORDER: DraggableModuleId[] = [
  'tensions',
  'methods',
  'falsify',
  'narratives',
];

export default function ModelWorkbench({
  modelId,
  onOpenObject,
  paneId,
}: ModelWorkbenchProps) {
  const [model, setModel] = useState<EpistemicModelDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [moduleOrder, setModuleOrder] =
    useState<DraggableModuleId[]>(INITIAL_MODULE_ORDER);
  const [visibility, setVisibility] = useState<Record<ModuleId, boolean>>({
    tensions: true,
    methods: true,
    compare: true,
    falsify: true,
    narratives: true,
  });

  useEffect(() => {
    setLoading(true);
    fetchModelDetail(modelId)
      .then(setModel)
      .finally(() => setLoading(false));
  }, [modelId]);

  const handleToggle = useCallback((id: ModuleId) => {
    if (id === 'compare') return;
    setVisibility((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const handleDragEnd = useCallback((result: DropResult) => {
    if (!result.destination) return;
    const from = result.source.index;
    const to = result.destination.index;
    if (from === to) return;

    setModuleOrder((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }, []);

  const handleCloseModule = useCallback((id: ModuleId) => {
    if (id === 'compare') return;
    setVisibility((prev) => ({ ...prev, [id]: false }));
  }, []);

  const handleOpenObject = useCallback(
    (objectRef: number) => {
      if (paneId && onOpenObject) {
        onOpenObject(paneId, objectRef);
      }
    },
    [paneId, onOpenObject],
  );

  if (loading || !model) {
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
          Loading model...
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

  const visibleDraggableModules = moduleOrder.filter(
    (id) => visibility[id],
  );

  return (
    <div
      style={{
        position: 'relative',
        height: '100%',
        overflow: 'auto',
        background: 'var(--cp-bg, #F4F3F0)',
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

        {/* Assumption register (always visible) */}
        <AssumptionRegister
          assumptions={model.assumptions}
          onOpenObject={handleOpenObject}
        />

        {/* Module bricks area */}
        <div style={{ padding: '0 20px 28px' }}>
          {/* Compare: always visible, not draggable */}
          {visibility.compare && (
            <div style={{ marginBottom: 12 }}>
              <ModuleBrick
                title={MODULE_META.compare.label}
                accentColor={MODULE_META.compare.accentColor}
                count={moduleCounts.compare}
              >
                <CompareBrick
                  references={model.canonicalReferences}
                  onOpenObject={handleOpenObject}
                />
              </ModuleBrick>
            </div>
          )}

          {/* Draggable module bricks */}
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="model-modules">
              {(provided) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                  }}
                >
                  {visibleDraggableModules.map((moduleId, index) => (
                    <Draggable
                      key={moduleId}
                      draggableId={moduleId}
                      index={index}
                    >
                      {(dragProvided) => (
                        <div
                          ref={dragProvided.innerRef}
                          {...dragProvided.draggableProps}
                        >
                          <ModuleBrick
                            title={MODULE_META[moduleId].label}
                            accentColor={
                              MODULE_META[moduleId].accentColor
                            }
                            count={moduleCounts[moduleId]}
                            onClose={() => handleCloseModule(moduleId)}
                            dragHandleProps={
                              dragProvided.dragHandleProps
                            }
                          >
                            <ModuleContent
                              moduleId={moduleId}
                              model={model}
                              onOpenObject={handleOpenObject}
                            />
                          </ModuleBrick>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────
   Module content dispatch
   ───────────────────────────────────────────────── */

function ModuleContent({
  moduleId,
  model,
  onOpenObject,
}: {
  moduleId: DraggableModuleId;
  model: EpistemicModelDetail;
  onOpenObject?: (objectRef: number) => void;
}) {
  switch (moduleId) {
    case 'tensions':
      return (
        <TensionBrick
          tensions={model.tensions}
          assumptions={model.assumptions}
        />
      );
    case 'methods':
      return <MethodBrick methods={model.methods} />;
    case 'falsify':
      return <FalsifyBrick criteria={model.falsificationCriteria} />;
    case 'narratives':
      return (
        <NarrativeBrick
          narratives={model.narratives}
          onOpenObject={onOpenObject}
        />
      );
  }
}
