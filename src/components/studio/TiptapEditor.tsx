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
 * (smart quotes and dashes).
 */
export default function TiptapEditor({
  initialContent,
  onUpdate,
  onEditorReady,
  onFocusChange,
}: {
  initialContent?: string;
  onUpdate?: (html: string) => void;
  onEditorReady?: (editor: Editor) => void;
  onFocusChange?: (focused: boolean) => void;
}) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const typewriterFrameRef = useRef<number | null>(null);

  const handleUpdate = useCallback(
    ({ editor: ed }: { editor: Editor }) => {
      onUpdate?.(ed.getHTML());
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
        class: 'studio-tiptap-content studio-prose',
      },
    },
  });

  useEffect(() => {
    if (editor) onEditorReady?.(editor);
  }, [editor, onEditorReady]);

  const centerSelectionInView = useCallback(() => {
    if (!editor?.isFocused) return;
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0).cloneRange();
    range.collapse(true);
    const caretRect =
      range.getClientRects()[0] ?? range.getBoundingClientRect();
    if (!caretRect || (caretRect.top === 0 && caretRect.bottom === 0)) {
      return;
    }

    const wrapperRect = wrapper.getBoundingClientRect();
    const targetY = wrapperRect.top + wrapperRect.height * 0.5;
    const delta = caretRect.top - targetY;

    if (Math.abs(delta) < 14) {
      return;
    }

    wrapper.scrollTop += delta;
  }, [editor]);

  const scheduleTypewriterCenter = useCallback(() => {
    if (typewriterFrameRef.current !== null) {
      cancelAnimationFrame(typewriterFrameRef.current);
    }

    typewriterFrameRef.current = window.requestAnimationFrame(() => {
      typewriterFrameRef.current = null;
      centerSelectionInView();
    });
  }, [centerSelectionInView]);

  useEffect(() => {
    if (!editor) return;

    const handleSelectionActivity = () => {
      scheduleTypewriterCenter();
    };

    editor.on('focus', handleSelectionActivity);
    editor.on('selectionUpdate', handleSelectionActivity);
    editor.on('update', handleSelectionActivity);

    return () => {
      editor.off('focus', handleSelectionActivity);
      editor.off('selectionUpdate', handleSelectionActivity);
      editor.off('update', handleSelectionActivity);
      if (typewriterFrameRef.current !== null) {
        cancelAnimationFrame(typewriterFrameRef.current);
        typewriterFrameRef.current = null;
      }
    };
  }, [editor, scheduleTypewriterCenter]);

  return (
    <div
      ref={wrapperRef}
      className="studio-tiptap-wrapper studio-scrollbar"
      onFocusCapture={() => onFocusChange?.(true)}
      onBlurCapture={(event) => {
        const next = event.relatedTarget as Node | null;
        if (!next || !event.currentTarget.contains(next)) {
          onFocusChange?.(false);
        }
      }}
      style={{
        flex: 1,
        overflowY: 'auto',
      }}
    >
      <div className="studio-page">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
