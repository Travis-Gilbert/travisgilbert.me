'use client';

import { useState, useCallback } from 'react';
import { Reorder } from 'framer-motion';
import type { ApiComponent } from '@/lib/commonplace';
import { patchComponent, createObjectComponent, deleteComponent } from '@/lib/commonplace-api';

/* ─────────────────────────────────────────────────
   Task value shape stored in component.value (JSON string)
   ───────────────────────────────────────────────── */

interface TaskValue {
  title: string;
  completed: boolean;
  due?: string | null;
  priority?: 'low' | 'medium' | 'high';
  notes?: string;
}

function isTaskComponent(comp: ApiComponent): boolean {
  const type = comp.component_type_name.toLowerCase();
  const key = (comp.key || '').toLowerCase();
  return (
    type === 'task' ||
    (type === 'status' && key.startsWith('task')) ||
    key === 'task' ||
    key.startsWith('task-')
  );
}

function parseTask(comp: ApiComponent): TaskValue {
  if (typeof comp.value !== 'string') {
    const raw = comp.value as unknown as Record<string, unknown>;
    return {
      title: String(raw.title ?? comp.key ?? ''),
      completed: Boolean(raw.completed),
      due: (raw.due as string | null | undefined) ?? null,
      priority: (raw.priority as TaskValue['priority']) ?? 'medium',
      notes: (raw.notes as string | undefined) ?? '',
    };
  }

  try {
    const parsed = JSON.parse(comp.value);
    return {
      title: parsed.title ?? comp.key ?? '',
      completed: Boolean(parsed.completed),
      due: parsed.due ?? null,
      priority: parsed.priority ?? 'medium',
      notes: parsed.notes ?? '',
    };
  } catch {
    return { title: comp.value || comp.key || '', completed: false, priority: 'medium' };
  }
}

/* ─────────────────────────────────────────────────
   Priority color token
   ───────────────────────────────────────────────── */

function priorityClass(priority?: string): string {
  if (priority === 'high') return 'cp-task-row--high';
  if (priority === 'low') return 'cp-task-row--low';
  return '';
}

