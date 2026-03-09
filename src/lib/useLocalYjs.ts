'use client';

/**
 * useLocalYjs: local-first yjs document with IndexedDB persistence.
 *
 * Creates a yjs Doc scoped to a content item (contentType + slug).
 * Persists all changes to IndexedDB via y-indexeddb so content
 * survives browser crashes and full restarts. No network provider
 * is attached; this is purely local persistence.
 *
 * The hook returns the yjs Doc instance for use with Tiptap's
 * Collaboration extension. The useDraftBuffer hook remains as a
 * lightweight fallback for environments where IndexedDB is unavailable.
 */

import { useEffect, useRef, useState } from 'react';
import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';

const DB_PREFIX = 'studio-yjs:';

export interface UseLocalYjsResult {
  /** The yjs document. Stable across re-renders for the same key. */
  doc: Y.Doc;
  /** Whether IndexedDB has finished loading prior content. */
  synced: boolean;
  /** Destroy the doc and clear its IndexedDB store. */
  destroyAndClear: () => Promise<void>;
}

/**
 * Hook that manages a local-first yjs document backed by IndexedDB.
 *
 * @param contentType Content type slug (e.g. "essay", "field-note")
 * @param slug Content item slug
 * @returns yjs Doc, sync status, and a cleanup helper
 */
export function useLocalYjs(
  contentType: string,
  slug: string,
): UseLocalYjsResult {
  const dbName = `${DB_PREFIX}${contentType}:${slug}`;

  const docRef = useRef<Y.Doc | null>(null);
  const providerRef = useRef<IndexeddbPersistence | null>(null);
  const [synced, setSynced] = useState(false);

  // Stable doc instance: only create when key changes
  if (!docRef.current) {
    docRef.current = new Y.Doc();
  }

  useEffect(() => {
    const doc = new Y.Doc();
    docRef.current = doc;
    setSynced(false);

    const provider = new IndexeddbPersistence(dbName, doc);
    providerRef.current = provider;

    provider.on('synced', () => {
      setSynced(true);
    });

    return () => {
      provider.destroy();
      providerRef.current = null;
      doc.destroy();
      docRef.current = null;
      setSynced(false);
    };
  }, [dbName]);

  const destroyAndClear = async () => {
    const provider = providerRef.current;
    if (provider) {
      await provider.clearData();
      provider.destroy();
      providerRef.current = null;
    }
    const doc = docRef.current;
    if (doc) {
      doc.destroy();
      docRef.current = null;
    }
    setSynced(false);
  };

  return {
    doc: docRef.current!,
    synced,
    destroyAndClear,
  };
}
