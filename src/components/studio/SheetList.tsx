'use client';

import { useState } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import type { DropResult } from '@hello-pangea/dnd';
import { useStudioWorkbench } from './WorkbenchContext';
import type { Sheet } from '@/lib/studio-api';

const STATUS_COLORS: Record<NonNullable<Sheet['status']>, string> = {
  idea: '#C49A4A',
  drafting: '#2D8A7A',
  locked: '#4A72A8',
};

function DragHandle() {
  return (
    <svg
      width="10"
      height="14"
      viewBox="0 0 10 14"
      fill="none"
      aria-hidden="true"
      style={{ flexShrink: 0, opacity: 0.35 }}
    >
      <circle cx="3" cy="2.5" r="1.25" fill="currentColor" />
      <circle cx="3" cy="7" r="1.25" fill="currentColor" />
      <circle cx="3" cy="11.5" r="1.25" fill="currentColor" />
      <circle cx="7" cy="2.5" r="1.25" fill="currentColor" />
      <circle cx="7" cy="7" r="1.25" fill="currentColor" />
      <circle cx="7" cy="11.5" r="1.25" fill="currentColor" />
    </svg>
  );
}

/**
 * SheetList renders in the StudioSidebar when the active content item has
 * at least one sheet. Supports drag-to-reorder, status dots, material badge,
 * word count targets with progress bars, and add/delete.
 */
export default function SheetList({ fullPanel = false }: { fullPanel?: boolean } = {}) {
  const { editorState } = useStudioWorkbench();
  const {
    sheets,
    activeSheetId,
    onSetActiveSheet,
    onAddSheet,
    onDeleteSheet,
    onReorderSheets,
    onToggleMaterial,
    onUpdateSheetTarget,
  } = editorState;

  function handleDragEnd(result: DropResult) {
    if (!result.destination) return;
    if (result.destination.index === result.source.index) return;

    const reordered = Array.from(sheets);
    const [moved] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, moved);
    onReorderSheets?.(reordered.map((s) => s.id));
  }

  /* Aggregate progress for footer */
  const totalWords = sheets.reduce((sum, s) => sum + s.wordCount, 0);
  const totalTarget = sheets.reduce((sum, s) => sum + (s.wordCountTarget ?? 0), 0);

  return (
    <div className="studio-sheet-list-section" style={fullPanel ? { flex: 1, overflowY: 'auto' } : undefined}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 18px 4px',
        }}
      >
        <span className="studio-nav-section-label" style={{ padding: 0 }}>
          SHEETS
        </span>
        <button
          type="button"
          onClick={onAddSheet}
          className="studio-sheet-add-btn"
          aria-label="Add sheet"
          title="Add sheet"
        >
          +
        </button>
      </div>

      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="sheet-list">
          {(droppableProvided) => (
            <div
              ref={droppableProvided.innerRef}
              {...droppableProvided.droppableProps}
            >
              {sheets.map((sheet, index) => (
                <SheetItem
                  key={sheet.id}
                  sheet={sheet}
                  index={index}
                  isActive={sheet.id === activeSheetId}
                  onSelect={() => onSetActiveSheet?.(sheet.id)}
                  onDelete={() => onDeleteSheet?.(sheet.id)}
                  onUpdateTarget={onUpdateSheetTarget}
                />
              ))}
              {droppableProvided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      {/* Footer: aggregate progress */}
      {totalTarget > 0 && (
        <div className="studio-sheet-footer">
          <div className="studio-sheet-progress">
            <div
              className="studio-sheet-progress-fill"
              style={{ width: `${Math.min(100, (totalWords / totalTarget) * 100)}%` }}
            />
          </div>
          <span className="studio-sheet-footer-text">
            {totalWords.toLocaleString()} / {totalTarget.toLocaleString()}w
          </span>
        </div>
      )}
    </div>
  );
}

/* ── Individual sheet row ─────────────────────── */

function SheetItem({
  sheet,
  index,
  isActive,
  onSelect,
  onDelete,
  onUpdateTarget,
}: {
  sheet: Sheet;
  index: number;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onUpdateTarget?: (id: string, target: number | null) => void;
}) {
  const [editingTarget, setEditingTarget] = useState(false);
  const [targetInput, setTargetInput] = useState('');

  const label = sheet.title.trim() || null;
  const statusColor = sheet.status ? STATUS_COLORS[sheet.status] : null;
  const progress = sheet.wordCountTarget
    ? Math.min(100, (sheet.wordCount / sheet.wordCountTarget) * 100)
    : null;

  const handleTargetClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setTargetInput(sheet.wordCountTarget?.toString() ?? '');
    setEditingTarget(true);
  };

  const commitTarget = () => {
    setEditingTarget(false);
    const val = parseInt(targetInput, 10);
    if (isNaN(val) || val <= 0) {
      onUpdateTarget?.(sheet.id, null);
    } else {
      onUpdateTarget?.(sheet.id, val);
    }
  };

  return (
    <Draggable draggableId={sheet.id} index={index}>
      {(draggableProvided, snapshot) => (
        <div
          ref={draggableProvided.innerRef}
          {...draggableProvided.draggableProps}
          className="studio-sheet-item"
          data-active={isActive ? 'true' : undefined}
          data-dragging={snapshot.isDragging ? 'true' : undefined}
          onClick={onSelect}
        >
          <span
            {...draggableProvided.dragHandleProps}
            className="studio-sheet-drag-handle"
            onClick={(e) => e.stopPropagation()}
          >
            <DragHandle />
          </span>

          {statusColor && (
            <span
              className="studio-sheet-status-dot"
              style={{ backgroundColor: statusColor }}
              title={sheet.status ?? undefined}
            />
          )}

          <span className="studio-sheet-title">
            {label ?? (
              <em style={{ opacity: 0.45 }}>Untitled</em>
            )}
          </span>

          <span className="studio-sheet-meta">
            {sheet.isMaterial && (
              <span className="studio-sheet-material-badge">
                REF
              </span>
            )}
            {editingTarget ? (
              <input
                type="number"
                className="studio-sheet-target-input"
                value={targetInput}
                onChange={(e) => setTargetInput(e.target.value)}
                onBlur={commitTarget}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitTarget();
                  if (e.key === 'Escape') setEditingTarget(false);
                }}
                onClick={(e) => e.stopPropagation()}
                autoFocus
                placeholder="target"
                min={1}
              />
            ) : (
              <span
                className="studio-sheet-wordcount"
                onClick={handleTargetClick}
                title="Click to set word count target"
                style={{ cursor: 'pointer' }}
              >
                {sheet.wordCount > 0 ? `${sheet.wordCount}w` : '0w'}
                {sheet.wordCountTarget ? ` / ${sheet.wordCountTarget}` : ''}
              </span>
            )}
            <button
              type="button"
              className="studio-sheet-delete-btn"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              aria-label={`Delete sheet ${label ?? 'Untitled'}`}
              title="Delete sheet"
            >
              &times;
            </button>
          </span>

          {/* Progress bar */}
          {progress !== null && (
            <div className="studio-sheet-progress">
              <div
                className="studio-sheet-progress-fill"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
        </div>
      )}
    </Draggable>
  );
}
