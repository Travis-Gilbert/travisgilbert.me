'use client';

/**
 * Notes attachment lens. Adds a persisted note related to the object; the note
 * is minted as a first-class item (gqlPutNote), so it is itself an object and
 * shows up in the target's Cluster / Timeline (FR-040 / FR-041). Notes render
 * through the note card (FR-040).
 */

import { useState } from 'react';
import { useAttachments } from './use-attachments';
import ObjectRenderer from '../objects/ObjectRenderer';
import type { RenderableObject } from '../objects/ObjectRenderer';
import type { LensViewProps } from './lens-types';

export default function NotesLens({ lens, ctx }: LensViewProps) {
  const { items, saving, note, add, remove } = useAttachments(lens, ctx);
  const [text, setText] = useState('');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    add(text);
    setText('');
  };

  return (
    <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`Write a note about "${ctx.objectTitle}"…`}
          aria-label="New note"
          rows={3}
          style={{ resize: 'vertical', fontFamily: 'var(--cp-font-body)', fontSize: 13, padding: 8, borderRadius: 4, border: '1px solid var(--cp-border)', background: 'var(--cp-surface, #fff)', color: 'var(--cp-text)' }}
        />
        <button type="submit" disabled={saving || !text.trim()} style={btn}>{saving ? 'Saving…' : 'Add note'}</button>
      </form>
      {note && <div style={noteStyle}>{note}</div>}
      {items.length === 0 && <Empty>No notes yet.</Empty>}
      {items.map((it) => {
        const obj: RenderableObject = {
          id: Number(it.id) || 0,
          slug: it.itemSlug ?? it.id,
          title: it.value.slice(0, 80),
          display_title: it.value.slice(0, 80),
          object_type_slug: 'note',
          body: it.value,
        };
        return (
          <div key={it.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <ObjectRenderer object={obj} variant="dock" />
            </div>
            <RemoveButton onClick={() => remove(it.id)} />
          </div>
        );
      })}
    </div>
  );
}

const btn: React.CSSProperties = { alignSelf: 'flex-start', fontFamily: 'var(--cp-font-mono)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', padding: '4px 12px', borderRadius: 4, border: '1px solid var(--cp-border)', background: 'var(--cp-surface, #fff)', color: 'var(--cp-text)', cursor: 'pointer' };
const noteStyle: React.CSSProperties = { fontSize: 11, fontStyle: 'italic', color: 'var(--cp-text-muted)' };

function Empty({ children }: { children: React.ReactNode }) {
  return <div style={{ fontFamily: 'var(--cp-font-body)', fontSize: 12, fontStyle: 'italic', color: 'var(--cp-text-muted)' }}>{children}</div>;
}
function RemoveButton({ onClick }: { onClick: () => void }) {
  return <button type="button" onClick={onClick} aria-label="Remove" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--cp-text-muted)', fontSize: 14, lineHeight: 1, padding: 2 }}>×</button>;
}
