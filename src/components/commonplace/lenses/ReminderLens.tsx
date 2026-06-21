'use client';

/**
 * Reminder attachment lens. A time-triggered resurface of the object. The
 * chosen time persists as an attachment (ISO string); firing the reminder is a
 * scheduler concern (seam) — this lens owns capturing and listing the times.
 */

import { useState } from 'react';
import { useAttachments } from './use-attachments';
import type { LensViewProps } from './lens-types';

function describe(iso: string): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return iso;
  const diff = ms - Date.now();
  const abs = Math.abs(diff);
  const day = 86400000;
  const when = new Date(ms).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  if (abs < day) return `${diff >= 0 ? 'in' : ''} ${when}${diff < 0 ? ' (past)' : ''}`.trim();
  const days = Math.round(abs / day);
  return `${when} · ${diff >= 0 ? `in ${days}d` : `${days}d ago`}`;
}

export default function ReminderLens({ lens, ctx }: LensViewProps) {
  const { items, saving, note, add, remove } = useAttachments(lens, ctx);
  const [when, setWhen] = useState('');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!when) return;
    add(new Date(when).toISOString());
    setWhen('');
  };

  return (
    <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <form onSubmit={submit} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <input
          type="datetime-local"
          value={when}
          onChange={(e) => setWhen(e.target.value)}
          aria-label="Reminder time"
          style={{ fontFamily: 'var(--cp-font-body)', fontSize: 13, padding: '6px 8px', borderRadius: 4, border: '1px solid var(--cp-border)', background: 'var(--cp-surface, #fff)', color: 'var(--cp-text)' }}
        />
        <button type="submit" disabled={saving || !when} style={{ fontFamily: 'var(--cp-font-mono)', fontSize: 11, textTransform: 'uppercase', padding: '4px 12px', borderRadius: 4, border: '1px solid var(--cp-border)', background: 'var(--cp-surface, #fff)', color: 'var(--cp-text)', cursor: 'pointer' }}>Set</button>
      </form>
      {note && <div style={{ fontSize: 11, fontStyle: 'italic', color: 'var(--cp-text-muted)' }}>{note}</div>}
      {items.length === 0 && <div style={{ fontSize: 12, fontStyle: 'italic', color: 'var(--cp-text-muted)' }}>No reminders set.</div>}
      {items.map((it) => (
        <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 6, border: '1px solid var(--cp-border-faint)' }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: lens.color, flexShrink: 0 }} />
          <span style={{ flex: 1, fontFamily: 'var(--cp-font-body)', fontSize: 12, color: 'var(--cp-text)' }}>{describe(it.value)}</span>
          <button type="button" onClick={() => remove(it.id)} aria-label="Remove reminder" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--cp-text-muted)', fontSize: 14, padding: 2 }}>×</button>
        </div>
      ))}
    </div>
  );
}
