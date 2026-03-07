# Six Features Implementation Plan

> **For Claude:** REQUIRED: Use /execute-plan to implement this plan task-by-task.

**Goal:** Add six new features to travisgilbert.me: Terminal Search, Public Changelog, Graph Navigation, Writing Analytics, Webmention Wiring, and Connected Reading Sidebar.

**Architecture:** Features build on existing infrastructure (connectionEngine, research API, content collections). Terminal Search and Changelog are independent foundations. Graph Navigation and Analytics run in parallel. Webmention wiring activates existing backend. Connected Reading Sidebar caps the sequence, depending on Feature 2.

**Tech Stack:** Next.js 16, React 19, Tailwind v4, D3 v7, rough.js, Pagefind (new), Zod, Django REST Framework

---

## Feature 1: Terminal Search

> Site-wide Cmd+K search using Pagefind with a terminal aesthetic and command registry.

### Task 1.1: Pagefind Build Integration

**Files:**
- Create: `pagefind.yml`
- Modify: `package.json:6-10` (scripts)
- Modify: `.gitignore` (add pagefind output)

**Step 1: Create Pagefind config**

Create `pagefind.yml` at the project root:

```yaml
site: .next
glob: "**/*.html"
```

**Step 2: Add postbuild script to package.json**

In `package.json`, add to `"scripts"`:

```json
"postbuild": "npx pagefind"
```

**Step 3: Add pagefind output to .gitignore**

Append to `.gitignore`:

```
# Pagefind search index (generated at build time)
public/pagefind/
```

**Step 4: Verify Pagefind runs**

Run: `npm run build`
Expected: Pagefind creates `public/pagefind/` directory with index files after Next.js build completes.

**Step 5: Commit**

```bash
git add pagefind.yml package.json .gitignore
git commit -m "feat(search): add Pagefind build integration"
```

---

### Task 1.2: Content Type Tagging for Pagefind

**Files:**
- Modify: `src/app/(main)/essays/[slug]/page.tsx:362` (article tag)
- Modify: `src/app/(main)/field-notes/[slug]/page.tsx` (article tag)
- Modify: `src/app/(main)/shelf/page.tsx` (listing, add pagefind-ignore)
- Modify: `src/app/(main)/projects/page.tsx` (listing, add pagefind-ignore)
- Modify: `src/app/(main)/toolkit/page.tsx` (listing, add pagefind-ignore)

**Step 1: Add data attributes to essay detail article tag**

In `src/app/(main)/essays/[slug]/page.tsx`, find the `<article>` opening tag and add:

```tsx
<article data-pagefind-body data-pagefind-filter="type:essay">
```

**Step 2: Add data attributes to field-note detail article tag**

Same pattern for `src/app/(main)/field-notes/[slug]/page.tsx`:

```tsx
<article data-pagefind-body data-pagefind-filter="type:field-note">
```

**Step 3: Add pagefind-ignore to listing pages**

On each listing page's main wrapper, add `data-pagefind-ignore` so only detail pages are indexed (not the list views).

**Step 4: Build and verify index**

Run: `npm run build`
Expected: Pagefind reports indexing essay and field-note detail pages. Listing pages excluded.

**Step 5: Commit**

```bash
git add src/app/
git commit -m "feat(search): tag content types for Pagefind indexing"
```

---

### Task 1.3: Pagefind Search Wrapper

**Files:**
- Create: `src/components/terminal/pagefindSearch.ts`

**Step 1: Create the Pagefind wrapper**

```ts
// src/components/terminal/pagefindSearch.ts
'use client';

/**
 * Thin wrapper around Pagefind's client-side API.
 * Loads the index on first search, caches the instance.
 */

interface PagefindResult {
  id: string;
  url: string;
  excerpt: string;         // Plain text excerpt (HTML tags stripped)
  meta: {
    title?: string;
    image?: string;
  };
  filters: {
    type?: string[];
  };
  sub_results?: PagefindSubResult[];
}

interface PagefindSubResult {
  title: string;
  url: string;
  excerpt: string;
}

interface PagefindResponse {
  results: { id: string; data: () => Promise<PagefindResult> }[];
  totalFilters: Record<string, Record<string, number>>;
}

let pagefindInstance: {
  search: (query: string, options?: Record<string, unknown>) => Promise<PagefindResponse>;
} | null = null;

async function loadPagefind() {
  if (pagefindInstance) return pagefindInstance;
  // Pagefind injects itself at /pagefind/pagefind.js during build
  // @ts-expect-error dynamic import of build-time generated module
  const pf = await import(/* webpackIgnore: true */ '/pagefind/pagefind.js');
  await pf.options({ excerptLength: 120 });
  pagefindInstance = pf;
  return pf;
}

export interface SearchResult {
  id: string;
  url: string;
  title: string;
  excerpt: string;        // Plain text, safe to render directly
  contentType: string;    // 'essay' | 'field-note' | 'project' | etc.
}

export async function search(query: string, maxResults = 10): Promise<SearchResult[]> {
  const pf = await loadPagefind();
  const response = await pf.search(query);

  const results: SearchResult[] = [];
  const limit = Math.min(response.results.length, maxResults);

  for (let i = 0; i < limit; i++) {
    const data = await response.results[i].data();
    // Strip any HTML tags from excerpt for safe text rendering
    const plainExcerpt = data.excerpt.replace(/<[^>]*>/g, '');
    results.push({
      id: data.id,
      url: data.url,
      title: data.meta.title ?? 'Untitled',
      excerpt: plainExcerpt,
      contentType: data.filters.type?.[0] ?? 'page',
    });
  }

  return results;
}
```

**Step 2: Commit**

```bash
git add src/components/terminal/pagefindSearch.ts
git commit -m "feat(search): create Pagefind search wrapper with type filtering"
```

---

### Task 1.4: Terminal UI Components

**Files:**
- Create: `src/components/terminal/TerminalInput.tsx`
- Create: `src/components/terminal/TerminalOutput.tsx`
- Create: `src/components/terminal/TerminalResultCard.tsx`

**Step 1: Create TerminalInput**

```tsx
// src/components/terminal/TerminalInput.tsx
'use client';

import { useRef, useEffect } from 'react';

interface TerminalInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onArrowUp: () => void;
  onArrowDown: () => void;
  onEscape: () => void;
}

export default function TerminalInput({
  value,
  onChange,
  onSubmit,
  onArrowUp,
  onArrowDown,
  onEscape,
}: TerminalInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className="flex items-center gap-2 font-mono text-sm">
      <span style={{ color: '#B45A2D' }}>$</span>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSubmit();
          else if (e.key === 'ArrowUp') { e.preventDefault(); onArrowUp(); }
          else if (e.key === 'ArrowDown') { e.preventDefault(); onArrowDown(); }
          else if (e.key === 'Escape') onEscape();
        }}
        className="flex-1 bg-transparent border-none outline-none caret-[#B45A2D]"
        style={{ color: '#D4CCC4', fontFamily: 'var(--font-metadata)', fontSize: 14 }}
        autoComplete="off"
        spellCheck={false}
        aria-label="Search or enter command"
      />
    </div>
  );
}
```

**Step 2: Create TerminalResultCard**

```tsx
// src/components/terminal/TerminalResultCard.tsx
'use client';

import type { SearchResult } from './pagefindSearch';

const TYPE_COLORS: Record<string, string> = {
  essay: '#B45A2D',
  'field-note': '#2D5F6B',
  shelf: '#C49A4A',
  project: '#C49A4A',
  toolkit: '#5A7A4A',
  page: '#6A5E52',
};

interface TerminalResultCardProps {
  result: SearchResult;
  isActive: boolean;
  onClick: () => void;
}

export default function TerminalResultCard({ result, isActive, onClick }: TerminalResultCardProps) {
  const color = TYPE_COLORS[result.contentType] ?? '#6A5E52';
  const typeLabel = result.contentType.replace('-', ' ').toUpperCase();

  return (
    <button
      onClick={onClick}
      className="w-full text-left px-3 py-2 border-l-[3px] transition-colors cursor-pointer bg-transparent border-none"
      style={{
        borderLeftColor: color,
        backgroundColor: isActive ? 'rgba(255,255,255,0.03)' : 'transparent',
      }}
      aria-current={isActive ? 'true' : undefined}
    >
      <div className="flex items-baseline gap-3 font-mono text-xs">
        {isActive && <span style={{ color }} aria-hidden="true">&gt;</span>}
        <span style={{ color, fontFamily: 'var(--font-metadata)', fontSize: 10 }}>
          [{typeLabel}]
        </span>
        <span
          className="font-semibold truncate"
          style={{ color: isActive ? '#B45A2D' : '#D4CCC4' }}
        >
          {result.title}
        </span>
      </div>
      <p
        className="mt-0.5 ml-6 text-xs truncate"
        style={{ color: '#6A5E52', fontFamily: 'var(--font-metadata)', fontSize: 12 }}
      >
        {result.excerpt}
      </p>
      <p
        className="mt-0.5 ml-6 text-xs"
        style={{ color: '#5A5652', fontFamily: 'var(--font-metadata)', fontSize: 10 }}
      >
        {result.url}
      </p>
    </button>
  );
}
```