function formatDue(dateStr: string): string {
  try {
    const d = new Date(dateStr + 'T12:00:00Z');
    const now = new Date();
    const diffDays = Math.round((d.getTime() - now.getTime()) / 86400000);
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays === -1) return 'Yesterday';
    if (diffDays > 0 && diffDays < 8) return `${diffDays}d`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

/* ─────────────────────────────────────────────────
   Individual task row
   ───────────────────────────────────────────────── */

function TaskRow({
  comp,
  onToggle,
  onDelete,
}: {
  comp: ApiComponent;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const task = parseTask(comp);
  const isDue = task.due && new Date(task.due) < new Date();
  const duePast = isDue && !task.completed;

  return (
    <div className={`cp-task-row ${task.completed ? 'cp-task-row--done' : ''} ${priorityClass(task.priority)}`}>
      <button
        type="button"
        className={`cp-task-checkbox ${task.completed ? 'cp-task-checkbox--done' : ''}`}
        onClick={onToggle}
        aria-label={task.completed ? 'Mark incomplete' : 'Mark complete'}
      >
        {task.completed && (
          <svg width={9} height={9} viewBox="0 0 9 9" fill="none" aria-hidden="true">
            <polyline
              points="1.5,4.5 3.5,6.5 7.5,2.5"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </button>
      <span className="cp-task-title">{task.title}</span>
      {task.due && (
        <span className={`cp-task-due ${duePast ? 'cp-task-due--overdue' : ''}`}>
          {formatDue(task.due)}
        </span>
      )}
      <button
        type="button"
        className="cp-task-delete"
        onClick={onDelete}
        aria-label="Delete task"
      >
        <svg width={10} height={10} viewBox="0 0 10 10" fill="none" aria-hidden="true">
          <line x1={2} y1={2} x2={8} y2={8} stroke="currentColor" strokeWidth={1.2} strokeLinecap="round" />
          <line x1={8} y1={2} x2={2} y2={8} stroke="currentColor" strokeWidth={1.2} strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}

/* ─────────────────────────────────────────────────
   Add task inline form
   ───────────────────────────────────────────────── */

function AddTaskForm({ onSave, onCancel }: { onSave: (title: string) => void; onCancel: () => void }) {
  const [title, setTitle] = useState('');

  function submit() {
    const trimmed = title.trim();
    if (!trimmed) return;
    onSave(trimmed);
    setTitle('');
  }

  return (
    <div className="cp-task-add-form">
      <input
        autoFocus
        type="text"
        className="cp-task-add-input"
        placeholder="Task title..."
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit();
          if (e.key === 'Escape') onCancel();
        }}
      />
      <div className="cp-task-add-actions">
        <button type="button" className="cp-task-add-save" onClick={submit} disabled={!title.trim()}>
          Add
        </button>
        <button type="button" className="cp-task-add-cancel" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────
   Main component
   ───────────────────────────────────────────────── */

export default function ObjectTasks({
  objectId,
  components,
  onComponentsChange,
}: {
  objectId: number;
  components: ApiComponent[];
  onComponentsChange: (updated: ApiComponent[]) => void;
}) {
  const taskComponents = components
    .filter(isTaskComponent)
    .sort((a, b) => a.sort_order - b.sort_order);

  const [showAddForm, setShowAddForm] = useState(false);

  const handleToggle = useCallback(
    async (comp: ApiComponent) => {
      const task = parseTask(comp);
      const updated: TaskValue = { ...task, completed: !task.completed };
      const newValue = JSON.stringify(updated);

      // Optimistic update
      onComponentsChange(
        components.map((c) => (c.id === comp.id ? { ...c, value: newValue } : c)),
      );

      try {
        await patchComponent(comp.id, { value: newValue });
      } catch {
        // Revert on failure
        onComponentsChange(components);
      }
    },
    [components, onComponentsChange],
  );

  const handleDelete = useCallback(
    async (comp: ApiComponent) => {
      // Optimistic remove
      onComponentsChange(components.filter((c) => c.id !== comp.id));
      try {
        await deleteComponent(comp.id);
      } catch {
        onComponentsChange(components);
      }
    },
    [components, onComponentsChange],
  );

  const handleAdd = useCallback(
    async (title: string) => {
      setShowAddForm(false);
      const value = JSON.stringify({ title, completed: false, priority: 'medium' });
      const key = `task-${Date.now()}`;
      const sortOrder = taskComponents.length;

      // Optimistic: add temp component with a fake ID
      const tempId = -(Date.now());
      const tempComp: ApiComponent = {
        id: tempId,
        component_type: 0,
        component_type_name: 'Task',
        data_type: 'status',
        key,
        value,
        sort_order: sortOrder,
      };
      onComponentsChange([...components, tempComp]);

      try {
        const result = await createObjectComponent(objectId, {
          component_type_slug: 'task',
          key,
          value,
          sort_order: sortOrder,
        });
        // Replace temp component with real ID
        onComponentsChange([
          ...components.filter((c) => c.id !== tempId),
          { ...tempComp, id: result.id },
        ]);
      } catch {
        onComponentsChange(components.filter((c) => c.id !== tempId));
      }
    },
    [objectId, components, taskComponents.length, onComponentsChange],
  );

  const handleReorder = useCallback(
    async (reordered: ApiComponent[]) => {
      // Build the new full components array preserving non-task components
      const nonTasks = components.filter((c) => !isTaskComponent(c));
      const withNewOrder = reordered.map((c, i) => ({ ...c, sort_order: i }));
      onComponentsChange([...nonTasks, ...withNewOrder]);

      // Fire PATCH for each reordered item
      for (const comp of withNewOrder) {
        try {
          await patchComponent(comp.id, { sort_order: comp.sort_order });
        } catch {
          // Best-effort: ignore individual failures
        }
      }
    },
    [components, onComponentsChange],
  );

  if (taskComponents.length === 0 && !showAddForm) {
    return (
      <div className="cp-object-tasks cp-object-tasks--empty">
        <button
          type="button"
          className="cp-add-task-btn cp-add-task-btn--ghost"
          onClick={() => setShowAddForm(true)}
        >
          + Add task
        </button>
      </div>
    );
  }

  return (
    <div className="cp-object-tasks">
      <div className="cp-object-tasks-header">TASKS</div>
      <Reorder.Group
        axis="y"
        values={taskComponents}
        onReorder={handleReorder}
        className="cp-task-list"
        as="div"
      >
        {taskComponents.map((comp) => (
          <Reorder.Item
            key={comp.id}
            value={comp}
            className="cp-task-item"
            as="div"
            whileDrag={{ scale: 1.02, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
          >
            <TaskRow
              comp={comp}
              onToggle={() => handleToggle(comp)}
              onDelete={() => handleDelete(comp)}
            />
          </Reorder.Item>
        ))}
      </Reorder.Group>

      {showAddForm ? (
        <AddTaskForm onSave={handleAdd} onCancel={() => setShowAddForm(false)} />
      ) : (
        <button
          type="button"
          className="cp-add-task-btn"
          onClick={() => setShowAddForm(true)}
        >
          + Add task
        </button>
      )}
    </div>
  );
}
