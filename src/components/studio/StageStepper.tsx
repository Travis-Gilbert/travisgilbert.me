'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { getContentTypeIdentity } from '@/lib/studio';
import type { WorkbenchAutosaveState, WorkbenchSaveState } from './WorkbenchContext';
import PublishButton from './PublishButton';
import StageStamp, { useStageStamp } from './StageStamp';

type StageOption = {
  slug: string;
  label: string;
  color: string;
};

const STAGE_FLOW: StageOption[] = [
  { slug: 'idea', label: 'Idea', color: '#9A8E82' },
  { slug: 'research', label: 'Research', color: '#3A8A9A' },
  { slug: 'drafting', label: 'Drafting', color: '#D4AA4A' },
  { slug: 'revising', label: 'Editing', color: '#8A6A9A' },
  { slug: 'production', label: 'Production', color: '#B45A2D' },
  { slug: 'published', label: 'Published', color: '#6A9A5A' },
];

function findStageIndex(stage: string): number {
  return STAGE_FLOW.findIndex((item) => item.slug === stage);
}

/**
 * Stage stepper: horizontal dot pipeline showing all 6 stages as a connected flow.
 * Past stages are colored dots at 50% opacity; current stage shows a labeled chip
 * with glow animation; future stages are muted dots.
 */
