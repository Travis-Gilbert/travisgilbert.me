'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

/** Shape stored in localStorage for crash recovery. */
interface DraftBuffer {
  title: string;
  body: string;
  savedAt: number; // Date.now() timestamp
}

/** Result returned by the useDraftBuffer hook. */
export interface DraftBufferState {
  /** Whether a recoverable draft was found on mount. */
  hasRecoverableDraft: boolean;
  /** The recoverable draft content, if any. */
  recoverableDraft: DraftBuffer | null;
  /** Accept the recovered draft (clears the banner). */
  restoreDraft: () => { title: string; body: string } | null;
  /** Discard the recovered draft. */
  discardDraft: () => void;
  /** Buffer current content to localStorage (debounced internally). */
  bufferContent: (title: string, body: string) => void;
  /** Clear the buffer after a successful API save. */
  clearBuffer: () => void;
}

const BUFFER_PREFIX = 'studio-draft:';
const DEBOUNCE_MS = 1000;
const MAX_AGE_MS = 72 * 60 * 60 * 1000; // 72 hours

function storageKey(contentType: string, slug: string): string {
  return `${BUFFER_PREFIX}${contentType}:${slug}`;
}

function readBuffer(key: string): DraftBuffer | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DraftBuffer;
    if (
      typeof parsed.title !== 'string' ||
      typeof parsed.body !== 'string' ||
      typeof parsed.savedAt !== 'number'
    ) {
      return null;
    }
    // Auto-discard drafts older than 72 hours
    if (Date.now() - parsed.savedAt > MAX_AGE_MS) {
      window.localStorage.removeItem(key);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeBuffer(key: string, draft: DraftBuffer): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(draft));
  } catch {
    // localStorage full or unavailable; silently skip
  }
}

function removeBuffer(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // best effort
  }
}

/**
 * Hook that maintains a localStorage draft buffer for crash recovery.
 *
 * On mount, checks if a draft buffer exists that is newer than the
 * server's last save. If so, surfaces it for the user to restore or
 * discard. Buffers content on every change (debounced to 1s). Clears
 * the buffer after a successful API save.
 */
export function useDraftBuffer(
  contentType: string,
  slug: string,
  serverUpdatedAt?: string | null,
): DraftBufferState {
  const key = storageKey(contentType, slug);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [recoverableDraft, setRecoverableDraft] = useState<DraftBuffer | null>(null);

  // Check for recoverable draft on mount
  useEffect(() => {
    const buffer = readBuffer(key);
    if (!buffer) {
      setRecoverableDraft(null);
      return;
    }

    // Compare buffer timestamp with server's updatedAt
    const serverTime = serverUpdatedAt ? new Date(serverUpdatedAt).getTime() : 0;
    if (buffer.savedAt > serverTime) {
      setRecoverableDraft(buffer);
    } else {
      // Server version is newer; discard stale buffer
      removeBuffer(key);
      setRecoverableDraft(null);
    }
  }, [key, serverUpdatedAt]);

  const restoreDraft = useCallback(() => {
    if (!recoverableDraft) return null;
    const { title, body } = recoverableDraft;
    setRecoverableDraft(null);
    removeBuffer(key);
    return { title, body };
  }, [recoverableDraft, key]);

  const discardDraft = useCallback(() => {
    setRecoverableDraft(null);
    removeBuffer(key);
  }, [key]);

  const bufferContent = useCallback(
    (title: string, body: string) => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      debounceRef.current = setTimeout(() => {
        writeBuffer(key, { title, body, savedAt: Date.now() });
      }, DEBOUNCE_MS);
    },
    [key],
  );

  const clearBuffer = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    removeBuffer(key);
  }, [key]);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return {
    hasRecoverableDraft: recoverableDraft !== null,
    recoverableDraft,
    restoreDraft,
    discardDraft,
    bufferContent,
    clearBuffer,
  };
}
