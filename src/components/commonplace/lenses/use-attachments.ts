'use client';

/**
 * Shared attachment state for the attachment lenses. Content is persisted
 * server-side via createAttachment (notes become first-class items, FR-041);
 * the object<->attachment binding is cached in localStorage so attachments
 * survive reload + reopening the lens even on the GraphQL-only backend, where
 * a per-object component list is not yet exposed. When the component backend
 * is reachable, its components are merged in.
 */

import { useState, useEffect, useCallback } from 'react';
import type { LensDef, LensContext } from '@/lib/commonplace-lenses';
import { createAttachment, listComponentAttachments, type AttachmentRecord } from './attachment-data';

function storeKey(slug: string, lensId: string): string {
  return `cp-lens-attach:${lensId}:${slug}`;
}

function readStore(slug: string, lensId: string): AttachmentRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(window.localStorage.getItem(storeKey(slug, lensId)) || '[]') as AttachmentRecord[];
  } catch {
    return [];
  }
}

function writeStore(slug: string, lensId: string, recs: AttachmentRecord[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(storeKey(slug, lensId), JSON.stringify(recs));
  } catch {
    /* quota / disabled storage: in-memory only this session */
  }
}

export function useAttachments(lens: LensDef, ctx: LensContext) {
  const [items, setItems] = useState<AttachmentRecord[]>([]);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const { objectSlug } = ctx;
  const lensId = lens.id;

  useEffect(() => {
    setItems(readStore(objectSlug, lensId));
    let cancelled = false;
    listComponentAttachments(objectSlug, lens)
      .then((comps) => {
        if (cancelled || comps.length === 0) return;
        setItems((prev) => {
          const seen = new Set(prev.map((p) => p.value));
          const extra = comps.filter((c) => !seen.has(c.value)).map((c) => ({ id: String(c.id), lensId, value: c.value }));
          return extra.length ? [...prev, ...extra] : prev;
        });
      })
      .catch(() => { /* component backend not reachable; localStorage stands */ });
    return () => { cancelled = true; };
  }, [objectSlug, lens, lensId]);

  const add = useCallback(async (value: string) => {
    const v = value.trim();
    if (!v) return;
    setSaving(true);
    setNote(null);
    let rec: AttachmentRecord = { id: `local-${Date.now()}`, lensId, value: v };
    try {
      rec = await createAttachment(lens, ctx, v);
    } catch {
      setNote('Saved locally — server attach not available on this backend.');
    }
    setItems((prev) => {
      const next = [rec, ...prev];
      writeStore(objectSlug, lensId, next);
      return next;
    });
    setSaving(false);
  }, [lens, lensId, ctx, objectSlug]);

  const remove = useCallback((id: string) => {
    setItems((prev) => {
      const next = prev.filter((i) => i.id !== id);
      writeStore(objectSlug, lensId, next);
      return next;
    });
  }, [objectSlug, lensId]);

  return { items, saving, note, add, remove };
}
