import type { SlashCommandItem } from '@/components/studio/extensions/SlashCommand';
import type { Editor } from '@tiptap/core';
import type { Range } from '@tiptap/core';
import { CHART_REGISTRY } from '@/lib/studio-charts';
import { askTheseusAsyncStream } from '@/lib/theseus-api';

type CommandArgs = { editor: Editor; range: Range };

async function executeAiCommand(
  editor: Editor,
  range: Range,
  mode: 'expand' | 'simplify' | 'summarize',
) {
  const { from, to } = editor.state.selection;
  let text: string;

  if (from !== to) {
    text = editor.state.doc.textBetween(from, to, '\n');
  } else {
    const $from = editor.state.selection.$from;
    const paragraph = $from.parent;
    text = paragraph.textContent;
  }

  if (!text.trim()) {
    editor.chain().focus().deleteRange(range).run();
    return;
  }

  editor.chain().focus().deleteRange(range).run();

  const loadingText = `[AI ${mode}ing...]`;
  editor.chain().focus().insertContent(loadingText).run();

  try {
    const res = await fetch('/api/ai/transform', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode, text }),
    });

    if (!res.ok) throw new Error('AI request failed');
    const data = await res.json();

    const { state } = editor;
    let loadingPos: number | null = null;
    state.doc.descendants((node, pos) => {
      if (node.isText && node.text?.includes(loadingText)) {
        loadingPos = pos;
        return false;
      }
      return true;
    });

    if (loadingPos !== null) {
      editor
        .chain()
        .focus()
        .deleteRange({
          from: loadingPos,
          to: loadingPos + loadingText.length,
        })
        .insertContentAt(loadingPos, data.result)
        .run();
    }
  } catch {
    // Remove loading placeholder on error
    const { state } = editor;
    let loadingPos: number | null = null;
    state.doc.descendants((node, pos) => {
      if (node.isText && node.text?.includes(loadingText)) {
        loadingPos = pos;
        return false;
      }
      return true;
    });
    if (loadingPos !== null) {
      editor
        .chain()
        .focus()
        .deleteRange({
          from: loadingPos,
          to: loadingPos + loadingText.length,
        })
        .run();
    }
  }
}

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
      if (CHART_REGISTRY.length === 1) {
        const chart = CHART_REGISTRY[0];
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .setIframe({ src: chart.url, height: chart.defaultHeight })
          .run();
        return;
      }

      // Multiple charts: dispatch a custom event to open the picker popup
      editor.chain().focus().deleteRange(range).run();
      window.dispatchEvent(new CustomEvent('studio:open-chart-picker'));
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

  // ── Video ────────────────────────────────────────
  {
    title: 'Scene',
    description: 'Insert a scene container',
    icon: '\uD83C\uDFA5',
    keywords: ['scene', 'section', 'act', 'video'],
    section: 'Video',
    command: ({ editor, range }: CommandArgs) => {
      editor.chain().focus().deleteRange(range).setContainBlock({ containType: 'scene' }).run();
    },
  },
  {
    title: 'Visual Direction',
    description: 'Insert a {VISUAL: ...} direction',
    icon: '\uD83D\uDCF7',
    keywords: ['visual', 'direction', 'graphic', 'broll', 'shot'],
    section: 'Video',
    command: ({ editor, range }: CommandArgs) => {
      editor.chain().focus().deleteRange(range).insertContent('{VISUAL: }').run();
    },
  },
  {
    title: 'Needs Source',
    description: 'Flag as needing a source',
    icon: '?',
    keywords: ['source', 'needs', 'citation', 'verify'],
    section: 'Video',
    command: ({ editor, range }: CommandArgs) => {
      editor.chain().focus().deleteRange(range).insertContent('[NEEDS SOURCE]').run();
    },
  },

  // ── AI ──────────────────────────────────────────
  {
    title: 'AI: Expand',
    description: 'Add depth and reasoning',
    icon: 'AI',
    keywords: ['ai', 'expand', 'longer', 'elaborate'],
    section: 'AI',
    command: ({ editor, range }: CommandArgs) => {
      executeAiCommand(editor, range, 'expand');
    },
  },
  {
    title: 'AI: Simplify',
    description: 'Shorter sentences, less hedging',
    icon: 'AI',
    keywords: ['ai', 'simplify', 'simpler', 'clarify'],
    section: 'AI',
    command: ({ editor, range }: CommandArgs) => {
      executeAiCommand(editor, range, 'simplify');
    },
  },
  {
    title: 'AI: Summarize',
    description: '1 to 3 sentence summary',
    icon: 'AI',
    keywords: ['ai', 'summarize', 'summary', 'tldr'],
    section: 'AI',
    command: ({ editor, range }: CommandArgs) => {
      executeAiCommand(editor, range, 'summarize');
    },
  },

  // ── Theseus Epistemic ─────────────────────────
  {
    title: 'Claim',
    description: 'Mark as a claim and send to Theseus',
    icon: 'C',
    keywords: ['claim', 'assert', 'thesis', 'theseus'],
    section: 'Theseus',
    command: ({ editor, range }: CommandArgs) => {
      // Uses 'argument' contain type; claim semantics added via scheduleClaimExtraction
      editor.chain().focus().deleteRange(range)
        .setContainBlock({ containType: 'argument' }).run();
      scheduleClaimExtraction(editor);
    },
  },
  {
    title: 'Tension',
    description: 'Mark as being in tension with existing knowledge',
    icon: '\u26A0',
    keywords: ['tension', 'conflict', 'contradiction', 'theseus'],
    section: 'Theseus',
    command: ({ editor, range }: CommandArgs) => {
      // Uses 'question' contain type; tension semantics added via workbench tab
      editor.chain().focus().deleteRange(range)
        .setContainBlock({ containType: 'question' }).run();
    },
  },
  {
    title: 'Ask Theseus',
    description: 'Query Theseus inline, insert response below',
    icon: '?',
    keywords: ['ask', 'query', 'theseus', 'search'],
    section: 'Theseus',
    command: ({ editor, range }: CommandArgs) => {
      executeInlineAsk(editor, range);
    },
  },
  {
    title: 'Capture',
    description: 'Save this note to your Theseus graph now',
    icon: '\u2191',
    keywords: ['capture', 'save', 'graph', 'theseus'],
    section: 'Theseus',
    command: ({ editor, range }: CommandArgs) => {
      editor.chain().focus().deleteRange(range).run();
      captureToGraph(editor);
    },
  },
  {
    title: 'Connect',
    description: 'Find and link related objects in the graph',
    icon: '\u2194',
    keywords: ['connect', 'link', 'relate', 'theseus'],
    section: 'Theseus',
    command: ({ editor, range }: CommandArgs) => {
      editor.chain().focus().deleteRange(range).run();
      window.dispatchEvent(
        new CustomEvent('notebook:open-connection-search', {
          detail: { text: editor.state.doc.textContent },
        }),
      );
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

// ── Theseus epistemic command helpers ──────────

/** Extract text from the current contain block and send to Theseus as a claim. */
function scheduleClaimExtraction(editor: Editor) {
  setTimeout(() => {
    const text = editor.state.selection.$from.parent.textContent;
    if (!text.trim()) return;
    fetch('/api/v1/notebook/quick_capture/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: text.trim(), object_type: 'claim' }),
    }).catch(() => {});
  }, 100);
}

/** Query Theseus inline and insert the response below the cursor. */
function executeInlineAsk(editor: Editor, range: Range) {
  const { from, to } = editor.state.selection;
  let queryText: string;

  if (from !== to) {
    queryText = editor.state.doc.textBetween(from, to, '\n');
  } else {
    queryText = editor.state.selection.$from.parent.textContent;
  }

  if (!queryText.trim()) {
    editor.chain().focus().deleteRange(range).run();
    return;
  }

  editor.chain().focus().deleteRange(range).run();

  const loadingText = '[Asking Theseus...]';
  editor.chain().focus().insertContent(loadingText).run();

  let answer = '';
  askTheseusAsyncStream(
    queryText,
    {},
    {
      onStage: () => {},
      onToken: (token: string) => { answer += token; },
      onComplete: () => {
        replaceLoadingText(editor, loadingText, answer || 'No answer found.');
      },
      onError: () => {
        replaceLoadingText(editor, loadingText, '[Theseus: query failed]');
      },
    },
  ).catch(() => {
    replaceLoadingText(editor, loadingText, '[Theseus: query failed]');
  });
}

function replaceLoadingText(editor: Editor, loadingText: string, replacement: string) {
  const { state } = editor;
  let loadingPos: number | null = null;
  state.doc.descendants((node, pos) => {
    if (node.isText && node.text?.includes(loadingText)) {
      loadingPos = pos;
      return false;
    }
    return true;
  });
  if (loadingPos !== null) {
    editor
      .chain()
      .focus()
      .deleteRange({ from: loadingPos, to: loadingPos + loadingText.length })
      .insertContentAt(loadingPos, replacement)
      .run();
  }
}

/** Capture the entire note content to the Theseus graph. */
function captureToGraph(editor: Editor) {
  const text = editor.state.doc.textContent;
  if (!text.trim()) return;
  fetch('/api/v1/notebook/quick_capture/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: text.trim(), object_type: 'note' }),
  }).catch(() => {});
}
