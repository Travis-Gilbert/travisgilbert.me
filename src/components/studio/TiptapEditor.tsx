'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import CharacterCount from '@tiptap/extension-character-count';
import { useEffect, useCallback, useRef } from 'react';
import type { Editor } from '@tiptap/react';

/**
 * Tiptap writing surface.
 *
 * Amarna font on the editor content, placeholder text,
 * debounced auto-save (2s), and character count extension.
 * The parent Editor component owns the editor instance ref.
 */
export default function TiptapEditor({
  initialContent,
  onUpdate,
  onEditorReady,
}: {
  initialContent?: string;
  onUpdate?: (html: string) => void;
  onEditorReady?: (editor: Editor) => void;
}) {
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleUpdate = useCallback(
    ({ editor: ed }: { editor: Editor }) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        onUpdate?.(ed.getHTML());
      }, 2000);
    },
    [onUpdate],
  );

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Placeholder.configure({
        placeholder: 'Start writing...',
      }),
      CharacterCount,
    ],
    content: initialContent ?? '',
    onUpdate: handleUpdate,
    editorProps: {
      attributes: {
        class: 'studio-tiptap-content',
      },
    },
  });

  useEffect(() => {
    if (editor) onEditorReady?.(editor);
  }, [editor, onEditorReady]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  return (
    <div
      className="studio-tiptap-wrapper studio-scrollbar"
      style={{
        flex: 1,
        overflowY: 'auto',
        padding: '32px 40px',
      }}
    >
      <EditorContent editor={editor} />
    </div>
  );
}