Note: Excerpt is rendered as plain text (HTML stripped in `pagefindSearch.ts`), so no raw HTML injection is needed.

**Step 3: Create TerminalOutput**

```tsx
// src/components/terminal/TerminalOutput.tsx
'use client';

import type { SearchResult } from './pagefindSearch';
import TerminalResultCard from './TerminalResultCard';

interface TerminalOutputProps {
  results: SearchResult[];
  activeIndex: number;
  onSelect: (result: SearchResult) => void;
  helpVisible: boolean;
  commandOutput: string | null;
}

export default function TerminalOutput({
  results,
  activeIndex,
  onSelect,
  helpVisible,
  commandOutput,
}: TerminalOutputProps) {
  if (commandOutput) {
    return (
      <pre
        className="whitespace-pre-wrap text-xs mt-4"
        style={{ color: '#D4CCC4', fontFamily: 'var(--font-metadata)' }}
      >
        {commandOutput}
      </pre>
    );
  }

  if (results.length === 0) return null;

  return (
    <div className="mt-4 flex flex-col gap-1">
      {results.map((r, i) => (
        <TerminalResultCard
          key={r.id}
          result={r}
          isActive={i === activeIndex}
          onClick={() => onSelect(r)}
        />
      ))}
    </div>
  );
}
```

**Step 4: Commit**

```bash
git add src/components/terminal/
git commit -m "feat(search): build Terminal UI components (input, output, result card)"
```

---

### Task 1.5: Command Registry and useTerminal Hook

**Files:**
- Create: `src/components/terminal/commands.ts`
- Create: `src/components/terminal/useTerminal.ts`

**Step 1: Create command registry**

```ts
// src/components/terminal/commands.ts

export interface CommandOutput {
  type: 'text' | 'redirect';
  content: string;
}

export interface Command {
  name: string;
  aliases: string[];
  description: string;
  handler: (args: string[]) => CommandOutput | Promise<CommandOutput>;
}

export const COMMANDS: Command[] = [
  {
    name: 'help',
    aliases: ['?', 'commands'],
    description: 'List available commands',
    handler: () => ({
      type: 'text' as const,
      content: COMMANDS.map(
        (c) => `  ${c.name.padEnd(14)} ${c.description}`
      ).join('\n'),
    }),
  },
  {
    name: 'now',
    aliases: ['current', 'status'],
    description: 'What Travis is working on',
    handler: () => ({ type: 'redirect' as const, content: '/now' }),
  },
  {
    name: 'random',
    aliases: ['surprise', 'lucky'],
    description: 'Navigate to a random essay',
    handler: () => ({ type: 'redirect' as const, content: '/essays' }),
    // Implementation note: actual random selection happens in useTerminal
    // by reading from a pre-built essay slug list
  },
  {
    name: 'colophon',
    aliases: ['stack', 'built'],
    description: 'How this site was built',
    handler: () => ({ type: 'redirect' as const, content: '/colophon' }),
  },
  {
    name: 'changelog',
    aliases: ['changes', 'log'],
    description: 'Recent site changes',
    handler: () => ({ type: 'redirect' as const, content: '/changelog' }),
  },
  {
    name: 'stats',
    aliases: ['info', 'about'],
    description: 'Writing and research analytics',
    handler: () => ({ type: 'redirect' as const, content: '/stats' }),
  },
  {
    name: 'connections',
    aliases: ['graph', 'related'],
    description: 'View the content connection map',
    handler: () => ({ type: 'redirect' as const, content: '/connections' }),
  },
];

export function matchCommand(input: string): { command: Command; args: string[] } | null {
  const parts = input.trim().split(/\s+/);
  const first = parts[0]?.toLowerCase();
  if (!first) return null;

  const cmd = COMMANDS.find(
    (c) => c.name === first || c.aliases.includes(first)
  );
  if (!cmd) return null;

  return { command: cmd, args: parts.slice(1) };
}
```

**Step 2: Create useTerminal hook**

```ts
// src/components/terminal/useTerminal.ts
'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { search } from './pagefindSearch';
import { matchCommand } from './commands';
import type { SearchResult } from './pagefindSearch';

interface UseTerminalReturn {
  input: string;
  setInput: (value: string) => void;
  results: SearchResult[];
  activeIndex: number;
  commandOutput: string | null;
  handleSubmit: () => void;
  handleArrowUp: () => void;
  handleArrowDown: () => void;
  selectResult: (result: SearchResult) => void;
}

export function useTerminal(onClose: () => void): UseTerminalReturn {
  const router = useRouter();
  const [input, setInput] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [commandOutput, setCommandOutput] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!input.trim()) {
      setResults([]);
      setCommandOutput(null);
      return;
    }

    // Check for command match first
    const match = matchCommand(input);
    if (match) return; // Don't search if it looks like a command

    debounceRef.current = setTimeout(async () => {
      const found = await search(input);
      setResults(found);
      setActiveIndex(0);
      setCommandOutput(null);
    }, 300);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [input]);

  const handleSubmit = useCallback(() => {
    if (!input.trim()) return;

    setHistory((prev) => [...prev, input]);
    setHistoryIndex(-1);

    const match = matchCommand(input);
    if (match) {
      const result = match.command.handler(match.args);
      if (result instanceof Promise) {
        result.then((r) => {
          if (r.type === 'redirect') { onClose(); router.push(r.content); }
          else setCommandOutput(r.content);
        });
      } else {
        if (result.type === 'redirect') { onClose(); router.push(result.content); }
        else setCommandOutput(result.content);
      }
      setInput('');
      return;
    }

    // If results exist and one is active, navigate to it
    if (results.length > 0 && results[activeIndex]) {
      onClose();
      router.push(results[activeIndex].url);
    }
  }, [input, results, activeIndex, onClose, router]);

  const handleArrowUp = useCallback(() => {
    if (results.length > 0) {
      setActiveIndex((i) => Math.max(0, i - 1));
    } else if (history.length > 0) {
      const newIndex = historyIndex === -1 ? history.length - 1 : Math.max(0, historyIndex - 1);
      setHistoryIndex(newIndex);
      setInput(history[newIndex]);
    }
  }, [results.length, history, historyIndex]);

  const handleArrowDown = useCallback(() => {
    if (results.length > 0) {
      setActiveIndex((i) => Math.min(results.length - 1, i + 1));
    }
  }, [results.length]);

  const selectResult = useCallback((result: SearchResult) => {
    onClose();
    router.push(result.url);
  }, [onClose, router]);

  return {
    input, setInput, results, activeIndex, commandOutput,
    handleSubmit, handleArrowUp, handleArrowDown, selectResult,
  };
}
```

**Step 3: Commit**

```bash
git add src/components/terminal/commands.ts src/components/terminal/useTerminal.ts
git commit -m "feat(search): add command registry and useTerminal REPL hook"
```

---

### Task 1.6: Terminal Overlay Component

**Files:**
- Create: `src/components/Terminal.tsx`

**Step 1: Create Terminal overlay**

