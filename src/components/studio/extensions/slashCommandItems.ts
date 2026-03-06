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
    title: 'Wiki Link',
    description: 'Link to Commonplace entry',
    icon: '[[',
    keywords: ['link', 'wiki', 'commonplace', 'reference'],
    section: 'Embeds',
    command: ({ editor, range }: CommandArgs) => {
      editor.chain().focus().deleteRange(range).insertContent('[[').run();
    },
  },
  {
    title: 'D3 Chart',
    description: 'Insert a self-hosted D3 visualization',
    icon: '\u2632',
    keywords: ['chart', 'd3', 'graph', 'visualization', 'bubble', 'scatter'],
    section: 'Embeds',
    command: ({ editor, range }: CommandArgs) => {
      const charts = [
        { name: 'Wealth & Health of Nations', url: '/embed/wealth-health/' },
      ];

      if (charts.length === 1) {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .setIframe({ src: charts[0].url, height: 580 })
          .run();
        return;
      }

      /* Future: show a proper picker popup with all available chart routes */
      const url = window.prompt(
        'Chart embed URL:\n\nAvailable:\n' +
          charts.map((c) => `  ${c.name}: ${c.url}`).join('\n'),
        charts[0].url,
      );
      if (!url) {
        editor.chain().focus().deleteRange(range).run();
        return;
      }
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .setIframe({ src: url, height: 580 })
        .run();
    },
  },
  {
    title: 'Embed',
    description: 'Embed a URL (Observable, custom page)',
    icon: '\u25A3',
    keywords: ['embed', 'iframe', 'observable'],
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

  // ── AI ──────────────────────────────────────────
  {
    title: 'AI: Expand',
    description: 'Expand the current paragraph',
    icon: 'AI',
    keywords: ['ai', 'expand', 'longer', 'elaborate'],
    section: 'AI',
    command: ({ editor, range }: CommandArgs) => {
      editor.chain().focus().deleteRange(range).run();
      window.alert('AI commands are coming soon.');
    },
  },
  {
    title: 'AI: Simplify',
    description: 'Simplify selected text',
    icon: 'AI',
    keywords: ['ai', 'simplify', 'simpler', 'clarify'],
    section: 'AI',
    command: ({ editor, range }: CommandArgs) => {
      editor.chain().focus().deleteRange(range).run();
      window.alert('AI commands are coming soon.');
    },
  },
  {
    title: 'AI: Summarize',
    description: 'Summarize selected text',
    icon: 'AI',
    keywords: ['ai', 'summarize', 'summary', 'tldr'],
    section: 'AI',
    command: ({ editor, range }: CommandArgs) => {
      editor.chain().focus().deleteRange(range).run();
      window.alert('AI commands are coming soon.');
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
