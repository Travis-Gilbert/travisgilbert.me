'use client';

/**
 * Photos attachment lens. An image collection related to the object. Images
 * are added by URL (the persisted value); a file-upload path is a seam over the
 * capture/blob backend. Thumbnails render in a grid.
 */

import { useState } from 'react';
import { useAttachments } from './use-attachments';
import type { LensViewProps } from './lens-types';

export default function PhotosLens({ lens, ctx }: LensViewProps) {
  const { items, saving, note, add, remove } = useAttachments(lens, ctx);
  const [url, setUrl] = useState('');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    add(url);
    setUrl('');
  };

  return (
    <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <form onSubmit={submit} style={{ display: 'flex', gap: 6 }}>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Image URL…"
          aria-label="Image URL"
          style={{ flex: 1, fontFamily: 'var(--cp-font-body)', fontSize: 13, padding: '6px 8px', borderRadius: 4, border: '1px solid var(--cp-border)', background: 'var(--cp-surface, #fff)', color: 'var(--cp-text)' }}
        />
        <button type="submit" disabled={saving || !url.trim()} style={{ fontFamily: 'var(--cp-font-mono)', fontSize: 11, textTransform: 'uppercase', padding: '4px 12px', borderRadius: 4, border: '1px solid var(--cp-border)', background: 'var(--cp-surface, #fff)', color: 'var(--cp-text)', cursor: 'pointer' }}>Add</button>
      </form>
      {note && <div style={{ fontSize: 11, fontStyle: 'italic', color: 'var(--cp-text-muted)' }}>{note}</div>}
      {items.length === 0 && <div style={{ fontSize: 12, fontStyle: 'italic', color: 'var(--cp-text-muted)' }}>No photos yet.</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))', gap: 8 }}>
        {items.map((it) => (
          <div key={it.id} style={{ position: 'relative', aspectRatio: '1', borderRadius: 6, overflow: 'hidden', border: '1px solid var(--cp-border-faint)', background: 'var(--cp-border-faint)' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={it.value} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} onError={(e) => { (e.currentTarget.style.display = 'none'); }} />
            <button type="button" onClick={() => remove(it.id)} aria-label="Remove photo" style={{ position: 'absolute', top: 2, right: 2, width: 18, height: 18, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.55)', color: '#fff', cursor: 'pointer', fontSize: 12, lineHeight: 1.2 }}>×</button>
          </div>
        ))}
      </div>
    </div>
  );
}
