'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';

type ToolbarItem = {
  id: string;
  label: string;
  icon: string;
  action: () => void;
  isActive: boolean;
  tooltip: string;
  fontStyle?: 'title' | 'mono';
};

function fontFamilyForStyle(style?: 'title' | 'mono'): string {
  if (style === 'title') return 'var(--studio-font-title)';
  if (style === 'mono') return 'var(--studio-font-mono)';
  return 'var(--studio-font-body)';
}

/**
 * Editor formatting toolbar: grouped primary controls plus lightweight overflow menu.
 */
export default function EditorToolbar({
  editor,
}: {
  editor: Editor | null;
}) {
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement | null>(null);
  const firstMenuItemRef = useRef<HTMLButtonElement | null>(null);

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

  useEffect(() => {
    if (!isMoreOpen) return;

    const handleOutside = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (target && moreMenuRef.current?.contains(target)) {
        return;
      }
      setIsMoreOpen(false);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMoreOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleEscape);
    firstMenuItemRef.current?.focus();

    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isMoreOpen]);

  if (!editor) return null;

  const formatItems: ToolbarItem[] = [
    {
      id: 'bold',
      label: 'Bold',
      icon: 'B',
      action: () => editor.chain().focus().toggleBold().run(),
      isActive: editor.isActive('bold'),
      tooltip: 'Bold',
      fontStyle: 'title',
    },
    {
      id: 'italic',
      label: 'Italic',
      icon: 'I',
      action: () => editor.chain().focus().toggleItalic().run(),
      isActive: editor.isActive('italic'),
      tooltip: 'Italic',
      fontStyle: 'title',
    },
    {
      id: 'underline',
      label: 'Underline',
      icon: 'U',
      action: () => editor.chain().focus().toggleUnderline().run(),
      isActive: editor.isActive('underline'),
      tooltip: 'Underline',
      fontStyle: 'title',
    },
    {
      id: 'strike',
      label: 'Strikethrough',
      icon: 'S',
      action: () => editor.chain().focus().toggleStrike().run(),
      isActive: editor.isActive('strike'),
      tooltip: 'Strikethrough',
      fontStyle: 'title',
    },
    {
      id: 'h1',
      label: 'Heading 1',
      icon: 'H1',
      action: () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
      isActive: editor.isActive('heading', { level: 1 }),
      tooltip: 'Heading 1',
      fontStyle: 'mono',
    },
    {
      id: 'h2',
      label: 'Heading 2',
      icon: 'H2',
      action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
      isActive: editor.isActive('heading', { level: 2 }),
      tooltip: 'Heading 2',
      fontStyle: 'mono',
    },
    {
      id: 'h3',
      label: 'Heading 3',
      icon: 'H3',
      action: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
      isActive: editor.isActive('heading', { level: 3 }),
      tooltip: 'Heading 3',
      fontStyle: 'mono',
    },
  ];

  const structureItems: ToolbarItem[] = [
    {
      id: 'bullet-list',
      label: 'Bullet list',
      icon: '•',
      action: () => editor.chain().focus().toggleBulletList().run(),
      isActive: editor.isActive('bulletList'),
      tooltip: 'Bullet list',
    },
    {
      id: 'ordered-list',
      label: 'Ordered list',
      icon: '1.',
      action: () => editor.chain().focus().toggleOrderedList().run(),
      isActive: editor.isActive('orderedList'),
      tooltip: 'Numbered list',
      fontStyle: 'mono',
    },
    {
      id: 'blockquote',
      label: 'Blockquote',
      icon: 'Bq',
      action: () => editor.chain().focus().toggleBlockquote().run(),
      isActive: editor.isActive('blockquote'),
      tooltip: 'Blockquote',
      fontStyle: 'mono',
    },
    {
      id: 'horizontal-rule',
      label: 'Horizontal rule',
      icon: 'HR',
      action: () => editor.chain().focus().setHorizontalRule().run(),
      isActive: false,
      tooltip: 'Horizontal rule',
      fontStyle: 'mono',
    },
    {
      id: 'link',
      label: 'Link',
      icon: 'Ln',
      action: setLink,
      isActive: editor.isActive('link'),
      tooltip: 'Add or edit link',
      fontStyle: 'mono',
    },
  ];

  const insertItems: ToolbarItem[] = [
    {
      id: 'image',
      label: 'Image',
      icon: 'Im',
      action: addImage,
      isActive: false,
      tooltip: 'Insert image',
      fontStyle: 'mono',
    },
    {
      id: 'table',
      label: 'Table',
      icon: 'Tb',
      action: insertTable,
      isActive: editor.isActive('table'),
      tooltip: 'Insert table',
      fontStyle: 'mono',
    },
    {
      id: 'code-block',
      label: 'Code block',
      icon: '[]',
      action: () => editor.chain().focus().toggleCodeBlock().run(),
      isActive: editor.isActive('codeBlock'),
      tooltip: 'Code block',
      fontStyle: 'mono',
    },
  ];

  const overflowItems: ToolbarItem[] = [
    {
      id: 'highlight',
      label: 'Highlight',
      icon: 'Hi',
      action: () => editor.chain().focus().toggleHighlight().run(),
      isActive: editor.isActive('highlight'),
      tooltip: 'Highlight',
      fontStyle: 'mono',
    },
    {
      id: 'inline-code',
      label: 'Inline code',
      icon: '`',
      action: () => editor.chain().focus().toggleCode().run(),
      isActive: editor.isActive('code'),
      tooltip: 'Inline code',
      fontStyle: 'mono',
    },
    {
      id: 'h4',
      label: 'Heading 4',
      icon: 'H4',
      action: () => editor.chain().focus().toggleHeading({ level: 4 }).run(),
      isActive: editor.isActive('heading', { level: 4 }),
      tooltip: 'Heading 4',
      fontStyle: 'mono',
    },
    {
      id: 'task-list',
      label: 'Task list',
      icon: 'TL',
      action: () => editor.chain().focus().toggleTaskList().run(),
      isActive: editor.isActive('taskList'),
      tooltip: 'Task list',
      fontStyle: 'mono',
    },
    {
      id: 'subscript',
      label: 'Subscript',
      icon: 'x2',
      action: () => editor.chain().focus().toggleSubscript().run(),
      isActive: editor.isActive('subscript'),
      tooltip: 'Subscript',
      fontStyle: 'mono',
    },
    {
      id: 'superscript',
      label: 'Superscript',
      icon: 'x^',
      action: () => editor.chain().focus().toggleSuperscript().run(),
      isActive: editor.isActive('superscript'),
      tooltip: 'Superscript',
      fontStyle: 'mono',
    },
  ];

  const renderTool = (
    item: ToolbarItem,
    options?: {
      showLabel?: boolean;
      closeMoreOnClick?: boolean;
      menuRef?: { current: HTMLButtonElement | null };
    },
  ) => {
    const isToggleControl = !['horizontal-rule', 'image', 'table'].includes(
      item.id,
    );
    const className = [
      'studio-tool',
      item.isActive ? 'studio-tool--active' : '',
      options?.showLabel ? 'studio-tool--ghost' : '',
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <button
        ref={options?.menuRef}
        key={item.id}
        type="button"
        className={className}
        onClick={() => {
          item.action();
          if (options?.closeMoreOnClick) {
            setIsMoreOpen(false);
          }
        }}
        aria-label={item.label}
        aria-pressed={isToggleControl ? item.isActive : undefined}
        title={item.tooltip}
        role={options?.showLabel ? 'menuitem' : undefined}
        data-tool-id={item.id}
        style={{
          fontFamily: fontFamilyForStyle(item.fontStyle),
        }}
      >
        <span>{item.icon}</span>
        {options?.showLabel && (
          <span className="studio-toolbar-menu-label">{item.label}</span>
        )}
      </button>
    );
  };

  return (
    <div className="studio-toolbar">
      <div
        className="studio-toolbar-inner"
        role="toolbar"
        aria-label="Editor formatting tools"
      >
        <div className="studio-toolbar-group" aria-label="Format tools">
          {formatItems.map((item) => renderTool(item))}
        </div>

        <div className="studio-tool-divider" aria-hidden="true" />

        <div className="studio-toolbar-group" aria-label="Structure tools">
          {structureItems.map((item) => renderTool(item))}
        </div>

        <div className="studio-tool-divider" aria-hidden="true" />

        <div className="studio-toolbar-group" aria-label="Insert tools">
          {insertItems.map((item) => renderTool(item))}
        </div>

        <div
          className="studio-toolbar-more"
          ref={moreMenuRef}
        >
          <button
            type="button"
            className="studio-tool studio-tool--ghost"
            onClick={() => setIsMoreOpen((open) => !open)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown' && !isMoreOpen) {
                event.preventDefault();
                setIsMoreOpen(true);
              }
            }}
            aria-haspopup="menu"
            aria-expanded={isMoreOpen}
            aria-controls="studio-toolbar-more-menu"
            title="More tools"
            aria-label="More tools"
          >
            More
          </button>

          {isMoreOpen && (
            <div
              id="studio-toolbar-more-menu"
              className="studio-toolbar-menu"
              role="menu"
              aria-label="More editor tools"
            >
              {overflowItems.map((item, index) =>
                renderTool(item, {
                  showLabel: true,
                  closeMoreOnClick: true,
                  menuRef: index === 0 ? firstMenuItemRef : undefined,
                }),
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
