'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { getContentTypeIdentity } from '@/lib/studio';
import type { WorkbenchAutosaveState, WorkbenchSaveState } from './WorkbenchContext';
import PublishButton from './PublishButton';

type StageOption = {
  slug: string;
  label: string;
};

const STAGE_FLOW: StageOption[] = [
  { slug: 'idea', label: 'Idea' },
  { slug: 'research', label: 'Research' },
  { slug: 'drafting', label: 'Drafting' },
  { slug: 'revising', label: 'Editing' },
  { slug: 'production', label: 'Production' },
  { slug: 'published', label: 'Published' },
];

function findStageIndex(stage: string): number {
  return STAGE_FLOW.findIndex((item) => item.slug === stage);
}

/**
 * Stage stepper for the editor header: current stage select plus back/advance
 * actions with confirmation before mutating stage.
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

  const currentIndex = findStageIndex(stage);
  const stageOptions =
    currentIndex >= 0
      ? STAGE_FLOW
      : [
          {
            slug: stage,
            label: stage.charAt(0).toUpperCase() + stage.slice(1),
          },
          ...STAGE_FLOW,
        ];
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
    onStageChange(pendingStage);
    setPendingStage(null);
    setAnchorDirection(null);
  };

  return (
    <div className="studio-stage-stepper-shell">
      <div className="studio-editor-column studio-stage-stepper">
      <span
        style={{
          fontFamily: 'var(--studio-font-mono)',
          fontSize: '9px',
          fontWeight: 600,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: typeInfo.color,
          backgroundColor: `${typeInfo.color}18`,
          padding: '3px 8px',
          borderRadius: '3px',
          border: `1px solid ${typeInfo.color}30`,
        }}
      >
        {typeInfo.label}
      </span>

      <label
        htmlFor="studio-stage-select"
        style={{
          fontFamily: 'var(--studio-font-mono)',
          fontSize: '10px',
          color: 'var(--studio-text-3)',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
        }}
      >
        Stage
      </label>

      <select
        id="studio-stage-select"
        value={stage}
        onChange={(event) => {
          const target = event.target.value;
          const targetIndex = findStageIndex(target);
          const direction =
            targetIndex >= 0 && currentIndex >= 0 && targetIndex < currentIndex
              ? 'back'
              : 'forward';
          openConfirm(target, direction);
        }}
        style={{
          appearance: 'none',
          fontFamily: 'var(--studio-font-body)',
          fontSize: '12px',
          color: 'var(--studio-text-bright)',
          backgroundColor: 'var(--studio-surface-hover)',
          border: '1px solid var(--studio-border-strong)',
          borderRadius: '8px',
          padding: '5px 10px',
          minWidth: '140px',
        }}
      >
        {stageOptions.map((item) => (
          <option key={item.slug} value={item.slug}>
            {item.label}
          </option>
        ))}
      </select>

      <div style={{ display: 'flex', gap: '6px' }}>
        <button
          type="button"
          disabled={!previousStage}
          onClick={() => {
            if (previousStage) openConfirm(previousStage.slug, 'back');
          }}
          aria-label="Move to previous stage"
          style={{
            background: 'none',
            border: '1px solid var(--studio-border)',
            borderRadius: '6px',
            color: previousStage ? 'var(--studio-text-2)' : 'var(--studio-text-3)',
            fontSize: '11px',
            padding: '4px 9px',
            cursor: previousStage ? 'pointer' : 'not-allowed',
            fontFamily: 'var(--studio-font-body)',
            opacity: previousStage ? 1 : 0.55,
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
          style={{
            background: 'var(--studio-surface-hover)',
            border: '1px solid var(--studio-border-strong)',
            borderRadius: '6px',
            color: nextStage ? 'var(--studio-text-bright)' : 'var(--studio-text-3)',
            fontSize: '11px',
            fontWeight: 600,
            padding: '4px 11px',
            cursor: nextStage ? 'pointer' : 'not-allowed',
            fontFamily: 'var(--studio-font-body)',
            opacity: nextStage ? 1 : 0.55,
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

        {pendingStage && (
          <div
            role="dialog"
            aria-modal="false"
            aria-label="Confirm stage change"
            style={{
              position: 'absolute',
              top: 'calc(100% + 8px)',
              [anchorDirection === 'back' ? 'left' : 'right']: anchorDirection === 'back' ? '20px' : '20px',
              zIndex: 20,
              minWidth: '220px',
              backgroundColor: 'var(--studio-surface)',
              border: '1px solid var(--studio-border-strong)',
              borderRadius: '10px',
              boxShadow: 'var(--studio-shadow)',
              padding: '10px',
            }}
          >
            <p
              style={{
                margin: 0,
                fontFamily: 'var(--studio-font-body)',
                fontSize: '12px',
                color: 'var(--studio-text-2)',
              }}
            >
              Move to {pendingLabel}?
            </p>

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '6px',
                marginTop: '10px',
              }}
            >
              <button
                type="button"
                onClick={cancelConfirm}
                aria-label="Cancel stage change"
                style={{
                  border: '1px solid var(--studio-border)',
                  background: 'none',
                  color: 'var(--studio-text-2)',
                  borderRadius: '6px',
                  padding: '4px 8px',
                  fontSize: '11px',
                  fontFamily: 'var(--studio-font-body)',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                ref={confirmButtonRef}
                type="button"
                onClick={confirmMove}
                aria-label={`Confirm move to ${pendingLabel}`}
                style={{
                  border: '1px solid var(--studio-border-strong)',
                  background: 'var(--studio-surface-hover)',
                  color: 'var(--studio-text-bright)',
                  borderRadius: '6px',
                  padding: '4px 10px',
                  fontSize: '11px',
                  fontWeight: 600,
                  fontFamily: 'var(--studio-font-body)',
                  cursor: 'pointer',
                }}
              >
                Confirm
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
