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
import ContainBlock from './extensions/ContainBlock';
import WikiLink from './extensions/WikiLink';
import WikiLinkSuggestion from './extensions/WikiLinkSuggestion';
import type { WikiSuggestionItem } from './extensions/WikiLinkSuggestion';
import WikiLinkPopup from './WikiLinkPopup';
import { getMockCommonplaceEntries } from '@/lib/studio-mock-data';
import IframeEmbed from './extensions/IframeEmbed';
import SlashCommand from './extensions/SlashCommand';
import type { SlashCommandItem } from './extensions/SlashCommand';
import { filterSlashCommands } from './extensions/slashCommandItems';
import SlashCommandPopup from './SlashCommandPopup';
import type { SlashCommandPopupRef } from './SlashCommandPopup';
import Highlight from '@tiptap/extension-highlight';
import Underline from '@tiptap/extension-underline';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import Typography from '@tiptap/extension-typography';
import { Markdown } from '@tiptap/markdown';
import { useState, useEffect, useCallback, useRef } from 'react';
import type { Editor } from '@tiptap/react';

export type TiptapUpdatePayload = {
  html: string;
  markdown: string;
};

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
  initialContentFormat = 'html',
  onUpdate,
  onEditorReady,
  onFocusChange,
  typewriterMode = true,
}: {
  initialContent?: string;
  initialContentFormat?: 'html' | 'markdown';
  onUpdate?: (payload: TiptapUpdatePayload) => void;
  onEditorReady?: (editor: Editor) => void;
  onFocusChange?: (focused: boolean) => void;
  typewriterMode?: boolean;
}) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const typewriterFrameRef = useRef<number | null>(null);

  const [wikiPopup, setWikiPopup] = useState<{
    visible: boolean;
    query: string;
    from: number;
    position: { x: number; y: number };
  }>({ visible: false, query: '', from: 0, position: { x: 0, y: 0 } });

  const editorRef = useRef<Editor | null>(null);
  const slashPopupRef = useRef<SlashCommandPopupRef | null>(null);

  const [slashPopup, setSlashPopup] = useState<{
    visible: boolean;
    query: string;
    items: SlashCommandItem[];
    position: { x: number; y: number };
    command: ((item: SlashCommandItem) => void) | null;
  }>({ visible: false, query: '', items: [], position: { x: 0, y: 0 }, command: null });

  const handleUpdate = useCallback(
    ({ editor: ed }: { editor: Editor }) => {
      onUpdate?.({
        html: ed.getHTML(),
        markdown:
          typeof (ed as Editor & { getMarkdown?: () => string }).getMarkdown ===
          'function'
            ? (ed as Editor & { getMarkdown: () => string }).getMarkdown()
            : ed.getText(),
      });
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
      ContainBlock,
      IframeEmbed,
      WikiLink,
      WikiLinkSuggestion.configure({
        onOpen: (query: string, from: number) => {
          const ed = editorRef.current;
          const coords = ed?.view?.coordsAtPos(ed.state.selection.from);
          setWikiPopup({
            visible: true,
            query,
            from,
            position: coords
              ? { x: coords.left, y: coords.bottom }
              : { x: 200, y: 200 },
          });
        },
        onClose: () => {
          setWikiPopup((prev) => ({ ...prev, visible: false }));
        },
        onUpdate: (query: string) => {
          setWikiPopup((prev) => ({ ...prev, query }));
        },
      }),
      SlashCommand.configure({
        suggestion: {
          items: ({ query }: { query: string }) => filterSlashCommands(query),
          render: () => ({
            onStart: (props: any) => {
              const coords = props.clientRect?.();
              setSlashPopup({
                visible: true,
                query: '',
                items: props.items,
                position: coords
                  ? { x: coords.x, y: coords.y + coords.height }
                  : { x: 200, y: 200 },
                command: props.command,
              });
            },
            onUpdate: (props: any) => {
              setSlashPopup((prev) => ({
                ...prev,
                query: props.query,
                items: props.items,
              }));
            },
            onKeyDown: ({ event }: { event: KeyboardEvent }) => {
              if (event.key === 'Escape') {
                setSlashPopup((prev) => ({ ...prev, visible: false }));
                return true;
              }
              return slashPopupRef.current?.onKeyDown(event) ?? false;
            },
            onExit: () => {
              setSlashPopup((prev) => ({ ...prev, visible: false }));
            },
          }),
        },
      }),
      Highlight.configure({ multicolor: false }),
      Underline,
      Subscript,
      Superscript,
      Typography,
      Markdown,
    ],
    content: initialContent ?? '',
    contentType: initialContentFormat,
    onUpdate: handleUpdate,
    editorProps: {
      attributes: {
        class: 'studio-tiptap-content studio-prose',
      },
    },
  });

  useEffect(() => {
    if (editor) {
      editorRef.current = editor;
      onEditorReady?.(editor);
    }
  }, [editor, onEditorReady]);

  const handleWikiSelect = useCallback(
    (item: WikiSuggestionItem) => {
      if (!editor) return;
      const { from: cursorPos } = editor.state.selection;
      const $pos = editor.state.selection.$from;
      const textBefore = $pos.parent.textBetween(0, $pos.parentOffset);
      const bracketIdx = textBefore.lastIndexOf('[[');
      if (bracketIdx < 0) return;

      const absoluteFrom = $pos.start() + bracketIdx;
      const insertText = `[[${item.title}]]`;

      editor
        .chain()
        .focus()
        .deleteRange({ from: absoluteFrom, to: cursorPos })
        .insertContent({
          type: 'text',
          text: insertText,
          marks: [{ type: 'wikiLink', attrs: { title: item.title } }],
        })
        .run();

      setWikiPopup((prev) => ({ ...prev, visible: false }));
    },
    [editor],
  );

  const centerSelectionInView = useCallback(() => {
    if (!editor?.isFocused) return;
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    if (!selection.isCollapsed) return;

    const range = selection.getRangeAt(0).cloneRange();
    const caretRect =
      range.getClientRects()[0] ?? range.getBoundingClientRect();
    if (!caretRect || (caretRect.top === 0 && caretRect.bottom === 0)) {
      return;
    }

    const wrapperRect = wrapper.getBoundingClientRect();
    const targetY = wrapperRect.top + wrapperRect.height * 0.46;
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
    if (!typewriterMode) {
      if (typewriterFrameRef.current !== null) {
        cancelAnimationFrame(typewriterFrameRef.current);
        typewriterFrameRef.current = null;
      }
      return;
    }

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
  }, [editor, scheduleTypewriterCenter, typewriterMode]);

  return (
    <div
      ref={wrapperRef}
      className="studio-tiptap-wrapper studio-scrollbar"
      data-typewriter-mode={typewriterMode ? 'true' : 'false'}
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
      {wikiPopup.visible && (
        <WikiLinkPopup
          items={getMockCommonplaceEntries()}
          query={wikiPopup.query}
          position={wikiPopup.position}
          onSelect={handleWikiSelect}
          onClose={() =>
            setWikiPopup((prev) => ({ ...prev, visible: false }))
          }
        />
      )}
      {slashPopup.visible && slashPopup.command && (
        <SlashCommandPopup
          ref={slashPopupRef}
          items={slashPopup.items}
          position={slashPopup.position}
          command={slashPopup.command}
          onClose={() =>
            setSlashPopup((prev) => ({ ...prev, visible: false }))
          }
        />
      )}
    </div>
  );
}