export default function StageStepper({
  stage,
  contentType,
  lastSaved,
  saveState,
  autosaveState,
  onStageChange,
  onPublish,
}: {
  stage: string;
  contentType: string;
  lastSaved: string | null;
  saveState: WorkbenchSaveState;
  autosaveState: WorkbenchAutosaveState;
  onStageChange: (newStage: string) => void;
  onPublish?: () => Promise<void>;
}) {
  const [pendingStage, setPendingStage] = useState<string | null>(null);
  const [anchorDirection, setAnchorDirection] = useState<'back' | 'forward' | null>(
    null,
  );
  const confirmButtonRef = useRef<HTMLButtonElement | null>(null);
  const stamp = useStageStamp();

  const currentIndex = findStageIndex(stage);
  const canMoveBack = currentIndex > 0;
  const canMoveForward =
    currentIndex >= 0 && currentIndex < STAGE_FLOW.length - 1;

  const previousStage = canMoveBack ? STAGE_FLOW[currentIndex - 1] : null;
  const nextStage = canMoveForward ? STAGE_FLOW[currentIndex + 1] : null;

  const pendingLabel = useMemo(() => {
    if (!pendingStage) return '';
    return STAGE_FLOW.find((item) => item.slug === pendingStage)?.label ?? pendingStage;
  }, [pendingStage]);

  const saveMessage =
    saveState === 'saving'
      ? 'Saving...'
      : saveState === 'retrying'
        ? 'Retrying...'
        : saveState === 'error'
          ? 'Save failed'
          : autosaveState === 'saved'
            ? 'Saved'
            : lastSaved
              ? `Saved ${lastSaved}`
              : null;

  const typeInfo = getContentTypeIdentity(contentType);

  useEffect(() => {
    setPendingStage(null);
    setAnchorDirection(null);
  }, [stage]);

  useEffect(() => {
    if (!pendingStage) return;

    confirmButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setPendingStage(null);
        setAnchorDirection(null);
        return;
      }

      if (event.key === 'Enter') {
        event.preventDefault();
        const stageColor = STAGE_FLOW.find((s) => s.slug === pendingStage)?.color ?? '#B45A2D';
        stamp.trigger(pendingStage, stageColor);
        onStageChange(pendingStage);
        setPendingStage(null);
        setAnchorDirection(null);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onStageChange, pendingStage]);

  const openConfirm = (targetStage: string, direction: 'back' | 'forward') => {
    if (!targetStage || targetStage === stage) return;
    setPendingStage(targetStage);
    setAnchorDirection(direction);
  };

  const cancelConfirm = () => {
    setPendingStage(null);
    setAnchorDirection(null);
  };

  const confirmMove = () => {
    if (!pendingStage) return;
    const stageColor = STAGE_FLOW.find((s) => s.slug === pendingStage)?.color ?? '#B45A2D';
    stamp.trigger(pendingStage, stageColor);
    onStageChange(pendingStage);
    setPendingStage(null);
    setAnchorDirection(null);
  };

  return (
    <div className="studio-stage-stepper-shell">
      <div className="studio-editor-column studio-stage-stepper">
        {/* Content type chip */}
        <span
          className="stage-stepper-type-chip"
          style={{
            '--chip-color': typeInfo.color,
          } as React.CSSProperties}
        >
          {typeInfo.label}
        </span>

        {/* Stage pipeline: horizontal dot flow */}
        <div className="stage-pipeline" role="group" aria-label="Content stage pipeline">
          {STAGE_FLOW.map((item, i) => {
            const isCurrent = item.slug === stage;
            const isPast = currentIndex >= 0 && i < currentIndex;
            const isFuture = currentIndex >= 0 && i > currentIndex;

            return (
              <div key={item.slug} className="stage-pipeline-node">
                {/* Connecting line before this dot (skip first) */}
                {i > 0 && (
                  <span
                    className="stage-pipeline-line"
                    style={{
                      backgroundColor: isPast || isCurrent
                        ? `color-mix(in srgb, ${STAGE_FLOW[i - 1].color} 40%, transparent)`
                        : 'rgba(237,231,220,0.1)',
                    }}
                  />
                )}

                {/* Dot + optional label */}
                {isCurrent ? (
                  <span
                    className="stage-pipeline-chip"
                    style={{
                      '--stage-color': item.color,
                    } as React.CSSProperties}
                  >
                    <span className="stage-pipeline-dot stage-pipeline-dot--current" />
                    <span className="stage-pipeline-chip-label">{item.label}</span>
                  </span>
                ) : (
                  <span
                    className={`stage-pipeline-dot ${isPast ? 'stage-pipeline-dot--past' : 'stage-pipeline-dot--future'}`}
                    style={{
                      backgroundColor: isPast
                        ? item.color
                        : isFuture
                          ? 'rgba(237,231,220,0.18)'
                          : item.color,
                    }}
                    title={item.label}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Back / Advance buttons */}
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            type="button"
            disabled={!previousStage}
            onClick={() => {
              if (previousStage) openConfirm(previousStage.slug, 'back');
            }}
            aria-label="Move to previous stage"
            className="stage-stepper-btn stage-stepper-btn--back"
            style={{
              opacity: previousStage ? 1 : 0.55,
              cursor: previousStage ? 'pointer' : 'not-allowed',
            }}
          >
            Back
          </button>

          <button
            type="button"
            disabled={!nextStage}
            onClick={() => {
              if (nextStage) openConfirm(nextStage.slug, 'forward');
            }}
            aria-label="Move to next stage"
            className="stage-stepper-btn stage-stepper-btn--advance"
            style={{
              opacity: nextStage ? 1 : 0.55,
              cursor: nextStage ? 'pointer' : 'not-allowed',
            }}
          >
            Advance
          </button>
        </div>

        {onPublish && (
          <PublishButton
            onPublish={onPublish}
            disabled={stage === 'published'}
          />
        )}

        <div style={{ flex: 1 }} />

        {saveMessage && (
          <span
            className={`studio-save-indicator studio-save-indicator--${saveState === 'idle' && autosaveState === 'saved' ? 'autosaved' : saveState}`}
            aria-live="polite"
            title={saveMessage}
          >
            <span className="studio-save-dot" />
            <span className="studio-save-text">{saveMessage}</span>
          </span>
        )}

        {/* Confirm stage change dialog */}
        {pendingStage && (
          <div
            role="dialog"
            aria-modal="false"
            aria-label="Confirm stage change"
            className="stage-confirm-dialog"
            style={{
              [anchorDirection === 'back' ? 'left' : 'right']: '20px',
            }}
          >
            <p className="stage-confirm-text">
              Move to {pendingLabel}?
            </p>

            <div className="stage-confirm-actions">
              <button
                type="button"
                onClick={cancelConfirm}
                aria-label="Cancel stage change"
                className="stage-stepper-btn stage-stepper-btn--back"
              >
                Cancel
              </button>
              <button
                ref={confirmButtonRef}
                type="button"
                onClick={confirmMove}
                aria-label={`Confirm move to ${pendingLabel}`}
                className="stage-stepper-btn stage-stepper-btn--advance"
              >
                Confirm
              </button>
            </div>
          </div>
        )}
      </div>

      {stamp.stamp && (
        <StageStamp
          stage={stamp.stamp.stage}
          stageColor={stamp.stamp.color}
          onComplete={stamp.clear}
        />
      )}
    </div>
  );
}
