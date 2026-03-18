'use client';

import { useState, useCallback } from 'react';
import type { Assumption } from '@/lib/commonplace-models';
import AssumptionRow from './AssumptionRow';

/**
 * AssumptionRegister: vertical list of assumption rows with
 * drag-to-reorder support.
 *
 * This is the primary argument structure of a model. Assumptions
 * are ordered by positionIndex (set by the backend ModelClaimRole).
 * Each row is an expandable card showing the claim, its status,
 * confidence, and grouped evidence.
 *
 * Drag-to-reorder uses HTML5 DnD with the custom MIME type
 * 'application/commonplace-assumption' so the global DropZone
 * ignores these drags. A drop indicator line appears between
 * rows during reorder.
 */

interface AssumptionRegisterProps {
  assumptions: Assumption[];
  onOpenObject?: (objectRef: number) => void;
  /** Called with the reordered assumption IDs (top to bottom) */
  onReorder?: (orderedIds: number[]) => void;
}

export default function AssumptionRegister({
  assumptions,
  onOpenObject,
  onReorder,
}: AssumptionRegisterProps) {
  const sorted = [...assumptions].sort(
    (a, b) => a.positionIndex - b.positionIndex,
  );

  /** Index position where the dragged item would be inserted */
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  /** ID of the assumption currently being dragged */
  const [dragId, setDragId] = useState<number | null>(null);

  const handleDragStart = useCallback((assumptionId: number) => {
    setDragId(assumptionId);
  }, []);

  const handleDragOver = useCallback(
    (e: React.DragEvent, overIndex: number) => {
      if (!e.dataTransfer.types.includes('application/commonplace-assumption')) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';

      /* Determine whether to insert above or below the hovered row */
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      const insertIndex = e.clientY < midY ? overIndex : overIndex + 1;
      setDropIndex(insertIndex);
    },
    [],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (dragId === null || dropIndex === null || !onReorder) {
        setDragId(null);
        setDropIndex(null);
        return;
      }

      /* Build the new order */
      const currentOrder = sorted.map((a) => a.id);
      const fromIndex = currentOrder.indexOf(dragId);
      if (fromIndex === -1) {
        setDragId(null);
        setDropIndex(null);
        return;
      }

      /* Remove from old position */
      const newOrder = [...currentOrder];
      newOrder.splice(fromIndex, 1);

      /* Adjust drop index if we removed an item before the drop point */
      const adjustedDrop = dropIndex > fromIndex ? dropIndex - 1 : dropIndex;

      /* Insert at new position */
      newOrder.splice(adjustedDrop, 0, dragId);

      onReorder(newOrder);
      setDragId(null);
      setDropIndex(null);
    },
    [dragId, dropIndex, sorted, onReorder],
  );

  const handleDragEnd = useCallback(() => {
    setDragId(null);
    setDropIndex(null);
  }, []);

  if (sorted.length === 0) {
    return (
      <div
        style={{
          padding: '24px 20px',
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
          No assumptions yet.
        </div>
        <div
          style={{
            fontFamily: 'var(--cp-font-body)',
            fontSize: 12,
            color: 'var(--cp-text-faint, #68666E)',
          }}
        >
          Add claims to build the argument structure.
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        padding: '12px 20px',
      }}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('application/commonplace-assumption')) {
          e.preventDefault();
        }
      }}
      onDrop={handleDrop}
      onDragLeave={(e) => {
        /* Clear drop indicator when cursor leaves the register entirely */
        if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) {
          setDropIndex(null);
        }
      }}
    >
      {/* Section label */}
      <div
        style={{
          fontFamily: 'var(--cp-font-mono)',
          fontSize: 10,
          fontWeight: 500,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: 'var(--cp-text-faint, #68666E)',
          marginBottom: 4,
        }}
      >
        Argument Register
      </div>

      {sorted.map((assumption, i) => (
        <div key={assumption.id}>
          {/* Drop indicator line */}
          {dropIndex === i && dragId !== assumption.id && (
            <div
              style={{
                height: 2,
                background: '#B8623D',
                borderRadius: 1,
                margin: '2px 0',
                transition: 'opacity 100ms',
              }}
            />
          )}
          <AssumptionRow
            assumption={assumption}
            index={i}
            isDragSource={dragId === assumption.id}
            onOpenObject={onOpenObject}
            onDragStart={() => handleDragStart(assumption.id)}
            onDragOver={(e) => handleDragOver(e, i)}
            onDragEnd={handleDragEnd}
          />
        </div>
      ))}

      {/* Drop indicator at the bottom */}
      {dropIndex === sorted.length && (
        <div
          style={{
            height: 2,
            background: '#B8623D',
            borderRadius: 1,
            margin: '2px 0',
          }}
        />
      )}
    </div>
  );
}
