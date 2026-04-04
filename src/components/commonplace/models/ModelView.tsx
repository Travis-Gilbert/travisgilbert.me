'use client';

import { useCallback, useState } from 'react';
import ModelListPane from './ModelListPane';
import ModelWorkbench from './ModelWorkbench';
import DotField from '../shared/DotField';
import { useDrawer } from '@/lib/providers/drawer-provider';

/**
 * ModelView: the top-level component for the 'model-view' ViewType.
 *
 * Renders as an internal two-panel layout:
 *   Left (240px, fixed): ModelListPane (card browser)
 *   Right (flex): ModelWorkbench (full argument workspace)
 *
 * When no model is selected, the right panel shows a DotField
 * background with a prompt to select a model.
 *
 * This is a single ViewType ('model-view') that manages its own
 * internal layout, following the same pattern as NotebookView
 * (which shows list or detail based on context).
 */

interface ModelViewProps {
  onOpenObject?: (paneId: string, objectRef: number, title?: string) => void;
  paneId?: string;
}

export default function ModelView({
  onOpenObject,
  paneId,
}: ModelViewProps) {
  const { openDrawer } = useDrawer();
  const [selectedModelId, setSelectedModelId] = useState<number | undefined>(
    undefined,
  );

  const handleOpenObject = useCallback((objectRef: number, objectSlug?: string) => {
    if (paneId && onOpenObject) {
      onOpenObject(paneId, objectRef);
      return;
    }
    openDrawer(objectSlug || String(objectRef));
  }, [paneId, onOpenObject, openDrawer]);

  return (
    <div
      style={{
        display: 'flex',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      {/* Left panel: model list */}
      <div
        style={{
          width: 260,
          flexShrink: 0,
          borderRight: '1px solid var(--cp-border-faint, #ECEAE6)',
          background: 'var(--cp-surface, #F8F7F4)',
          overflow: 'hidden',
        }}
      >
        <ModelListPane
          selectedModelId={selectedModelId}
          onSelectModel={setSelectedModelId}
        />
      </div>

      {/* Right panel: workbench or empty state */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {selectedModelId ? (
          <ModelWorkbench
            key={selectedModelId}
            modelId={selectedModelId}
            onOpenObject={handleOpenObject}
          />
        ) : (
          <div
            style={{
              position: 'relative',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <DotField seed="model-empty" />
            <div
              style={{
                zIndex: 1,
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  fontFamily: 'var(--cp-font-body)',
                  fontSize: 16,
                  fontWeight: 500,
                  color: 'var(--cp-text, #18181B)',
                  marginBottom: 8,
                }}
              >
                Select a model to begin
              </div>
              <div
                style={{
                  fontFamily: 'var(--cp-font-mono)',
                  fontSize: 10,
                  color: 'var(--cp-text-faint, #8A8279)',
                  maxWidth: 320,
                  lineHeight: 1.6,
                  letterSpacing: '0.02em',
                }}
              >
                Models encode your understanding.
                Each one is a testable argument.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