```tsx
// src/components/Terminal.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import TerminalInput from './terminal/TerminalInput';
import TerminalOutput from './terminal/TerminalOutput';
import { useTerminal } from './terminal/useTerminal';

export default function Terminal() {
  const [open, setOpen] = useState(false);

  const close = useCallback(() => setOpen(false), []);
  const {
    input, setInput, results, activeIndex, commandOutput,
    handleSubmit, handleArrowUp, handleArrowDown, selectResult,
  } = useTerminal(close);

  // Global Cmd+K / Ctrl+K listener
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center"
      style={{ backgroundColor: '#1A1816' }}
      role="dialog"
      aria-modal="true"
      aria-label="Site search terminal"
    >
      {/* Close button */}
      <button
        onClick={close}
        className="absolute top-4 right-4 font-mono text-xs bg-transparent border-none cursor-pointer"
        style={{ color: '#6A5E52' }}
        aria-label="Close search"
      >
        [x]
      </button>

      <div className="w-full max-w-[720px] px-6 pt-12">
        <TerminalInput
          value={input}
          onChange={setInput}
          onSubmit={handleSubmit}
          onArrowUp={handleArrowUp}
          onArrowDown={handleArrowDown}
          onEscape={close}
        />
        <TerminalOutput
          results={results}
          activeIndex={activeIndex}
          onSelect={selectResult}
          helpVisible={false}
          commandOutput={commandOutput}
        />
        <p
          className="mt-6 text-xs"
          style={{ color: '#5A5652', fontFamily: 'var(--font-metadata)' }}
        >
          Type to search, or try: help, now, random, connections
        </p>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/Terminal.tsx
git commit -m "feat(search): create Terminal overlay with keyboard shortcut"
```

---

### Task 1.7: Nav and Layout Integration

**Files:**
- Modify: `src/app/(main)/layout.tsx:42` (add Terminal import and mount)
- Modify: `src/components/TopNav.tsx:161` (add search trigger button)

**Step 1: Mount Terminal in main layout**

In `src/app/(main)/layout.tsx`, add import at top:

```tsx
import Terminal from '@/components/Terminal';
```

Add `<Terminal />` inside the fragment, after `<DotGrid />`:

```tsx
<DotGrid />
<Terminal />
```

**Step 2: Add search button to TopNav**

In `src/components/TopNav.tsx`, add import:

```tsx
import { MagnifyingGlass } from '@phosphor-icons/react/dist/ssr';
```

Wait: TopNav is a Client Component, so import from the default export:

```tsx
import { MagnifyingGlass } from '@phosphor-icons/react';
```

In the utilities div (line 161, `<div className="flex items-center gap-3 shrink-0 ml-auto">`), add before `<ThemeToggle />`:

```tsx
<button
  onClick={() => {
    // Dispatch keyboard event to toggle terminal
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }));
  }}
  className="text-ink-light hover:text-terracotta transition-colors p-1 bg-transparent border-none cursor-pointer min-h-[44px] min-w-[44px] inline-flex items-center justify-center"
  aria-label="Search (Cmd+K)"
>
  <MagnifyingGlass size={18} weight="thin" />
</button>
```

**Step 3: Verify**

Run: `npm run dev`
Expected: Cmd+K opens terminal overlay. Search icon visible in nav. Typing finds content. Esc closes.

**Step 4: Commit**

```bash
git add src/app/\(main\)/layout.tsx src/components/TopNav.tsx
git commit -m "feat(search): integrate Terminal into nav and layout"
```

---

## Feature 3: Public Changelog

> Git-powered `/changelog` page from filtered commit history.

### Task 3.1: Changelog Fetch Script

**Files:**
- Create: `scripts/fetch-changelog.ts`
- Modify: `package.json:6-10` (add prebuild script, tsx devDependency)
- Modify: `.gitignore` (add changelog.json)

**Step 1: Install tsx as devDependency**

Run: `npm install --save-dev tsx`

**Step 2: Create the fetch script**

```ts
// scripts/fetch-changelog.ts
/**
 * Fetch recent commits from GitHub and filter by conventional commit prefix.
 * Writes categorized entries to src/data/changelog.json.
 *
 * Called during build: npx tsx scripts/fetch-changelog.ts
 * Requires GITHUB_TOKEN env var.
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const REPO = 'Travis-Gilbert/travisgilbert.me';
const BRANCH = 'main';
const MAX_PAGES = 5;
const MAX_ENTRIES = 100;

interface ChangelogEntry {
  sha: string;
  message: string;
  category: string;
  label: string;
  color: string;
  date: string;
  url: string;
  scope?: string;
}

const PREFIX_MAP: { prefix: string; category: string; label: string; color: string }[] = [
  { prefix: 'feat(content):', category: 'content', label: 'NEW CONTENT', color: '#B45A2D' },
  { prefix: 'feat(', category: 'feature', label: 'NEW FEATURE', color: '#2D5F6B' },
  { prefix: 'fix(', category: 'fix', label: 'FIX', color: '#C49A4A' },
  { prefix: 'refactor(', category: 'refactor', label: 'REFACTOR', color: '#9A8E82' },
  { prefix: 'style(', category: 'design', label: 'DESIGN', color: '#B45A2D' },
  { prefix: 'docs(', category: 'docs', label: 'DOCUMENTATION', color: '#9A8E82' },
];

function categorize(message: string): (typeof PREFIX_MAP)[0] | null {
  for (const entry of PREFIX_MAP) {
    if (message.startsWith(entry.prefix)) return entry;
  }
  return null;
}

function extractScope(message: string): string | undefined {
  const match = message.match(/^\w+\(([^)]+)\):/);
  return match?.[1];
}

async function fetchCommits(): Promise<ChangelogEntry[]> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.warn('GITHUB_TOKEN not set. Writing empty changelog.');
    return [];
  }

  const entries: ChangelogEntry[] = [];

  for (let page = 1; page <= MAX_PAGES && entries.length < MAX_ENTRIES; page++) {
    const url = `https://api.github.com/repos/${REPO}/commits?sha=${BRANCH}&per_page=30&page=${page}`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
      },
    });

    if (!res.ok) {
      console.error(`GitHub API error: ${res.status}`);
      break;
    }

    interface GitHubCommit {
      sha: string;
      commit: {
        message: string;
        author: { date: string };
      };
      html_url: string;
      parents: unknown[];
    }

    const commits: GitHubCommit[] = await res.json();
    if (commits.length === 0) break;

    for (const commit of commits) {
      // Skip merge commits
      if (commit.parents.length > 1) continue;

      const firstLine = commit.commit.message.split('\n')[0];
      const cat = categorize(firstLine);
      if (!cat) continue;

      entries.push({
        sha: commit.sha.slice(0, 7),
        message: firstLine,
        category: cat.category,
        label: cat.label,
        color: cat.color,
        date: commit.commit.author.date,
        url: commit.html_url,
        scope: extractScope(firstLine),
      });

      if (entries.length >= MAX_ENTRIES) break;
    }
  }

  return entries;
}

async function main() {
  const entries = await fetchCommits();
  const outDir = join(process.cwd(), 'src', 'data');
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'changelog.json'), JSON.stringify(entries, null, 2));
  console.log(`Changelog: ${entries.length} entries written to src/data/changelog.json`);
}

main().catch(console.error);
```

**Step 3: Add prebuild script**

In `package.json` scripts:

```json
"prebuild": "npx tsx scripts/fetch-changelog.ts"
```

**Step 4: Add to .gitignore**

```
# Generated changelog data (built from GitHub API)
src/data/changelog.json
```

**Step 5: Test the script**

Run: `GITHUB_TOKEN=$GITHUB_TOKEN npx tsx scripts/fetch-changelog.ts`
Expected: `src/data/changelog.json` created with categorized entries.

**Step 6: Commit**

```bash
git add scripts/fetch-changelog.ts package.json package-lock.json .gitignore
git commit -m "feat(changelog): create fetch script with conventional commit filtering"
```

---

### Task 3.2: ChangelogEntry Component

**Files:**
- Create: `src/components/ChangelogEntry.tsx`

**Step 1: Create the component**

```tsx
// src/components/ChangelogEntry.tsx

interface ChangelogEntryProps {
  sha: string;
  message: string;
  label: string;
  color: string;
  date: string;
  url: string;
  scope?: string;
}

