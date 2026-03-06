import type { SlashCommandItem } from './SlashCommand';
import type { Editor } from '@tiptap/core';
import type { Range } from '@tiptap/core';

type CommandArgs = { editor: Editor; range: Range };

export const SLASH_COMMAND_ITEMS: SlashCommandItem[] = [
  // ── Text ───────────────────────────────────────
  {
    title: 'Text',
    description: 'Plain paragraph text',
    icon: 'T',
    keywords: ['paragraph', 'text', 'plain'],
    section: 'Basic',
    command: ({ editor, range }: CommandArgs) => {
      editor.chain().focus().deleteRange(range).setParagraph().run();
    },
  },
  {
    title: 'Heading 1',
    description: 'Large section heading',
    icon: 'H1',
    keywords: ['heading', 'title', 'h1', 'large'],
    section: 'Basic',
    command: ({ editor, range }: CommandArgs) => {
      editor.chain().focus().deleteRange(range).setHeading({ level: 1 }).run();
    },
  },
  {
    title: 'Heading 2',
    description: 'Medium section heading',
    icon: 'H2',
    keywords: ['heading', 'subtitle', 'h2', 'medium'],
    section: 'Basic',
    command: ({ editor, range }: CommandArgs) => {
      editor.chain().focus().deleteRange(range).setHeading({ level: 2 }).run();
    },
  },
  {
    title: 'Heading 3',
    description: 'Small section heading',
    icon: 'H3',
    keywords: ['heading', 'h3', 'small'],
    section: 'Basic',
    command: ({ editor, range }: CommandArgs) => {
      editor.chain().focus().deleteRange(range).setHeading({ level: 3 }).run();
    },
  },

  // ── Lists ──────────────────────────────────────
  {
    title: 'Bullet List',
    description: 'Unordered list',
    icon: '\u2022',
    keywords: ['bullet', 'list', 'unordered', 'ul'],
    section: 'Lists',
    command: ({ editor, range }: CommandArgs) => {
      editor.chain().focus().deleteRange(range).toggleBulletList().run();
    },
  },
  {
    title: 'Numbered List',
    description: 'Ordered list',
    icon: '1.',
    keywords: ['number', 'list', 'ordered', 'ol'],
    section: 'Lists',
    command: ({ editor, range }: CommandArgs) => {
      editor.chain().focus().deleteRange(range).toggleOrderedList().run();
    },
  },
  {
    title: 'Task List',
    description: 'Checklist with checkboxes',
    icon: 'TL',
    keywords: ['task', 'todo', 'check', 'checklist'],
    section: 'Lists',
    command: ({ editor, range }: CommandArgs) => {
      editor.chain().focus().deleteRange(range).toggleTaskList().run();
    },
  },

  // ── Blocks ─────────────────────────────────────
  {
    title: 'Blockquote',
    description: 'Quote or callout',
    icon: 'Bq',
    keywords: ['quote', 'blockquote', 'callout'],
    section: 'Blocks',
    command: ({ editor, range }: CommandArgs) => {
      editor.chain().focus().deleteRange(range).setBlockquote().run();
    },
  },
  {
    title: 'Code Block',
    description: 'Syntax-highlighted code',
    icon: '<>',
    keywords: ['code', 'codeblock', 'syntax', 'pre'],
    section: 'Blocks',
    command: ({ editor, range }: CommandArgs) => {
      editor.chain().focus().deleteRange(range).setCodeBlock().run();
    },
  },
  {
    title: 'Divider',
    description: 'Horizontal rule',
    icon: 'HR',
    keywords: ['divider', 'hr', 'rule', 'separator', 'line'],
    section: 'Blocks',
    command: ({ editor, range }: CommandArgs) => {
      editor.chain().focus().deleteRange(range).setHorizontalRule().run();
    },
  },
  {
    title: 'Table',
    description: '3x3 table',
    icon: 'Tb',
    keywords: ['table', 'grid', 'data'],
    section: 'Blocks',
    command: ({ editor, range }: CommandArgs) => {
      editor.chain().focus().deleteRange(range).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
    },
  },

  // ── Contain ────────────────────────────────────
  {
    title: 'Observation',
    description: 'Contain as observation',
    icon: '\u25CB',
    keywords: ['observation', 'contain', 'teal'],
    section: 'Contain',
    command: ({ editor, range }: CommandArgs) => {
      editor.chain().focus().deleteRange(range).setContainBlock({ containType: 'observation' }).run();
    },
  },
  {
    title: 'Argument',
    description: 'Contain as argument',
    icon: '\u25CB',
    keywords: ['argument', 'contain', 'terracotta'],
    section: 'Contain',
    command: ({ editor, range }: CommandArgs) => {
      editor.chain().focus().deleteRange(range).setContainBlock({ containType: 'argument' }).run();
    },
  },
  {
    title: 'Evidence',
    description: 'Contain as evidence',
    icon: '\u25CB',
    keywords: ['evidence', 'contain', 'gold'],
    section: 'Contain',
    command: ({ editor, range }: CommandArgs) => {
      editor.chain().focus().deleteRange(range).setContainBlock({ containType: 'evidence' }).run();
    },
  },
  {
    title: 'Question',
    description: 'Contain as question',
    icon: '?',
    keywords: ['question', 'contain', 'purple'],
    section: 'Contain',
    command: ({ editor, range }: CommandArgs) => {
      editor.chain().focus().deleteRange(range).setContainBlock({ containType: 'question' }).run();
    },
  },

  // ── Embeds ─────────────────────────────────────
  {
    title: 'Embed',
    description: 'Embed a URL (D3, Observable, etc.)',
    icon: '\u25A3',
    keywords: ['embed', 'iframe', 'd3', 'observable', 'chart', 'graph', 'visualization'],
    section: 'Embeds',
    command: ({ editor, range }: CommandArgs) => {
      const url = window.prompt('Embed URL (Observable, D3 chart, or any page)');
      if (!url) {
        editor.chain().focus().deleteRange(range).run();
        return;
      }
      editor.chain().focus().deleteRange(range).setIframe({ src: url }).run();
    },
  },
  {
    title: 'Image',
    description: 'Insert an image by URL',
    icon: 'Im',
    keywords: ['image', 'picture', 'photo', 'img'],
    section: 'Embeds',
    command: ({ editor, range }: CommandArgs) => {
      const url = window.prompt('Image URL');
      if (!url) {
        editor.chain().focus().deleteRange(range).run();
        return;
      }
      editor.chain().focus().deleteRange(range).setImage({ src: url }).run();
    },
  },
];

export function filterSlashCommands(query: string): SlashCommandItem[] {
  if (!query) return SLASH_COMMAND_ITEMS;
  const q = query.toLowerCase();
  return SLASH_COMMAND_ITEMS.filter(
    (item) =>
      item.title.toLowerCase().includes(q) ||
      item.keywords.some((kw) => kw.includes(q)),
  );
}
