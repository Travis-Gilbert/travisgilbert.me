'use client';

import { useState, useCallback, useRef } from 'react';
import { OBJECT_TYPES, getObjectTypeIdentity } from '@/lib/commonplace';
import { captureToApi } from '@/lib/commonplace-api';
import type { TiptapUpdatePayload } from '@/components/studio/TiptapEditor';
import type { Editor } from '@tiptap/react';
import dynamic from 'next/dynamic';

/**
 * Lazy-load CommonPlaceEditor to avoid pulling Tiptap's 30+ extensions
 * into the initial bundle. The editor only mounts when ComposeView renders.
 */
const CommonPlaceEditor = dynamic(
  () => import('./CommonPlaceEditor'),
  { ssr: false },
);

/**
 * Full compose pane for CommonPlace.
 *
 * Title field (plain text), object type pill picker,
 * rich text editor (CommonPlaceEditor), and a save bar.
 * On save, posts to the Django capture endpoint and
 * calls onSaved with the new object ID.
 */
export default function ComposeView({
  prefillText,
  prefillType,
  onSaved,
}: {
  prefillText?: string;
  prefillType?: string;
  onSaved?: (objectId: number) => void;
}) {
  const [title, setTitle] = useState('');
  const [objectType, setObjectType] = useState(prefillType ?? 'note');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const editorRef = useRef<Editor | null>(null);
  const bodyRef = useRef<{ html: string; markdown: string }>({
    html: '',
    markdown: '',
  });

  const handleEditorUpdate = useCallback((payload: TiptapUpdatePayload) => {
    bodyRef.current = payload;
  }, []);

  const handleEditorReady = useCallback((editor: Editor) => {
    editorRef.current = editor;
  }, []);

  const handleSave = useCallback(async () => {
    const bodyText = bodyRef.current.markdown || bodyRef.current.html;
    if (!title.trim() && !bodyText.trim()) return;

    setSaving(true);
    setError(null);

    try {
      const result = await captureToApi({
        content: bodyText,
        title: title.trim() || undefined,
        hint_type: objectType,
      });
      onSaved?.(result.object.id);

      // Reset form
      setTitle('');
      bodyRef.current = { html: '', markdown: '' };
      editorRef.current?.commands.clearContent(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to save. Try again.',
      );
    } finally {
      setSaving(false);
    }
  }, [title, objectType, onSaved]);

  const typeIdentity = getObjectTypeIdentity(objectType);

  return (
    <div className="cp-compose-pane">
      {/* Header: type picker pills */}
      <div className="cp-compose-type-bar">
        {OBJECT_TYPES.slice(0, 6).map((t) => (
          <button
            key={t.slug}
            type="button"
            className={`cp-compose-type-pill${objectType === t.slug ? ' active' : ''}`}
            style={{
              '--pill-color': t.color,
            } as React.CSSProperties}
            onClick={() => setObjectType(t.slug)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Title field */}
      <input
        type="text"
        className="cp-compose-title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={`Untitled ${typeIdentity.label}`}
      />

      {/* Editor */}
      <div className="cp-compose-editor-area">
        <CommonPlaceEditor
          initialContent={prefillText}
          initialContentFormat="markdown"
          onUpdate={handleEditorUpdate}
          onEditorReady={handleEditorReady}
        />
      </div>

      {/* Save bar */}
      <div className="cp-compose-save-bar">
        {error && (
          <span className="cp-compose-error">{error}</span>
        )}
        <button
          type="button"
          className="cp-compose-save-btn"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'SAVING...' : 'SAVE OBJECT'}
        </button>
      </div>
    </div>
  );
}