export default function ChangelogEntry({
  sha, message, label, color, date, url, scope,
}: ChangelogEntryProps) {
  const dateStr = new Date(date).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });

  return (
    <div className="flex items-start gap-3 py-2">
      {/* Timeline dot */}
      <div
        className="shrink-0 mt-1.5 w-2 h-2 rounded-full"
        style={{ backgroundColor: color }}
        aria-hidden="true"
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span
            className="font-mono text-[10px] uppercase tracking-widest px-1.5 py-0.5 border rounded"
            style={{ color, borderColor: color }}
          >
            {label}
          </span>
          {scope && (
            <span className="font-mono text-[10px] text-ink-light">
              ({scope})
            </span>
          )}
          <span className="font-mono text-[10px] text-ink-light ml-auto shrink-0">
            {dateStr}
          </span>
        </div>
        <p className="mt-0.5 text-sm text-ink m-0">
          {message.replace(/^\w+\([^)]*\):\s*/, '')}
        </p>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono text-[10px] text-ink-light hover:text-terracotta no-underline"
        >
          {sha}
        </a>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/ChangelogEntry.tsx
git commit -m "feat(changelog): create ChangelogEntry component"
```

---

### Task 3.3: Changelog Page

**Files:**
- Create: `src/app/(main)/changelog/page.tsx`

**Step 1: Create the page**

```tsx
// src/app/(main)/changelog/page.tsx
import type { Metadata } from 'next';
import SectionLabel from '@/components/SectionLabel';
import RoughLine from '@/components/rough/RoughLine';
import ChangelogEntry from '@/components/ChangelogEntry';
import DrawOnIcon from '@/components/rough/DrawOnIcon';

export const metadata: Metadata = {
  title: 'Changelog | Travis Gilbert',
  description: 'How this site evolves. Every meaningful change, tracked.',
};

interface RawEntry {
  sha: string;
  message: string;
  category: string;
  label: string;
  color: string;
  date: string;
  url: string;
  scope?: string;
}

function loadChangelog(): RawEntry[] {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('@/data/changelog.json') as RawEntry[];
  } catch {
    return [];
  }
}

function groupByMonth(entries: RawEntry[]): Map<string, RawEntry[]> {
  const groups = new Map<string, RawEntry[]>();
  for (const entry of entries) {
    const d = new Date(entry.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const existing = groups.get(label);
    if (existing) existing.push(entry);
    else groups.set(label, [entry]);
  }
  return groups;
}

export default function ChangelogPage() {
  const entries = loadChangelog();
  const grouped = groupByMonth(entries);

  return (
    <>
      <header className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <DrawOnIcon name="file-text" size={32} />
          <SectionLabel color="terracotta">CHANGELOG</SectionLabel>
        </div>
        <h1 className="font-title text-3xl mb-2">Changelog</h1>
        <p className="text-sm text-ink-secondary">
          How this site evolves. Every meaningful change, tracked.
        </p>
      </header>

      {entries.length === 0 && (
        <p className="text-ink-light font-mono text-sm">
          No changelog entries yet. They appear after the next build.
        </p>
      )}

      {Array.from(grouped.entries()).map(([month, monthEntries], i) => (
        <section key={month} className="mb-8">
          {i > 0 && <RoughLine className="my-6" />}
          <h2
            className="font-mono text-xs uppercase tracking-widest mb-4"
            style={{ color: '#B45A2D' }}
          >
            {month}
          </h2>
          <div className="flex flex-col gap-1 border-l border-border pl-4 ml-1">
            {monthEntries.map((entry) => (
              <ChangelogEntry key={entry.sha} {...entry} />
            ))}
          </div>
        </section>
      ))}
    </>
  );
}
```

**Step 2: Commit**

```bash
git add src/app/\(main\)/changelog/
git commit -m "feat(changelog): create changelog page with monthly groupings"
```

---

### Task 3.4: Sitemap, Footer, and Build Wiring

**Files:**
- Modify: `src/app/sitemap.ts:46` (add changelog and stats entries)
- Modify: `src/components/Footer.tsx:58` (add Changelog link)

**Step 1: Add to sitemap**

In `src/app/sitemap.ts`, after the `/now` entry (line 46), add:

```tsx
{ url: `${BASE_URL}/changelog`, changeFrequency: 'daily' as const, priority: 0.5 },
{ url: `${BASE_URL}/stats`, changeFrequency: 'weekly' as const, priority: 0.5 },
```

**Step 2: Add Changelog link to Footer**

In `src/components/Footer.tsx`, before the `<span>` separator (line 58), add:

```tsx
<Link
  href="/changelog"
  className="text-ink-light hover:text-terracotta no-underline min-h-[44px] inline-flex items-center"
  style={{ fontSize: 11 }}
>
  Changelog
</Link>
```

**Step 3: Verify full build**

Run: `npm run build`
Expected: prebuild fetches changelog, build compiles, postbuild indexes with Pagefind.

**Step 4: Commit**

```bash
git add src/app/sitemap.ts src/components/Footer.tsx
git commit -m "feat(changelog): add to sitemap and footer navigation"
```

---

## Feature 2: Graph-Based Navigation ("Where To Next")

> Post-reading navigation panel powered by the connection engine.

### Task 2.1: Navigation Suggestion Engine

**Files:**
- Modify: `src/lib/connectionEngine.ts` (append new types and function)

**Step 1: Add NavigationSuggestion type and generator**

Append to the end of `src/lib/connectionEngine.ts`:

```ts
// ─────────────────────────────────────────────────
// Navigation Suggestions (Feature: Where To Next)
// ─────────────────────────────────────────────────

export interface NavigationSuggestion {
  connection: Connection;
  rationale: string;
  relevanceScore: number;
  curveStyle: 'heavy' | 'medium' | 'light';
}

const RATIONALE_TEMPLATES: Record<string, (conn: Connection, sharedTag?: string) => string> = {
  essay: (conn, tag) =>
    tag
      ? `Explores a related question about ${tag}`
      : 'Part of the same thread of inquiry',
  'field-note': () => 'A field observation connected to this essay',
  shelf: () => 'A source that shaped this investigation',
};

const WEIGHT_BASE_SCORE: Record<string, number> = {
  heavy: 0.8,
  medium: 0.6,
  light: 0.4,
};

/**
 * Generate ranked navigation suggestions from computed connections.
 *
 * Picks the top N connections by relevance score, each with a
 * human-readable rationale string for display in the WhereToNext panel.
 */
export function generateNavigationSuggestions(
  connections: Connection[],
  currentTags: string[],
  maxSuggestions = 4,
): NavigationSuggestion[] {
  const now = Date.now();
  const NINETY_DAYS = 90 * 24 * 60 * 60 * 1000;

  return connections
    .map((conn) => {
      let score = WEIGHT_BASE_SCORE[conn.weight] ?? 0.4;

      // Recency bonus
      if (conn.date && now - new Date(conn.date).getTime() < NINETY_DAYS) {
        score += 0.1;
      }

      // Tag overlap bonus
      const connTags = conn.tags ?? [];
      const shared = currentTags.filter((t) => connTags.includes(t));
      score += Math.min(shared.length * 0.05, 0.15);

      const templateFn = RATIONALE_TEMPLATES[conn.type] ?? (() => 'Related content');
      const rationale = templateFn(conn, shared[0]);

      return {
        connection: conn,
        rationale,
        relevanceScore: score,
        curveStyle: conn.weight,
      };
    })
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, maxSuggestions);
}
```

Note: The `Connection` type will need `date` and `tags` fields. Check if they already exist; if not, extend the type to include them (they may already be available from the connected content's frontmatter).

**Step 2: Commit**

```bash
git add src/lib/connectionEngine.ts
git commit -m "feat(nav): add navigation suggestion engine with rationale templates"
```

---

### Task 2.2: WhereToNext Components

**Files:**
- Create: `src/components/WhereToNextCard.tsx`
- Create: `src/components/WhereToNext.tsx`

**Step 1: Create WhereToNextCard**

```tsx
// src/components/WhereToNextCard.tsx
import Link from 'next/link';
import type { NavigationSuggestion } from '@/lib/connectionEngine';

const TYPE_URL_PREFIX: Record<string, string> = {
  essay: '/essays',
  'field-note': '/field-notes',
  shelf: '/shelf',
};

const TYPE_LABEL: Record<string, string> = {
  essay: 'Essay',
  'field-note': 'Field Note',
  shelf: 'Shelf',
};

