/**
 * Command registry for the Studio command palette (Cmd+K).
 *
 * Commands are simple action descriptors. The palette handles
 * fuzzy matching and keyboard navigation; the layout provides
 * action callbacks via context.
 */

export interface StudioCommand {
  id: string;
  label: string;
  /** Short description shown below the label */
  description?: string;
  /** Keyboard shortcut hint (display only) */
  shortcut?: string;
  /** Category for grouping */
  category: 'editor' | 'view' | 'navigate' | 'content';
  /** If true, only show when an editor is active */
  editorOnly?: boolean;
}

export const STUDIO_COMMANDS: StudioCommand[] = [
  /* Editor actions */
  {
    id: 'save',
    label: 'Save',
    description: 'Save current content',
    shortcut: 'Cmd+S',
    category: 'editor',
    editorOnly: true,
  },
  {
    id: 'zen-mode',
    label: 'Zen Mode',
    description: 'Toggle distraction-free writing',
    shortcut: 'Cmd+Shift+Z',
    category: 'view',
  },
  {
    id: 'typewriter-mode',
    label: 'Typewriter Mode',
    description: 'Keep cursor centered while typing',
    category: 'editor',
    editorOnly: true,
  },
  {
    id: 'markdown-view',
    label: 'Markdown View',
    description: 'Toggle raw markdown display',
    category: 'editor',
    editorOnly: true,
  },
  {
    id: 'reading-panel',
    label: 'Reading Settings',
    description: 'Open reading appearance panel',
    category: 'editor',
    editorOnly: true,
  },

  /* View actions */
  {
    id: 'toggle-theme',
    label: 'Toggle Theme',
    description: 'Switch between dark and light mode',
    shortcut: 'Cmd+Shift+T',
    category: 'view',
  },
  {
    id: 'toggle-workbench',
    label: 'Toggle Workbench',
    description: 'Show or hide the right panel',
    shortcut: 'Cmd+.',
    category: 'view',
  },

  /* Navigation */
  {
    id: 'nav-dashboard',
    label: 'Go to Dashboard',
    description: 'Studio home',
    category: 'navigate',
  },
  {
    id: 'nav-essays',
    label: 'Go to Essays',
    category: 'navigate',
  },
  {
    id: 'nav-field-notes',
    label: 'Go to Field Notes',
    category: 'navigate',
  },
  {
    id: 'nav-shelf',
    label: 'Go to Shelf',
    category: 'navigate',
  },
  {
    id: 'nav-projects',
    label: 'Go to Projects',
    category: 'navigate',
  },
  {
    id: 'nav-toolkit',
    label: 'Go to Toolkit',
    category: 'navigate',
  },
  {
    id: 'nav-video',
    label: 'Go to Video',
    category: 'navigate',
  },

  /* Content */
  {
    id: 'new-content',
    label: 'New Content',
    description: 'Create a new piece of content',
    category: 'content',
  },
];

/**
 * Simple fuzzy match: checks if all characters of the query
 * appear in order within the target string.
 */
export function fuzzyMatch(query: string, target: string): boolean {
  const q = query.toLowerCase();
  const t = target.toLowerCase();
  let qi = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) qi++;
  }
  return qi === q.length;
}

/**
 * Score a fuzzy match (higher is better).
 * Prefers prefix matches and consecutive character runs.
 */
export function fuzzyScore(query: string, target: string): number {
  const q = query.toLowerCase();
  const t = target.toLowerCase();

  /* Prefix match bonus */
  if (t.startsWith(q)) return 100;

  /* Word-start match bonus */
  const words = t.split(/\s+/);
  for (const w of words) {
    if (w.startsWith(q)) return 80;
  }

  /* Count consecutive matches */
  let score = 0;
  let qi = 0;
  let consecutive = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      qi++;
      consecutive++;
      score += consecutive;
    } else {
      consecutive = 0;
    }
  }

  return qi === q.length ? score : -1;
}

export function filterCommands(
  query: string,
  commands: StudioCommand[],
  isEditorActive: boolean,
): StudioCommand[] {
  const available = isEditorActive
    ? commands
    : commands.filter((c) => !c.editorOnly);

  if (!query.trim()) return available;

  return available
    .map((cmd) => ({
      cmd,
      score: Math.max(
        fuzzyScore(query, cmd.label),
        fuzzyScore(query, cmd.description ?? ''),
      ),
    }))
    .filter((item) => item.score >= 0)
    .sort((a, b) => b.score - a.score)
    .map((item) => item.cmd);
}
