'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import CharacterCount from '@tiptap/extension-character-count';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Highlight from '@tiptap/extension-highlight';
import Underline from '@tiptap/extension-underline';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import Typography from '@tiptap/extension-typography';
import { useEffect, useCallback, useRef } from 'react';
import type { Editor } from '@tiptap/react';

/**
 * Tiptap writing surface with full markdown feature support.
 *
 * Extensions: StarterKit (bold, italic, strike, code, headings, lists,
 * blockquote, code block, horizontal rule, history) plus Link, Image,
 * Table, Task Lists, Highlight, Underline, Sub/Superscript, Typography
 * (smart quotes and dashes). Debounced auto-save (2s).
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
        heading: { levels: [1, 2, 3, 4] },
      }),
      Placeholder.configure({
        placeholder: 'Start writing...',
      }),
      CharacterCount,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { rel: 'noopener noreferrer nofollow' },
      }),
      Image.configure({
        allowBase64: true,
        HTMLAttributes: { class: 'studio-tiptap-image' },
      }),
      Table.configure({ resizable: false }),
      TableRow,
      TableCell,
      TableHeader,
      TaskList,
      TaskItem.configure({ nested: true }),
      Highlight.configure({ multicolor: false }),
      Underline,
      Subscript,
      Superscript,
      Typography,
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
