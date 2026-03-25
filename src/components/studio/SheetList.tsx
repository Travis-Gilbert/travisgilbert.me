'use client';

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
 * and add/delete.
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
  } = editorState;

  function handleDragEnd(result: DropResult) {
    if (!result.destination) return;
    if (result.destination.index === result.source.index) return;

    const reordered = Array.from(sheets);
    const [moved] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, moved);
    onReorderSheets?.(reordered.map((s) => s.id));
  }

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
              {sheets.map((sheet, index) => {
                const isActive = sheet.id === activeSheetId;
                const label = sheet.title.trim() || null;
                const statusColor = sheet.status
                  ? STATUS_COLORS[sheet.status]
                  : null;

                return (
                  <Draggable
                    key={sheet.id}
                    draggableId={sheet.id}
                    index={index}
                  >
                    {(draggableProvided, snapshot) => (
                      <div
                        ref={draggableProvided.innerRef}
                        {...draggableProvided.draggableProps}
                        className="studio-sheet-item"
                        data-active={isActive ? 'true' : undefined}
                        data-dragging={snapshot.isDragging ? 'true' : undefined}
                        onClick={() => onSetActiveSheet?.(sheet.id)}
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
                          {sheet.wordCount > 0 && (
                            <span className="studio-sheet-wordcount">
                              {sheet.wordCount}w
                            </span>
                          )}
                          <button
                            type="button"
                            className="studio-sheet-delete-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteSheet?.(sheet.id);
                            }}
                            aria-label={`Delete sheet ${label ?? 'Untitled'}`}
                            title="Delete sheet"
                          >
                            &times;
                          </button>
                        </span>
                      </div>
                    )}
                  </Draggable>
                );
              })}
              {droppableProvided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
    </div>
  );
}
