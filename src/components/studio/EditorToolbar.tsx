'use client';

import { useCallback } from 'react';
import type { Editor } from '@tiptap/react';

/**
 * Editor formatting toolbar with full markdown feature support.
 *
 * Grouped buttons: text formatting, headings, lists, blocks,
 * links/media, and sub/superscript. Dividers separate groups.
 * Active state highlighting via editor.isActive() checks.
 */
export default function EditorToolbar({
  editor,
}: {
  editor: Editor | null;
}) {
  const setLink = useCallback(() => {
    if (!editor) return;
    const prev = editor.getAttributes('link').href ?? '';
    const url = window.prompt('URL', prev);
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor
      .chain()
      .focus()
      .extendMarkRange('link')
      .setLink({ href: url })
      .run();
  }, [editor]);

  const addImage = useCallback(() => {
    if (!editor) return;
    const url = window.prompt('Image URL');
    if (!url) return;
    editor.chain().focus().setImage({ src: url }).run();
  }, [editor]);

  const insertTable = useCallback(() => {
    if (!editor) return;
    editor
      .chain()
      .focus()
      .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
      .run();
  }, [editor]);

  if (!editor) return null;

  type ToolbarItem =
    | { type: 'button'; label: string; icon: string; action: () => void; isActive: boolean; fontStyle?: 'title' | 'mono' }
    | { type: 'divider' };

  const items: ToolbarItem[] = [
    /* ── Text formatting ── */
    {
      type: 'button',
      label: 'Bold',
      icon: 'B',
      action: () => editor.chain().focus().toggleBold().run(),
      isActive: editor.isActive('bold'),
      fontStyle: 'title',
    },
    {
      type: 'button',
      label: 'Italic',
      icon: 'I',
      action: () => editor.chain().focus().toggleItalic().run(),
      isActive: editor.isActive('italic'),
      fontStyle: 'title',
    },
    {
      type: 'button',
      label: 'Underline',
      icon: 'U',
      action: () => editor.chain().focus().toggleUnderline().run(),
      isActive: editor.isActive('underline'),
      fontStyle: 'title',
    },
    {
      type: 'button',
      label: 'Strikethrough',
      icon: 'S',
      action: () => editor.chain().focus().toggleStrike().run(),
      isActive: editor.isActive('strike'),
      fontStyle: 'title',
    },
    {
      type: 'button',
      label: 'Highlight',
      icon: 'Hi',
      action: () => editor.chain().focus().toggleHighlight().run(),
      isActive: editor.isActive('highlight'),
      fontStyle: 'mono',
    },
    {
      type: 'button',
      label: 'Inline code',
      icon: '`',
      action: () => editor.chain().focus().toggleCode().run(),
      isActive: editor.isActive('code'),
      fontStyle: 'mono',
    },

    { type: 'divider' },

    /* ── Headings ── */
    {
      type: 'button',
      label: 'Heading 1',
      icon: 'H1',
      action: () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
      isActive: editor.isActive('heading', { level: 1 }),
      fontStyle: 'mono',
    },
    {
      type: 'button',
      label: 'Heading 2',
      icon: 'H2',
      action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
      isActive: editor.isActive('heading', { level: 2 }),
      fontStyle: 'mono',
    },
    {
      type: 'button',
      label: 'Heading 3',
      icon: 'H3',
      action: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
      isActive: editor.isActive('heading', { level: 3 }),
      fontStyle: 'mono',
    },
    {
      type: 'button',
      label: 'Heading 4',
      icon: 'H4',
      action: () => editor.chain().focus().toggleHeading({ level: 4 }).run(),
      isActive: editor.isActive('heading', { level: 4 }),
      fontStyle: 'mono',
    },

    { type: 'divider' },

    /* ── Lists ── */
    {
      type: 'button',
      label: 'Bullet list',
      icon: '\u2022',
      action: () => editor.chain().focus().toggleBulletList().run(),
      isActive: editor.isActive('bulletList'),
    },
    {
      type: 'button',
      label: 'Ordered list',
      icon: '1.',
      action: () => editor.chain().focus().toggleOrderedList().run(),
      isActive: editor.isActive('orderedList'),
      fontStyle: 'mono',
    },
    {
      type: 'button',
      label: 'Task list',
      icon: 'TL',
      action: () => editor.chain().focus().toggleTaskList().run(),
      isActive: editor.isActive('taskList'),
      fontStyle: 'mono',
    },

    { type: 'divider' },

    /* ── Blocks ── */
    {
      type: 'button',
      label: 'Blockquote',
      icon: 'Bq',
      action: () => editor.chain().focus().toggleBlockquote().run(),
      isActive: editor.isActive('blockquote'),
      fontStyle: 'mono',
    },
    {
      type: 'button',
      label: 'Code block',
      icon: '[]',
      action: () => editor.chain().focus().toggleCodeBlock().run(),
      isActive: editor.isActive('codeBlock'),
      fontStyle: 'mono',
    },
    {
      type: 'button',
      label: 'Horizontal rule',
      icon: 'HR',
      action: () => editor.chain().focus().setHorizontalRule().run(),
      isActive: false,
      fontStyle: 'mono',
    },

    { type: 'divider' },

    /* ── Links, media, table ── */
    {
      type: 'button',
      label: 'Link',
      icon: 'Ln',
      action: setLink,
      isActive: editor.isActive('link'),
      fontStyle: 'mono',
    },
    {
      type: 'button',
      label: 'Image',
      icon: 'Im',
      action: addImage,
      isActive: false,
      fontStyle: 'mono',
    },
    {
      type: 'button',
      label: 'Table',
      icon: 'Tb',
      action: insertTable,
      isActive: editor.isActive('table'),
      fontStyle: 'mono',
    },

    { type: 'divider' },

    /* ── Sub / Superscript ── */
    {
      type: 'button',
      label: 'Subscript',
      icon: 'x\u2082',
      action: () => editor.chain().focus().toggleSubscript().run(),
      isActive: editor.isActive('subscript'),
      fontStyle: 'mono',
    },
    {
      type: 'button',
      label: 'Superscript',
      icon: 'x\u00B2',
      action: () => editor.chain().focus().toggleSuperscript().run(),
      isActive: editor.isActive('superscript'),
      fontStyle: 'mono',
    },
  ];

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '2px',
        padding: '6px 12px',
        borderBottom: '1px solid var(--studio-border)',
        backgroundColor: 'var(--studio-surface)',
        flexWrap: 'wrap',
      }}
    >
      {items.map((item, i) => {
        if (item.type === 'divider') {
          return (
            <div
              key={`div-${i}`}
              style={{
                width: '1px',
                height: '20px',
                backgroundColor: 'var(--studio-border-strong)',
                margin: '0 4px',
              }}
            />
          );
        }

        const fontFamily =
          item.fontStyle === 'title'
            ? 'var(--studio-font-title)'
            : item.fontStyle === 'mono'
              ? 'var(--studio-font-mono)'
              : 'inherit';

        return (
          <button
            key={item.label}
            type="button"
            onClick={item.action}
            title={item.label}
            style={{
              background: item.isActive
                ? 'var(--studio-surface-hover)'
                : 'none',
              border: item.isActive
                ? '1px solid var(--studio-border)'
                : '1px solid transparent',
              borderRadius: '4px',
              color: item.isActive
                ? 'var(--studio-text-bright)'
                : 'var(--studio-text-3)',
              fontSize: '13px',
              fontWeight: item.isActive ? 700 : 500,
              fontFamily,
              padding: '4px 8px',
              cursor: 'pointer',
              lineHeight: 1,
              minWidth: '28px',
              textAlign: 'center' as const,
              textDecoration:
                item.label === 'Underline' && !item.isActive
                  ? 'underline'
                  : item.label === 'Strikethrough' && !item.isActive
                    ? 'line-through'
                    : 'none',
            }}
          >
            {item.icon}
          </button>
        );
      })}
    </div>
  );
}
