'use client';

import { useEditor, EditorContent, ReactNodeViewRenderer } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { all, createLowlight } from 'lowlight';
import CodeBlockNode from './extensions/CodeBlockNode';
import ImageUpload from './extensions/ImageUpload';
import ColorHighlighter from './extensions/ColorHighlighter';
import Mention from '@tiptap/extension-mention';
import { PluginKey } from '@tiptap/pm/state';
import MentionPopup from './MentionPopup';
import MentionTooltip from './MentionTooltip';
import type { MentionPopupRef } from './MentionPopup';
import { searchContent } from '@/lib/studio-api';
import type { ContentSearchResult } from '@/lib/studio-api';
import Placeholder from '@tiptap/extension-placeholder';
import CharacterCount from '@tiptap/extension-character-count';
import Link from '@tiptap/extension-link';
import ResizableImage from './extensions/ResizableImage';
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
import { searchCommonplace } from '@/lib/studio-api';
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
import DragHandle from './extensions/DragHandle';
import CustomInputRules from './extensions/CustomInputRules';
import ChartPickerPopup from './ChartPickerPopup';
import type { ChartEmbed } from '@/lib/studio-charts';
import { useState, useEffect, useCallback, useRef } from 'react';
import type { Editor } from '@tiptap/react';

const lowlight = createLowlight(all);

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
  placeholder: placeholderText = 'Start writing...',
  stage,
  stageColor,
  titleZone,
  toolbar,
  paperOverlay,
}: {
  initialContent?: string;
  initialContentFormat?: 'html' | 'markdown';
  onUpdate?: (payload: TiptapUpdatePayload) => void;
  onEditorReady?: (editor: Editor) => void;
  onFocusChange?: (focused: boolean) => void;
  typewriterMode?: boolean;
  placeholder?: string;
  stage?: string;
  stageColor?: string;
  titleZone?: React.ReactNode;
  toolbar?: React.ReactNode;
  paperOverlay?: React.ReactNode;
}) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const typewriterFrameRef = useRef<number | null>(null);

  const [wikiPopup, setWikiPopup] = useState<{
    visible: boolean;
    query: string;
    from: number;
    position: { x: number; y: number };
  }>({ visible: false, query: '', from: 0, position: { x: 0, y: 0 } });

  const [wikiSearchResults, setWikiSearchResults] = useState<
    WikiSuggestionItem[]
  >([]);
  const wikiDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const editorRef = useRef<Editor | null>(null);
  const slashPopupRef = useRef<SlashCommandPopupRef | null>(null);
  const mentionPopupRef = useRef<MentionPopupRef | null>(null);

  const [mentionPopup, setMentionPopup] = useState<{
    visible: boolean;
    items: ContentSearchResult[];
    position: { x: number; y: number };
    command: ((item: ContentSearchResult) => void) | null;
  }>({ visible: false, items: [], position: { x: 0, y: 0 }, command: null });

  const [slashPopup, setSlashPopup] = useState<{
    visible: boolean;
    query: string;
    items: SlashCommandItem[];
    position: { x: number; y: number };
    command: ((item: SlashCommandItem) => void) | null;
  }>({ visible: false, query: '', items: [], position: { x: 0, y: 0 }, command: null });

  const [chartPickerOpen, setChartPickerOpen] = useState(false);

  useEffect(() => {
    function onOpenChartPicker() {
      setChartPickerOpen(true);
    }
    window.addEventListener('studio:open-chart-picker', onOpenChartPicker);
    return () => window.removeEventListener('studio:open-chart-picker', onOpenChartPicker);
  }, []);

  const handleChartSelect = useCallback(
    (chart: ChartEmbed) => {
      editorRef.current
        ?.chain()
        .focus()
        .setIframe({ src: chart.url, height: chart.defaultHeight })
        .run();
      setChartPickerOpen(false);
    },
    [],
  );

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
        codeBlock: false,
      }),
      CodeBlockLowlight.extend({
        addNodeView() {
          return ReactNodeViewRenderer(CodeBlockNode);
        },
      }).configure({ lowlight }),
      Placeholder.configure({
        placeholder: placeholderText,
      }),
      CharacterCount,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { rel: 'noopener noreferrer nofollow' },
      }),
      ResizableImage.configure({
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
          setWikiSearchResults([]);
        },
        onClose: () => {
          setWikiPopup((prev) => ({ ...prev, visible: false }));
          if (wikiDebounceRef.current) clearTimeout(wikiDebounceRef.current);
          setWikiSearchResults([]);
        },
        onUpdate: (query: string) => {
          setWikiPopup((prev) => ({ ...prev, query }));
          if (wikiDebounceRef.current) clearTimeout(wikiDebounceRef.current);
          if (!query.trim()) {
            setWikiSearchResults([]);
            return;
          }
          wikiDebounceRef.current = setTimeout(() => {
            searchCommonplace(query).then((results) => {
              setWikiSearchResults(
                results.map((r) => ({
                  id: r.id,
                  title: r.title,
                  source: r.source,
                  text: r.text,
                })),
              );
            });
          }, 200);
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
      ImageUpload,
      ColorHighlighter,
      Mention.configure({
        HTMLAttributes: {
          class: 'studio-mention',
        },
        suggestion: {
          char: '@',
          pluginKey: new PluginKey('studioMention'),
          items: async ({ query }: { query: string }) => {
            if (query.length < 2) return [];
            return searchContent(query);
          },
          render: () => ({
            onStart: (props: any) => {
              const coords = props.clientRect?.();
              setMentionPopup({
                visible: true,
                items: props.items,
                position: coords
                  ? { x: coords.x, y: coords.y + coords.height }
                  : { x: 200, y: 200 },
                command: (item: ContentSearchResult) => {
                  props.command({
                    id: item.id,
                    label: item.label,
                    contentType: item.contentType,
                  });
                },
              });
            },
            onUpdate: (props: any) => {
              const coords = props.clientRect?.();
              setMentionPopup((prev) => ({
                ...prev,
                items: props.items,
                position: coords
                  ? { x: coords.x, y: coords.y + coords.height }
                  : prev.position,
                command: (item: ContentSearchResult) => {
                  props.command({
                    id: item.id,
                    label: item.label,
                    contentType: item.contentType,
                  });
                },
              }));
            },
            onKeyDown: ({ event }: { event: KeyboardEvent }) => {
              if (event.key === 'Escape') {
                setMentionPopup((prev) => ({ ...prev, visible: false }));
                return true;
              }
              return mentionPopupRef.current?.onKeyDown(event) ?? false;
            },
            onExit: () => {
              setMentionPopup((prev) => ({ ...prev, visible: false }));
            },
          }),
        },
        renderHTML({ node }) {
          return [
            'span',
            {
              'class': 'studio-mention',
              'data-mention-type': node.attrs.contentType ?? '',
              'data-mention-id': node.attrs.id ?? '',
            },
            `@${node.attrs.label ?? node.attrs.id}`,
          ];
        },
      }),
      Highlight.configure({ multicolor: false }),
      Underline,
      Subscript,
      Superscript,
      Typography.configure({
        emDash: false,
      }),
      Markdown,
      DragHandle,
      CustomInputRules,
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

  /* Dampen wheel scroll speed so the editor doesn't fly past content */
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const DAMPING = 0.45;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      wrapper.scrollTop += e.deltaY * DAMPING;
      wrapper.scrollLeft += e.deltaX * DAMPING;
    };

    wrapper.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      wrapper.removeEventListener('wheel', handleWheel);
    };
  }, []);

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
      {stageColor && (
        <div
          className="studio-stage-strip"
          style={{ '--stage-color': stageColor } as React.CSSProperties}
        />
      )}
      <div className="studio-page" data-stage={stage}>
        <div className="studio-margin-rule" />
        {titleZone}
        {toolbar}
        <EditorContent editor={editor} />
        {paperOverlay}
      </div>
      {wikiPopup.visible && (
        <WikiLinkPopup
          items={wikiSearchResults}
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
      <MentionTooltip containerRef={wrapperRef} />
      {chartPickerOpen && (
        <ChartPickerPopup
          onSelect={handleChartSelect}
          onClose={() => setChartPickerOpen(false)}
        />
      )}
      {mentionPopup.visible && mentionPopup.command && (
        <MentionPopup
          ref={mentionPopupRef}
          items={mentionPopup.items}
          position={mentionPopup.position}
          command={mentionPopup.command}
          onClose={() =>
            setMentionPopup((prev) => ({ ...prev, visible: false }))
          }
        />
      )}
    </div>
  );
}