interface WhereToNextCardProps {
  suggestion: NavigationSuggestion;
}

export default function WhereToNextCard({ suggestion }: WhereToNextCardProps) {
  const { connection, rationale } = suggestion;
  const href = `${TYPE_URL_PREFIX[connection.type] ?? ''}/${connection.slug}`;
  const typeLabel = TYPE_LABEL[connection.type] ?? connection.type;

  return (
    <Link
      href={href}
      className="block no-underline p-3 border-l-[3px] transition-colors hover:bg-[rgba(180,90,45,0.04)]"
      style={{ borderLeftColor: connection.color }}
    >
      <span
        className="font-mono text-[10px] uppercase tracking-widest"
        style={{ color: connection.color }}
      >
        {typeLabel}
      </span>
      <span className="block font-title text-lg text-ink mt-0.5">
        {connection.title}
      </span>
      <span className="block text-sm text-ink-secondary italic mt-0.5" style={{ fontFamily: 'var(--font-body)' }}>
        {rationale}
      </span>
    </Link>
  );
}
```

**Step 2: Create WhereToNext**

```tsx
// src/components/WhereToNext.tsx
import SectionLabel from '@/components/SectionLabel';
import RoughLine from '@/components/rough/RoughLine';
import WhereToNextCard from '@/components/WhereToNextCard';
import type { NavigationSuggestion } from '@/lib/connectionEngine';

interface WhereToNextProps {
  suggestions: NavigationSuggestion[];
}

export default function WhereToNext({ suggestions }: WhereToNextProps) {
  if (suggestions.length === 0) return null;

  return (
    <section className="mt-8 mb-4">
      <SectionLabel color="terracotta">WHERE TO NEXT</SectionLabel>
      <RoughLine className="my-3" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mt-4">
        {suggestions.map((s) => (
          <WhereToNextCard key={s.connection.slug} suggestion={s} />
        ))}
      </div>
    </section>
  );
}
```

**Step 3: Commit**

```bash
git add src/components/WhereToNext.tsx src/components/WhereToNextCard.tsx
git commit -m "feat(nav): build WhereToNext panel and suggestion cards"
```

---

### Task 2.3: Essay Page Integration

**Files:**
- Modify: `src/app/(main)/essays/[slug]/page.tsx` (import + render WhereToNext above prev/next nav)

**Step 1: Add import**

In the imports section (around line 18):

```tsx
import WhereToNext from '@/components/WhereToNext';
import { generateNavigationSuggestions } from '@/lib/connectionEngine';
```

**Step 2: Compute suggestions**

After the existing connection computation (around line 128, after `positionConnections`), add:

```tsx
const allConnections = computeConnections(entry, allContent);
// ...existing positionConnections call...

const suggestions = generateNavigationSuggestions(
  allConnections,
  entry.data.tags,
  4,
);
```

**Step 3: Render WhereToNext above prev/next nav**

Before line 335 (the `<nav>` with prev/next), insert:

```tsx
<WhereToNext suggestions={suggestions} />
```

**Step 4: Verify**

Run: `npm run dev`, navigate to an essay detail page.
Expected: "WHERE TO NEXT" section appears above prev/next arrows with 1 to 4 suggestion cards.

**Step 5: Commit**

```bash
git add src/app/\(main\)/essays/\[slug\]/page.tsx
git commit -m "feat(nav): integrate WhereToNext into essay detail pages"
```

---

### Task 2.4: Field Notes Integration

**Files:**
- Modify: `src/app/(main)/field-notes/[slug]/page.tsx`

**Step 1: Add simplified WhereToNext**

Field notes have simpler connections (usually just the parent essay). Add `WhereToNext` to the field note detail page using the same pattern, but with `maxSuggestions = 2`.

**Step 2: Verify and commit**

```bash
git add src/app/\(main\)/field-notes/\[slug\]/page.tsx
git commit -m "feat(nav): add WhereToNext to field note detail pages"
```

---

## Feature 4: Writing & Research Analytics

> `/stats` page with D3 visualizations of writing output and research activity.

### Task 4.1: Analytics Computation Library

**Files:**
- Create: `src/lib/analytics.ts`

**Step 1: Create analytics computation**

```ts
// src/lib/analytics.ts
import type { ContentEntry, Essay, FieldNote, ShelfEntry } from './content';

export interface WritingStats {
  totalEssays: number;
  totalFieldNotes: number;
  totalWords: number;
  averageWordsPerEssay: number;
  essaysByMonth: { month: string; count: number; cumulative: number }[];
  essaysByStage: { stage: string; count: number }[];
  topTags: { tag: string; count: number }[];
  connectionDensity: number;
  oldestEssay: { title: string; date: string } | null;
  newestEssay: { title: string; date: string } | null;
  longestEssay: { title: string; wordCount: number } | null;
  totalShelfItems: number;
}

function wordCount(body: string): number {
  return body.trim().split(/\s+/).length;
}

export function computeWritingStats(
  essays: ContentEntry<Essay>[],
  fieldNotes: ContentEntry<FieldNote>[],
  shelf: ContentEntry<ShelfEntry>[],
): WritingStats {
  // Word counts
  const essayWords = essays.map((e) => ({
    title: e.data.title,
    words: wordCount(e.body),
    date: e.data.date,
    tags: e.data.tags,
    stage: e.data.stage,
  }));

  const totalWords = essayWords.reduce((sum, e) => sum + e.words, 0);

  // Sort by date for timeline
  const sorted = [...essayWords].sort(
    (a, b) => a.date.valueOf() - b.date.valueOf()
  );

  // Monthly counts
  const monthMap = new Map<string, number>();
  for (const e of sorted) {
    const d = e.date;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    monthMap.set(key, (monthMap.get(key) ?? 0) + 1);
  }

  let cumulative = 0;
  const essaysByMonth = Array.from(monthMap.entries()).map(([month, count]) => {
    cumulative += count;
    return { month, count, cumulative };
  });

  // Stage counts
  const stageMap = new Map<string, number>();
  for (const e of essayWords) {
    const stage = e.stage ?? 'unknown';
    stageMap.set(stage, (stageMap.get(stage) ?? 0) + 1);
  }
  const essaysByStage = Array.from(stageMap.entries()).map(
    ([stage, count]) => ({ stage, count })
  );

  // Tag frequency
  const tagMap = new Map<string, number>();
  for (const e of essayWords) {
    for (const tag of e.tags) {
      tagMap.set(tag, (tagMap.get(tag) ?? 0) + 1);
    }
  }
  const topTags = Array.from(tagMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([tag, count]) => ({ tag, count }));

  // Extremes
  const longestEssay = essayWords.length > 0
    ? essayWords.reduce((max, e) => (e.words > max.words ? e : max))
    : null;

  return {
    totalEssays: essays.length,
    totalFieldNotes: fieldNotes.length,
    totalShelfItems: shelf.length,
    totalWords,
    averageWordsPerEssay: essays.length > 0 ? Math.round(totalWords / essays.length) : 0,
    essaysByMonth,
    essaysByStage,
    topTags,
    connectionDensity: 0, // Computed separately if needed
    oldestEssay: sorted[0]
      ? { title: sorted[0].title, date: sorted[0].date.toISOString() }
      : null,
    newestEssay: sorted[sorted.length - 1]
      ? { title: sorted[sorted.length - 1].title, date: sorted[sorted.length - 1].date.toISOString() }
      : null,
    longestEssay: longestEssay
      ? { title: longestEssay.title, wordCount: longestEssay.words }
      : null,
  };
}
```

**Step 2: Commit**

```bash
git add src/lib/analytics.ts
git commit -m "feat(stats): create analytics computation library"
```

---

### Task 4.2: WordCountGauge Component

**Files:**
- Create: `src/components/analytics/WordCountGauge.tsx`

**Step 1: Create gauge**

```tsx
// src/components/analytics/WordCountGauge.tsx

interface WordCountGaugeProps {
  totalWords: number;
  averagePerEssay: number;
  totalEssays: number;
  totalFieldNotes: number;
  totalShelfItems: number;
}

