'use client';

import { useCallback, useRef, useState } from 'react';
import TiptapEditor from './TiptapEditor';
import type { TiptapUpdatePayload } from './TiptapEditor';
import type { Editor } from '@tiptap/react';

/**
 * Video-specific script editor wrapping TiptapEditor.
 *
 * Loads the video's script_body (markdown) into the same Tiptap
 * surface used for essays, with all extensions enabled. Video-specific
 * slash commands (/scene, /visual, /needs-source) are registered
 * globally in slashCommandItems.ts and appear automatically.
 */
export default function VideoScriptEditor({
  slug,
  initialScript,
  onDirtyChange,
}: {
  slug: string;
  initialScript: string;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const editorRef = useRef<Editor | null>(null);
  const [dirty, setDirty] = useState(false);
  const lastSavedRef = useRef(initialScript);

  const handleUpdate = useCallback(
    (payload: TiptapUpdatePayload) => {
      const isDirty = payload.markdown !== lastSavedRef.current;
      setDirty(isDirty);
      onDirtyChange?.(isDirty);
    },
    [onDirtyChange],
  );

  const handleEditorReady = useCallback((editor: Editor) => {
    editorRef.current = editor;
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      {/* Dirty indicator */}
      {dirty && (
        <div
          className="studio-editor-column"
          style={{
            padding: '6px 0',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span
            style={{
              fontFamily: 'var(--studio-font-mono)',
              fontSize: '9px',
              color: 'var(--studio-tc)',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
            }}
          >
            Unsaved changes
          </span>
        </div>
      )}

      <TiptapEditor
        initialContent={initialScript}
        initialContentFormat="markdown"
        onUpdate={handleUpdate}
        onEditorReady={handleEditorReady}
        typewriterMode={true}
      />
    </div>
  );
}
