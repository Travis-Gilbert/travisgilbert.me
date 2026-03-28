'use client';

import { useEditor, EditorContent, ReactNodeViewRenderer } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { all, createLowlight } from 'lowlight';
import CodeBlockNode from './extensions/CodeBlockNode';
import ImageUpload from './extensions/ImageUpload';
import ColorHighlighter from './extensions/ColorHighlighter';
import InlineComment from './extensions/InlineComment';
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
import { searchObjects } from '@/lib/commonplace-api';
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
import Collaboration from '@tiptap/extension-collaboration';
import DragHandle from './extensions/DragHandle';
import CustomInputRules from './extensions/CustomInputRules';
import TabIndent from './extensions/TabIndent';
import ChartPickerPopup from './ChartPickerPopup';
import type { ChartEmbed } from '@/lib/studio-charts';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { Editor } from '@tiptap/react';
import type * as Y from 'yjs';

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
  focusFadeActive = false,
  yjsDoc = null,
  yjsSynced = false,
  activeSheetId = null,
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
  focusFadeActive?: boolean;
  activeSheetId?: string | null;
  /** Optional yjs Doc for local-first IndexedDB persistence. */
  yjsDoc?: Y.Doc | null;
  /** Whether the yjs doc has finished syncing from IndexedDB. */
  yjsSynced?: boolean;
}) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const typewriterFrameRef = useRef<number | null>(null);

  const [wikiPopup, setWikiPopup] = useState<{
    visible: boolean;
    query: string;
    from: number;
    referenceRect: DOMRect | null;
  }>({ visible: false, query: '', from: 0, referenceRect: null });

  const [wikiSearchResults, setWikiSearchResults] = useState<
    WikiSuggestionItem[]
  >([]);
  const wikiDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const editorRef = useRef<Editor | null>(null);
  const slashPopupRef = useRef<SlashCommandPopupRef | null>(null);
  const mentionPopupRef = useRef<MentionPopupRef | null>(null);

  /* Gate onUpdate until after Y.js seeding to prevent stale IndexedDB
   * content from propagating to Editor.tsx before server content loads. */
  const contentReadyRef = useRef(!yjsDoc);

  const [mentionPopup, setMentionPopup] = useState<{
    visible: boolean;
    items: ContentSearchResult[];
    referenceRect: DOMRect | null;
    command: ((item: ContentSearchResult) => void) | null;
  }>({ visible: false, items: [], referenceRect: null, command: null });

  const [slashPopup, setSlashPopup] = useState<{
    visible: boolean;
    query: string;
    items: SlashCommandItem[];
    referenceRect: DOMRect | null;
    command: ((item: SlashCommandItem) => void) | null;
  }>({ visible: false, query: '', items: [], referenceRect: null, command: null });

  const [chartPickerOpen, setChartPickerOpen] = useState(false);

  /* Close all suggestion popups when the active sheet changes. The popup
   * states live here in TiptapEditor, but the sheet switch decision lives in
   * Editor.tsx. Without this, a popup opened via [[ while on sheet A would
   * remain visible after the user clicks to sheet B. */
  useEffect(() => {
    setWikiPopup((prev) => (prev.visible ? { ...prev, visible: false } : prev));
    setSlashPopup((prev) => (prev.visible ? { ...prev, visible: false } : prev));
    setMentionPopup((prev) => (prev.visible ? { ...prev, visible: false } : prev));
  }, [activeSheetId]);

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
      /* Suppress updates until Y.js has been seeded with server content.
       * Without this gate, stale IndexedDB content can briefly propagate
       * to Editor.tsx and trigger autosave of old content. */
      if (!contentReadyRef.current) return;

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
            referenceRect: coords
              ? new DOMRect(coords.left, coords.top, 0, coords.bottom - coords.top)
              : null,
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
            /* Search both Studio (Django) and Research API (CommonPlace objects),
             * merge results with Studio items first, deduplicated by title. */
            Promise.allSettled([
              searchCommonplace(query),
              searchObjects(query, 10),
            ]).then(([studioResult, cpResult]) => {
              const items: WikiSuggestionItem[] = [];
              const seenTitles = new Set<string>();

              /* Studio results */
              if (studioResult.status === 'fulfilled') {
                for (const r of studioResult.value) {
                  const key = r.title.toLowerCase();
                  if (!seenTitles.has(key)) {
                    seenTitles.add(key);
                    items.push({ id: r.id, title: r.title, source: r.source, text: r.text });
                  }
                }
              }

              /* CommonPlace object results */
              if (cpResult.status === 'fulfilled') {
                for (const obj of cpResult.value) {
                  const title = obj.display_title || obj.title;
                  const key = title.toLowerCase();
                  if (!seenTitles.has(key)) {
                    seenTitles.add(key);
                    items.push({
                      id: String(obj.id),
                      title,
                      source: 'commonplace',
                      text: obj.object_type_name || 'note',
                    });
                  }
                }
              }

              setWikiSearchResults(items);
            });
          }, 200);
        },
      }),
      SlashCommand.configure({
        suggestion: {
          items: ({ query }: { query: string }) => filterSlashCommands(query),
          render: () => ({
            onStart: (props: any) => {
              setSlashPopup({
                visible: true,
                query: '',
                items: props.items,
                referenceRect: props.clientRect?.() ?? null,
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
      InlineComment,
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
              setMentionPopup({
                visible: true,
                items: props.items,
                referenceRect: props.clientRect?.() ?? null,
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
              setMentionPopup((prev) => ({
                ...prev,
                items: props.items,
                referenceRect: props.clientRect?.() ?? prev.referenceRect,
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
      Highlight.configure({ multicolor: true }),
      Underline,
      Subscript,
      Superscript,
      Typography.configure({
        emDash: false,
      }),
      Markdown,
      DragHandle,
      CustomInputRules,
      TabIndent,
      // Local-first yjs persistence (when doc is provided)
      ...(yjsDoc
        ? [
            Collaboration.configure({
              document: yjsDoc,
              field: 'prosemirror',
            }),
          ]
        : []),
    ],
    content: yjsDoc ? undefined : (initialContent ?? ''),
    contentType: yjsDoc ? undefined : initialContentFormat,
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

  /* Seed yjs doc with server content when first loaded.
   *
   * On page load, `initialContent` comes from the Django API (the
   * authoritative source). The Y.js IndexedDB store may hold stale
   * content from a previous editing session. We always prefer the
   * server content when it's available, because:
   *   1. A successful save followed by refresh should show saved content.
   *   2. A revision restore followed by reload should show restored content.
   *   3. If there was a save failure, the separate useDraftBuffer hook
   *      (localStorage) shows a recovery banner for the unsaved draft.
   */
  const seededRef = useRef(false);
  useEffect(() => {
    if (!yjsDoc || !yjsSynced || !editor || seededRef.current) return;
    seededRef.current = true;

    const fragment = yjsDoc.getXmlFragment('prosemirror');
    if (initialContent) {
      /* Always seed from server content. If the fragment already has
       * data it may be stale (e.g. from before a revision restore).
       *
       * When content is markdown, the Markdown extension's setContent
       * override normally auto-detects the format. But the Collaboration
       * extension can interfere with this. Detect format explicitly and,
       * for markdown, parse through the Markdown extension's parser so
       * headings, lists, etc. render correctly instead of as raw text. */
      const isMarkdown =
        initialContentFormat === 'markdown' ||
        (!initialContentFormat && !/<\/?[a-z][\s\S]*>/i.test(initialContent));
      if (isMarkdown) {
        /* Clean HTML entities that survive in markdown content */
        const cleaned = initialContent
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>');

        const mdExt = editor.extensionManager.extensions.find(
          (e) => e.name === 'markdown',
        );
        const parser = mdExt?.storage?.manager;
        if (parser) {
          const parsed = parser.parse(cleaned);
          editor.commands.setContent(parsed);
        } else {
          /* Fallback: Markdown extension should handle auto-detection */
          editor.commands.setContent(cleaned);
        }
      } else {
        editor.commands.setContent(initialContent);
      }
    } else if (fragment.length === 0) {
      /* No server content and empty fragment: new document, nothing to do */
    }
    /* If no initialContent but fragment has data: keep Y.js content
     * (covers offline / new-item editing) */

    /* Open the update gate now that content is authoritative */
    contentReadyRef.current = true;

    /* Fire an explicit update so Editor.tsx sets the correct baseline
     * snapshot and currentBody after seeding. */
    const md =
      typeof (editor as Editor & { getMarkdown?: () => string }).getMarkdown === 'function'
        ? (editor as Editor & { getMarkdown: () => string }).getMarkdown()
        : editor.getText();
    onUpdate?.({
      html: editor.getHTML(),
      markdown: md,
    });
  }, [yjsDoc, yjsSynced, editor, initialContent, initialContentFormat, onUpdate]);

  /* Reset seed flag when content item changes */
  useEffect(() => {
    seededRef.current = false;
    contentReadyRef.current = !yjsDoc;
  }, [yjsDoc]);

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

    /* Only center on content edits (typing), not on clicks.
       selectionUpdate fires on every click, causing a disorienting
       jump when clicking near the top or bottom of the viewport. */
    editor.on('update', handleSelectionActivity);

    return () => {
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
      <div className="studio-page" data-stage={stage} data-focus-fade={focusFadeActive ? 'true' : undefined}>
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
          referenceRect={wikiPopup.referenceRect}
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
          referenceRect={slashPopup.referenceRect}
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
          referenceRect={mentionPopup.referenceRect}
          command={mentionPopup.command}
          onClose={() =>
            setMentionPopup((prev) => ({ ...prev, visible: false }))
          }
        />
      )}
    </div>
  );
}
