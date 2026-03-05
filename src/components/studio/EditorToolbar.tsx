'use client';

import type { Editor } from '@tiptap/react';

/**
 * Editor formatting toolbar.
 *
 * Icons-only buttons for bold, italic, headings, lists,
 * blockquote, and code. Active state highlighting via
 * editor.isActive() checks.
 */
export default function EditorToolbar({
  editor,
}: {
  editor: Editor | null;
}) {
  if (!editor) return null;

  const buttons: {
    label: string;
    icon: string;
    action: () => void;
    isActive: boolean;
  }[] = [
    {
      label: 'Bold',
      icon: 'B',
      action: () => editor.chain().focus().toggleBold().run(),
      isActive: editor.isActive('bold'),
    },
    {
      label: 'Italic',
      icon: 'I',
      action: () => editor.chain().focus().toggleItalic().run(),
      isActive: editor.isActive('italic'),
    },
    {
      label: 'Heading 2',
      icon: 'H2',
      action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
      isActive: editor.isActive('heading', { level: 2 }),
    },
    {
      label: 'Heading 3',
      icon: 'H3',
      action: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
      isActive: editor.isActive('heading', { level: 3 }),
    },
    {
      label: 'Bullet list',
      icon: '\u2022',
      action: () => editor.chain().focus().toggleBulletList().run(),
      isActive: editor.isActive('bulletList'),
    },
    {
      label: 'Ordered list',
      icon: '1.',
      action: () => editor.chain().focus().toggleOrderedList().run(),
      isActive: editor.isActive('orderedList'),
    },
    {
      label: 'Blockquote',
      icon: '\u201C',
      action: () => editor.chain().focus().toggleBlockquote().run(),
      isActive: editor.isActive('blockquote'),
    },
    {
      label: 'Code block',
      icon: '</>',
      action: () => editor.chain().focus().toggleCodeBlock().run(),
      isActive: editor.isActive('codeBlock'),
    },
    {
      label: 'Horizontal rule',
      icon: '\u2014',
      action: () => editor.chain().focus().setHorizontalRule().run(),
      isActive: false,
    },
  ];

  return (
    <div
      style={{
        display: 'flex',
        gap: '2px',
        padding: '6px 12px',
        borderBottom: '1px solid var(--studio-border)',
        backgroundColor: 'var(--studio-surface)',
        flexWrap: 'wrap',
      }}
    >
      {buttons.map((btn) => (
        <button
          key={btn.label}
          type="button"
          onClick={btn.action}
          title={btn.label}
          style={{
            background: btn.isActive
              ? 'var(--studio-surface-hover)'
              : 'none',
            border: btn.isActive
              ? '1px solid var(--studio-border)'
              : '1px solid transparent',
            borderRadius: '4px',
            color: btn.isActive
              ? 'var(--studio-text-bright)'
              : 'var(--studio-text-3)',
            fontSize: '13px',
            fontWeight: btn.isActive ? 700 : 500,
            fontFamily:
              btn.icon === 'B' || btn.icon === 'I'
                ? 'var(--studio-font-title)'
                : 'var(--studio-font-mono)',
            padding: '4px 8px',
            cursor: 'pointer',
            lineHeight: 1,
            minWidth: '28px',
            textAlign: 'center' as const,
          }}
        >
          {btn.icon}
        </button>
      ))}
    </div>
  );
}
