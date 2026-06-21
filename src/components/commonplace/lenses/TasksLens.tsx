'use client';

/**
 * Tasks attachment lens. A checklist related to the object; each task renders
 * through TaskRow (FR-040). Done-state is session-local (the task text is what
 * persists; a persisted done flag needs a component-update verb — seam).
 */

import { useState } from 'react';
import { useAttachments } from './use-attachments';
import ObjectRenderer from '../objects/ObjectRenderer';
import type { RenderableObject } from '../objects/ObjectRenderer';
import type { LensViewProps } from './lens-types';

export default function TasksLens({ lens, ctx }: LensViewProps) {
  const { items, saving, note, add, remove } = useAttachments(lens, ctx);
  const [text, setText] = useState('');
  const [done, setDone] = useState<Record<string, boolean>>({});

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    add(text);
    setText('');
  };

  return (
    <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <form onSubmit={submit} style={{ display: 'flex', gap: 6 }}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add a task…"
          aria-label="New task"
          style={{ flex: 1, fontFamily: 'var(--cp-font-body)', fontSize: 13, padding: '6px 8px', borderRadius: 4, border: '1px solid var(--cp-border)', background: 'var(--cp-surface, #fff)', color: 'var(--cp-text)' }}
        />
        <button type="submit" disabled={saving || !text.trim()} style={{ fontFamily: 'var(--cp-font-mono)', fontSize: 11, textTransform: 'uppercase', padding: '4px 12px', borderRadius: 4, border: '1px solid var(--cp-border)', background: 'var(--cp-surface, #fff)', color: 'var(--cp-text)', cursor: 'pointer' }}>Add</button>
      </form>
      {note && <div style={{ fontSize: 11, fontStyle: 'italic', color: 'var(--cp-text-muted)' }}>{note}</div>}
      {items.length === 0 && <div style={{ fontSize: 12, fontStyle: 'italic', color: 'var(--cp-text-muted)' }}>No tasks yet.</div>}
      {items.map((it) => {
        const obj: RenderableObject = {
          id: Number(it.id) || 0, slug: it.id, title: it.value, display_title: it.value,
          object_type_slug: 'task', status: done[it.id] ? 'done' : 'open',
        };
        return (
          <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 8, opacity: done[it.id] ? 0.55 : 1 }}>
            <input type="checkbox" checked={!!done[it.id]} onChange={() => setDone((d) => ({ ...d, [it.id]: !d[it.id] }))} aria-label={`Mark "${it.value}" done`} />
            <div style={{ flex: 1, minWidth: 0, textDecoration: done[it.id] ? 'line-through' : 'none' }}>
              <ObjectRenderer object={obj} variant="dock" />
            </div>
            <button type="button" onClick={() => remove(it.id)} aria-label="Remove" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--cp-text-muted)', fontSize: 14, padding: 2 }}>×</button>
          </div>
        );
      })}
    </div>
  );
}