export default function WordCountGauge({
  totalWords, averagePerEssay, totalEssays, totalFieldNotes, totalShelfItems,
}: WordCountGaugeProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
      <Stat label="Total Words" value={totalWords.toLocaleString()} />
      <Stat label="Avg per Essay" value={averagePerEssay.toLocaleString()} />
      <Stat label="Essays" value={String(totalEssays)} />
      <Stat label="Field Notes" value={String(totalFieldNotes)} />
      <Stat label="Shelf Items" value={String(totalShelfItems)} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center py-3">
      <p className="font-title text-2xl text-ink m-0">{value}</p>
      <p className="font-mono text-[10px] uppercase tracking-widest text-ink-light m-0 mt-1">
        {label}
      </p>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/analytics/WordCountGauge.tsx
git commit -m "feat(stats): create WordCountGauge component"
```

---

### Task 4.3: WritingTimeline Component (D3)

**Files:**
- Create: `src/components/analytics/WritingTimeline.tsx`

**Step 1: Create D3 area chart**

```tsx
// src/components/analytics/WritingTimeline.tsx
'use client';

import { useRef, useEffect } from 'react';
import * as d3 from 'd3';

interface DataPoint {
  month: string;
  cumulative: number;
}

interface WritingTimelineProps {
  data: DataPoint[];
}

export default function WritingTimeline({ data }: WritingTimelineProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || data.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = svgRef.current.clientWidth;
    const height = 240;
    const margin = { top: 20, right: 20, bottom: 30, left: 40 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const parseMonth = d3.timeParse('%Y-%m');
    const parsed = data.map((d) => ({
      date: parseMonth(d.month)!,
      value: d.cumulative,
    }));

    const x = d3.scaleTime()
      .domain(d3.extent(parsed, (d) => d.date) as [Date, Date])
      .range([0, innerW]);

    const y = d3.scaleLinear()
      .domain([0, d3.max(parsed, (d) => d.value) ?? 1])
      .nice()
      .range([innerH, 0]);

    const area = d3.area<typeof parsed[0]>()
      .x((d) => x(d.date))
      .y0(innerH)
      .y1((d) => y(d.value))
      .curve(d3.curveBasis);

    const line = d3.line<typeof parsed[0]>()
      .x((d) => x(d.date))
      .y((d) => y(d.value))
      .curve(d3.curveBasis);

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    // Area
    g.append('path')
      .datum(parsed)
      .attr('d', area)
      .attr('fill', '#B45A2D')
      .attr('fill-opacity', 0.12);

    // Line
    g.append('path')
      .datum(parsed)
      .attr('d', line)
      .attr('fill', 'none')
      .attr('stroke', '#B45A2D')
      .attr('stroke-width', 1.5);

    // Axes
    g.append('g')
      .attr('transform', `translate(0,${innerH})`)
      .call(d3.axisBottom(x).ticks(6).tickFormat(d3.timeFormat('%b %y') as (d: d3.NumberValue, i: number) => string))
      .attr('font-size', '10px')
      .attr('font-family', 'var(--font-metadata)');

    g.append('g')
      .call(d3.axisLeft(y).ticks(5))
      .attr('font-size', '10px')
      .attr('font-family', 'var(--font-metadata)');
  }, [data]);

  return (
    <svg
      ref={svgRef}
      className="w-full"
      viewBox={`0 0 ${800} ${240}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="Essay publication timeline"
    />
  );
}
```

**Step 2: Commit**

```bash
git add src/components/analytics/WritingTimeline.tsx
git commit -m "feat(stats): create WritingTimeline D3 area chart"
```

---

### Task 4.4: TopicDistribution Treemap (D3)

**Files:**
- Create: `src/components/analytics/TopicDistribution.tsx`

**Step 1: Create D3 treemap**

```tsx
// src/components/analytics/TopicDistribution.tsx
'use client';

import { useRef, useEffect } from 'react';
import * as d3 from 'd3';

interface TagData {
  tag: string;
  count: number;
}

interface TopicDistributionProps {
  data: TagData[];
}

const COLORS = ['#B45A2D', '#2D5F6B', '#C49A4A', '#5A7A4A'];

export default function TopicDistribution({ data }: TopicDistributionProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || data.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = 800;
    const height = 300;

    const root = d3.hierarchy({ children: data } as { children: TagData[] })
      .sum((d: unknown) => (d as TagData).count ?? 0);

    d3.treemap<{ children: TagData[] }>()
      .size([width, height])
      .padding(2)(root as d3.HierarchyNode<{ children: TagData[] }>);

    const leaves = (root as d3.HierarchyNode<{ children: TagData[] }>).leaves() as (d3.HierarchyRectangularNode<unknown> & { data: TagData })[];

    const g = svg.append('g');

    const cell = g.selectAll('g')
      .data(leaves)
      .join('g')
      .attr('transform', (d) => `translate(${d.x0},${d.y0})`);

    cell.append('rect')
      .attr('width', (d) => d.x1 - d.x0)
      .attr('height', (d) => d.y1 - d.y0)
      .attr('fill', (_, i) => COLORS[i % COLORS.length])
      .attr('fill-opacity', 0.15)
      .attr('stroke', (_, i) => COLORS[i % COLORS.length])
      .attr('stroke-opacity', 0.4)
      .attr('rx', 2);

    cell.append('text')
      .attr('x', 4)
      .attr('y', 14)
      .attr('font-size', '10px')
      .attr('font-family', 'var(--font-metadata)')
      .attr('fill', 'var(--color-ink)')
      .text((d) => {
        const w = d.x1 - d.x0;
        return w > 50 ? `${d.data.tag} (${d.data.count})` : '';
      });
  }, [data]);

  return (
    <svg
      ref={svgRef}
      className="w-full"
      viewBox="0 0 800 300"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="Topic distribution treemap"
    />
  );
}
```

**Step 2: Commit**

```bash
git add src/components/analytics/TopicDistribution.tsx
git commit -m "feat(stats): create TopicDistribution D3 treemap"
```

---

### Task 4.5: Stats Page Assembly

**Files:**
- Create: `src/app/(main)/stats/page.tsx`

**Step 1: Create the stats page**

```tsx
// src/app/(main)/stats/page.tsx
import type { Metadata } from 'next';
import { getCollection } from '@/lib/content';
import type { Essay, FieldNote, ShelfEntry } from '@/lib/content';
import { computeWritingStats } from '@/lib/analytics';
import SectionLabel from '@/components/SectionLabel';
import RoughLine from '@/components/rough/RoughLine';
import DrawOnIcon from '@/components/rough/DrawOnIcon';
import WordCountGauge from '@/components/analytics/WordCountGauge';
import WritingTimeline from '@/components/analytics/WritingTimeline';
import TopicDistribution from '@/components/analytics/TopicDistribution';

export const metadata: Metadata = {
  title: 'Writing Analytics | Travis Gilbert',
  description: 'The numbers behind the research and writing.',
};

export default function StatsPage() {
  const essays = getCollection<Essay>('essays').filter((e) => !e.data.draft);
  const fieldNotes = getCollection<FieldNote>('field-notes').filter((n) => !n.data.draft);
  const shelf = getCollection<ShelfEntry>('shelf');

  const stats = computeWritingStats(essays, fieldNotes, shelf);

  return (
    <>
      <header className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <DrawOnIcon name="gears" size={32} />
          <SectionLabel color="terracotta">WRITING ANALYTICS</SectionLabel>
        </div>
        <h1 className="font-title text-3xl mb-2">Writing Analytics</h1>
        <p className="text-sm text-ink-secondary">
          The numbers behind the research and writing.
        </p>
      </header>

      <section className="mb-8">
        <SectionLabel color="terracotta">OUTPUT</SectionLabel>
        <RoughLine className="my-3" />
        <WordCountGauge
          totalWords={stats.totalWords}
          averagePerEssay={stats.averageWordsPerEssay}
          totalEssays={stats.totalEssays}
          totalFieldNotes={stats.totalFieldNotes}
          totalShelfItems={stats.totalShelfItems}
        />

        <div className="mt-6">
          <h3 className="font-mono text-xs uppercase tracking-widest text-ink-light mb-3">
            Essays Over Time
          </h3>
          <WritingTimeline data={stats.essaysByMonth} />
        </div>

        <div className="mt-6">
          <h3 className="font-mono text-xs uppercase tracking-widest text-ink-light mb-3">
            Topic Distribution
          </h3>
          <TopicDistribution data={stats.topTags} />
        </div>
      </section>

      {stats.longestEssay && (
        <section className="mb-8">
          <SectionLabel color="teal">HIGHLIGHTS</SectionLabel>
          <RoughLine className="my-3" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-ink-light m-0">
                Longest Essay
              </p>
              <p className="font-title text-lg text-ink m-0 mt-1">
                {stats.longestEssay.title}
              </p>
              <p className="font-mono text-xs text-ink-light m-0">
                {stats.longestEssay.wordCount.toLocaleString()} words
              </p>
            </div>
            {stats.oldestEssay && (
              <div>
                <p className="font-mono text-[10px] uppercase tracking-widest text-ink-light m-0">
                  First Published
                </p>
                <p className="font-title text-lg text-ink m-0 mt-1">
                  {stats.oldestEssay.title}
                </p>
              </div>
            )}
          </div>
        </section>
      )}

      <footer className="mt-12 text-center">
        <p className="font-mono text-xs text-ink-light">
          Data computed from {stats.totalEssays} essays, {stats.totalFieldNotes} field notes,
          and {stats.totalShelfItems} shelf items.
        </p>
      </footer>
    </>
  );
}
```

**Step 2: Add Stats link to Footer**

In `src/components/Footer.tsx`, add alongside the Changelog link:

```tsx
<Link
  href="/stats"
  className="text-ink-light hover:text-terracotta no-underline min-h-[44px] inline-flex items-center"
  style={{ fontSize: 11 }}
>
  Stats
</Link>
```

**Step 3: Verify**

Run: `npm run dev`, navigate to `/stats`.
Expected: Page renders with word count gauge, timeline chart, and topic treemap.

**Step 4: Commit**

```bash
git add src/app/\(main\)/stats/ src/components/Footer.tsx
git commit -m "feat(stats): assemble stats page with analytics visualizations"
```

---

## Feature 5: Webmention Wiring

> Outbound sending + trigger endpoint + frontend display components.

### Task 5.1: Outbound Webmention Sender

**Files:**
- Create: `research_api/apps/mentions/sender.py`

**Step 1: Create sender module**

```python
# research_api/apps/mentions/sender.py
"""
Outbound Webmention sender.

Given a published content URL:
1. Fetch the rendered HTML
2. Extract all external links
3. For each link, discover the Webmention endpoint (Link header or <link> tag)
4. POST source + target to the discovered endpoint

Follows the W3C Webmention spec:
https://www.w3.org/TR/webmention/#sending-webmentions
"""

import logging
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

SITE_DOMAIN = "travisgilbert.me"
TIMEOUT = 10


def discover_webmention_endpoint(target_url: str) -> str | None:
    """
    Discover a Webmention endpoint for the given URL.

    Checks (in order):
    1. HTTP Link header with rel="webmention"
    2. HTML <link rel="webmention"> tag
    3. HTML <a rel="webmention"> tag
    """
    try:
        resp = requests.get(target_url, timeout=TIMEOUT, allow_redirects=True)
        resp.raise_for_status()
    except requests.RequestException:
        logger.debug("Could not fetch %s for endpoint discovery", target_url)
        return None

    # Check Link header
    link_header = resp.headers.get("Link", "")
    if 'rel="webmention"' in link_header or "rel=webmention" in link_header:
        for part in link_header.split(","):
            if "webmention" in part:
                url = part.split(";")[0].strip().strip("<>")
                return urljoin(target_url, url)

    # Check HTML
    soup = BeautifulSoup(resp.text, "html.parser")
    for tag_name in ("link", "a"):
        tag = soup.find(tag_name, rel="webmention")
        if tag and tag.get("href"):
            return urljoin(target_url, tag["href"])

    return None


def send_webmention(source_url: str, target_url: str, endpoint: str) -> bool:
    """POST a Webmention notification to the discovered endpoint."""
    try:
        resp = requests.post(
            endpoint,
            data={"source": source_url, "target": target_url},
            timeout=TIMEOUT,
        )
        accepted = resp.status_code in (200, 201, 202)
        if accepted:
            logger.info("Webmention accepted: %s -> %s", source_url, target_url)
        else:
            logger.warning(
                "Webmention rejected (%d): %s -> %s",
                resp.status_code, source_url, target_url,
            )
        return accepted
    except requests.RequestException as exc:
        logger.error("Webmention send failed: %s -> %s (%s)", source_url, target_url, exc)
        return False


def send_webmentions_for_content(content_url: str) -> dict:
    """
    Fetch the rendered page at content_url, extract external links,
    and send Webmentions to any that support the protocol.

    Returns: { "discovered": int, "sent": int, "failed": int, "details": [...] }
    """
    result = {"discovered": 0, "sent": 0, "failed": 0, "details": []}

    try:
        resp = requests.get(content_url, timeout=TIMEOUT)
        resp.raise_for_status()
    except requests.RequestException:
        logger.error("Could not fetch own content at %s", content_url)
        return result

    soup = BeautifulSoup(resp.text, "html.parser")

    for link in soup.find_all("a", href=True):
        href = link["href"]
        parsed = urlparse(href)

        # Skip internal, anchor, and non-HTTP links
        if not parsed.scheme.startswith("http"):
            continue
        if parsed.netloc == SITE_DOMAIN:
            continue

        endpoint = discover_webmention_endpoint(href)
        if not endpoint:
            continue

        result["discovered"] += 1
        detail = {"target": href, "endpoint": endpoint, "sent": False}

        if send_webmention(content_url, href, endpoint):
            result["sent"] += 1
            detail["sent"] = True
        else:
            result["failed"] += 1

        result["details"].append(detail)

    return result
```

**Step 2: Commit**

```bash
git add research_api/apps/mentions/sender.py
git commit -m "feat(mentions): create outbound Webmention sender"
```

---

### Task 5.2: Management Command

**Files:**
- Create: `research_api/apps/mentions/management/__init__.py`
- Create: `research_api/apps/mentions/management/commands/__init__.py`
- Create: `research_api/apps/mentions/management/commands/send_webmentions.py`

**Step 1: Create management command**

```python
# research_api/apps/mentions/management/commands/send_webmentions.py
"""
Send outbound Webmentions for published content.

Usage:
    python manage.py send_webmentions --url https://travisgilbert.me/essays/some-slug
    python manage.py send_webmentions --all-recent
"""

from django.core.management.base import BaseCommand

from research_api.apps.mentions.sender import send_webmentions_for_content


class Command(BaseCommand):
    help = "Send outbound Webmentions for published content URLs."

    def add_arguments(self, parser):
        parser.add_argument("--url", type=str, help="Single content URL to process")
        parser.add_argument(
            "--all-recent",
            action="store_true",
            help="Process all content published in the last 7 days",
        )

    def handle(self, *args, **options):
        url = options.get("url")

        if url:
            self.stdout.write(f"Sending Webmentions for: {url}")
            result = send_webmentions_for_content(url)
            self.stdout.write(
                f"Discovered: {result['discovered']}, "
                f"Sent: {result['sent']}, "
                f"Failed: {result['failed']}"
            )
            for detail in result["details"]:
                status = "OK" if detail["sent"] else "FAIL"
                self.stdout.write(f"  [{status}] {detail['target']}")
        elif options.get("all_recent"):
            self.stdout.write("--all-recent not yet implemented (needs published content index)")
        else:
            self.stderr.write("Provide --url or --all-recent")
```

**Step 2: Create `__init__.py` files**

Create empty `__init__.py` in both `management/` and `management/commands/` directories.

**Step 3: Commit**

```bash
git add research_api/apps/mentions/management/
git commit -m "feat(mentions): add send_webmentions management command"
```

---

### Task 5.3: Internal Trigger Endpoint

**Files:**
- Modify: `research_api/apps/mentions/views.py` (add trigger endpoint)
- Modify: `research_api/apps/mentions/urls.py` (add URL pattern)

**Step 1: Add trigger view**

In `research_api/apps/mentions/views.py`, add:

```python
import json
from django.conf import settings
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST

from .sender import send_webmentions_for_content


@csrf_exempt
@require_POST
def trigger_outbound_webmentions(request):
    """
    Internal endpoint: triggered by publishing_api after content publish.
    Accepts JSON: { "content_type": "essay", "slug": "the-sidewalk-tax" }
    """
    # Verify internal API key
    auth = request.headers.get("Authorization", "")
    expected = f"Bearer {getattr(settings, 'INTERNAL_API_KEY', '')}"
    if auth != expected:
        return JsonResponse({"error": "Unauthorized"}, status=401)

    try:
        body = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    content_type = body.get("content_type", "essay")
    slug = body.get("slug", "")
    if not slug:
        return JsonResponse({"error": "slug is required"}, status=400)

    type_prefix = {"essay": "essays", "field-note": "field-notes"}.get(content_type, content_type)
    content_url = f"https://travisgilbert.me/{type_prefix}/{slug}"

    result = send_webmentions_for_content(content_url)
    return JsonResponse(result)
```

**Step 2: Wire URL**

In `research_api/apps/mentions/urls.py`, add:

```python
path('trigger-send/', trigger_outbound_webmentions, name='trigger-send'),
```

**Step 3: Commit**

```bash
git add research_api/apps/mentions/views.py research_api/apps/mentions/urls.py
git commit -m "feat(mentions): add internal trigger endpoint for outbound Webmentions"
```

---

### Task 5.4: MentionCard Frontend Component

**Files:**
- Create: `src/components/research/MentionCard.tsx`

**Step 1: Create MentionCard**

```tsx
// src/components/research/MentionCard.tsx
import { CheckCircle } from '@phosphor-icons/react/dist/ssr';

interface MentionCardProps {
  sourceUrl: string;
  sourceTitle?: string;
  sourceAuthor?: string;
  sourceExcerpt?: string;
  mentionType: string;
  verified: boolean;
  featured: boolean;
  createdAt: string;
}

const TYPE_LABELS: Record<string, string> = {
  reply: 'REPLY',
  link: 'LINK',
  repost: 'REPOST',
  like: 'LIKE',
  mention: 'MENTION',
  quote: 'QUOTE',
};

export default function MentionCard({
  sourceUrl, sourceTitle, sourceAuthor, sourceExcerpt,
  mentionType, verified, featured, createdAt,
}: MentionCardProps) {
  const dateStr = new Date(createdAt).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });

  return (
    <div
      className="py-3 border-l-[3px] pl-3"
      style={{ borderLeftColor: featured ? '#C49A4A' : 'var(--color-border)' }}
    >
      <div className="flex items-center gap-2">
        <span className="font-mono text-[10px] uppercase tracking-widest text-ink-light">
          {TYPE_LABELS[mentionType] ?? mentionType.toUpperCase()}
        </span>
        {verified && (
          <CheckCircle size={12} weight="thin" className="text-teal" />
        )}
        <span className="font-mono text-[10px] text-ink-light ml-auto">
          {dateStr}
        </span>
      </div>

      <a
        href={sourceUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="block text-sm text-ink hover:text-terracotta no-underline mt-1"
      >
        {sourceTitle || sourceUrl}
      </a>

      {sourceAuthor && (
        <p className="text-xs text-ink-light m-0 mt-0.5">by {sourceAuthor}</p>
      )}

      {sourceExcerpt && (
        <p className="text-xs text-ink-secondary m-0 mt-1 line-clamp-2">
          {sourceExcerpt}
        </p>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/research/MentionCard.tsx
git commit -m "feat(mentions): create MentionCard frontend component"
```

---

## Feature 6: Connected Reading Sidebar

> Expandable sidebar on essay pages showing connection graph and shared sources.

### Task 6.1: ConnectedReadingSidebar Component

**Files:**
- Create: `src/components/ConnectedReadingSidebar.tsx`

**Step 1: Create sidebar component**

```tsx
// src/components/ConnectedReadingSidebar.tsx
'use client';

import { useState } from 'react';
import { CaretLeft, CaretRight } from '@phosphor-icons/react';
import type { Connection } from '@/lib/connectionEngine';

const TYPE_URL_PREFIX: Record<string, string> = {
  essay: '/essays',
  'field-note': '/field-notes',
  shelf: '/shelf',
};

interface ConnectedReadingSidebarProps {
  connections: Connection[];
  currentSlug: string;
  currentTitle: string;
}

export default function ConnectedReadingSidebar({
  connections, currentTitle,
}: ConnectedReadingSidebarProps) {
  const [expanded, setExpanded] = useState(false);

  if (connections.length === 0) return null;

  // Group by type
  const grouped = new Map<string, Connection[]>();
  for (const conn of connections) {
    const group = grouped.get(conn.type) ?? [];
    group.push(conn);
    grouped.set(conn.type, group);
  }

  return (
    <aside
      className="hidden xl:block fixed right-0 top-1/4 z-40 transition-all duration-200 ease-out"
      style={{
        width: expanded ? 320 : 36,
        backgroundColor: 'rgba(240, 235, 228, 0.95)',
        backdropFilter: 'blur(8px)',
        borderLeft: '1px solid var(--color-border)',
      }}
      aria-label="Connected reading sidebar"
    >
      {/* Toggle button */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-center py-3 bg-transparent border-none cursor-pointer"
        aria-label={expanded ? 'Collapse sidebar' : 'Expand sidebar'}
        style={{ minHeight: 44 }}
      >
        {expanded ? <CaretRight size={16} /> : <CaretLeft size={16} />}
        {!expanded && (
          <span
            className="font-mono text-[11px] mt-1"
            style={{ writingMode: 'vertical-rl', color: 'var(--color-ink-light)' }}
          >
            {connections.length} connections
          </span>
        )}
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-3 pb-4 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 200px)' }}>
          <h3
            className="font-mono text-[10px] uppercase tracking-widest mb-3"
            style={{ color: '#B45A2D' }}
          >
            Connections
          </h3>
          <p className="text-xs text-ink-secondary mb-4">
            Related to: {currentTitle}
          </p>

          {Array.from(grouped.entries()).map(([type, conns]) => (
            <div key={type} className="mb-4">
              <p className="font-mono text-[9px] uppercase tracking-widest text-ink-light mb-1">
                {type.replace('-', ' ')}s
              </p>
              {conns.map((conn) => (
                <a
                  key={conn.slug}
                  href={`${TYPE_URL_PREFIX[conn.type] ?? ''}/${conn.slug}`}
                  className="block text-sm text-ink hover:text-terracotta no-underline py-1.5 border-l-2 pl-2 mb-1"
                  style={{ borderLeftColor: conn.color }}
                >
                  {conn.title}
                </a>
              ))}
            </div>
          ))}
        </div>
      )}
    </aside>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/ConnectedReadingSidebar.tsx
git commit -m "feat(sidebar): create ConnectedReadingSidebar component"
```

---

### Task 6.2: Essay Page Integration

**Files:**
- Modify: `src/app/(main)/essays/[slug]/page.tsx`

**Step 1: Import and render**

Add import:

```tsx
import ConnectedReadingSidebar from '@/components/ConnectedReadingSidebar';
```

Wrap the article in a relative div and add the sidebar. Replace the outer `<article>` wrapper:

```tsx
<div className="relative">
  <article className="...existing classes...">
    {/* ...existing article content... */}
  </article>
  <ConnectedReadingSidebar
    connections={allConnections}
    currentSlug={slug}
    currentTitle={entry.data.title}
  />
</div>
```

**Step 2: Verify**

Run: `npm run dev`, navigate to an essay with connections on a wide viewport (1280px+).
Expected: Thin sidebar strip on right edge. Clicking expands to 320px with connection list.

**Step 3: Commit**

```bash
git add src/app/\(main\)/essays/\[slug\]/page.tsx
git commit -m "feat(sidebar): integrate ConnectedReadingSidebar into essay pages"
```

---

## Implementation Priority and Parallelism

```
Feature 1 (Terminal Search)  ──┐
                               ├── Can build in parallel
Feature 3 (Changelog)        ──┘

Feature 2 (Graph Navigation) ──┐
                               ├── Can build in parallel
Feature 4 (Writing Analytics) ─┘

Feature 5 (Webmention Wiring)    ← Independent

Feature 6 (Connected Sidebar)    ← Depends on Feature 2
```

**Total tasks:** 27
**Estimated commits:** 27
