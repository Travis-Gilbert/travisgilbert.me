'use client';

/**
 * ObjectListPanel: shared compact object card grid.
 *
 * Receives the `objects` array from a notebook or project detail
 * response and renders each as a clickable card with type badge
 * and title. Used inside NotebookView and ProjectView.
 */

import { getObjectTypeIdentity } from '@/lib/commonplace';

interface ObjectItem {
  id: number;
  title: string;
  object_type: string;
}

interface ObjectListPanelProps {
  objects: ObjectItem[];
  onOpenObject?: (objectRef: number, title?: string) => void;
}

export default function ObjectListPanel({ objects, onOpenObject }: ObjectListPanelProps) {
  if (objects.length === 0) {
    return (
      <div className="cp-empty-state">
        No objects in this collection yet.
        <span className="cp-empty-state-hint">
          Drag objects here or capture with this project selected.
        </span>
      </div>
    );
  }

  return (
    <div className="cp-object-list-panel">
      {objects.map((obj) => {
        const typeId = getObjectTypeIdentity(obj.object_type);
        return (
          <button
            key={obj.id}
            type="button"
            className="cp-object-list-card"
            onClick={() => onOpenObject?.(obj.id, obj.title)}
          >
            <span
              className="cp-object-list-card-dot"
              style={{ backgroundColor: typeId.color }}
            />
            <span className="cp-object-list-card-type">{typeId.label}</span>
            <span className="cp-object-list-card-title">{obj.title}</span>
          </button>
        );
      })}
    </div>
  );
}
