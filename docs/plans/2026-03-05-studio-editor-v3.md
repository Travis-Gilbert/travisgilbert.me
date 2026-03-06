# Studio Editor v3: Research-Connected Writing Environment

> **For Claude Code.** Read this entire document before touching any files.
> No em dashes anywhere. Use colons, semicolons, commas, or periods instead.
> Run `npm run build` after each batch to verify zero errors before proceeding.

## Repo and Paths

```
Repo:           Travis-Gilbert/travisgilbert.me
Studio routes:  src/app/(studio)/studio/
Components:     src/components/studio/
New extensions: src/components/studio/extensions/
Shared types:   src/lib/studio.ts
API client:     src/lib/studio-api.ts
Styles:         src/styles/studio.css
Django backend: publishing_api/ (same monorepo)
Research API:   research_api/ (same monorepo)
```

## Overview

Three new features for the Studio editor, all centered on connecting the writing process to research material:

1. **Right-click context menu** with "Stash for Later" and "Contain as..." actions
2. **Contained Blocks**: a custom Tiptap NodeView that wraps selected text in a labeled, color-coded compartment (Observation, Argument, Evidence, Question, Aside, Raw Material)
3. **Wiki-linking via `[[`**: a Tiptap Suggestion extension that searches Commonplace entries and inserts `[[Title]]` links
4. **Research Panel**: the right sidebar's Research tab shows Sources, Connected Content (backlinks), resolved wiki-links, active Research Thread, and Next Steps

## Design Tokens (already defined in studio.css)

These tokens already exist. Do NOT redefine them. Reference them via `var(--token-name)`.

```
Contain block colors (NEW, add to .studio-theme in studio.css):
  --studio-contain-observation:       #3A8A9A (teal)
  --studio-contain-argument:          #B45A2D (terracotta)
  --studio-contain-evidence:          #D4AA4A (gold)
  --studio-contain-question:          #8A6A9A (purple)
  --studio-contain-aside:             #6A9A5A (green)
  --studio-contain-raw:               #7A7268 (muted)
```

## Dependencies

All Tiptap packages are already installed at `^3.20.0`. No new npm packages needed.

The custom NodeView uses `@tiptap/react` (ReactNodeViewRenderer). The Suggestion plugin uses `@tiptap/pm/state` and the built-in Suggestion utility. Verify `@tiptap/suggestion` is resolvable; if not:

```bash
npm install @tiptap/suggestion@^3.20.0
```

---

## Batch 0: Contain Block Extension (Tiptap NodeView)

### Problem

Writers need to compartmentalize sections of text by intent (observation, argument, evidence, question, aside, raw material) without removing them from the document. Currently there is no way to label or visually distinguish blocks of prose by their rhetorical function.

### File: `src/components/studio/extensions/ContainBlock.tsx` (NEW)

Create a custom Tiptap Node extension with a React NodeView. The node wraps arbitrary block content (paragraphs, lists, headings) in a labeled container.

#### Schema

```typescript
import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import ContainBlockView from './ContainBlockView';

export interface ContainBlockOptions {
  HTMLAttributes: Record<string, string>;
}

export const CONTAIN_TYPES = [
  'observation',
  'argument',
  'evidence',
  'question',
  'aside',
  'raw',
] as const;

export type ContainType = (typeof CONTAIN_TYPES)[number];

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    containBlock: {
      setContainBlock: (attrs: { containType: ContainType }) => ReturnType;
      unsetContainBlock: () => ReturnType;
    };
  }
}

const ContainBlock = Node.create<ContainBlockOptions>({
  name: 'containBlock',
  group: 'block',
  content: 'block+',
  defining: true,

  addAttributes() {
    return {
      containType: {
        default: 'observation',
        parseHTML: (el) => el.getAttribute('data-contain-type') || 'observation',
        renderHTML: (attrs) => ({ 'data-contain-type': attrs.containType }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-contain-type]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        class: 'studio-contain-block',
      }),
      0,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ContainBlockView);
  },

  addCommands() {
    return {
      setContainBlock:
        (attrs) =>
        ({ commands }) => {
          return commands.wrapIn(this.name, attrs);
        },
      unsetContainBlock:
        () =>
        ({ commands }) => {
          return commands.lift(this.name);
        },
    };
  },
});

export default ContainBlock;
```

### File: `src/components/studio/extensions/ContainBlockView.tsx` (NEW)

React component rendered inside the Tiptap NodeView.

```tsx
'use client';

import { NodeViewWrapper, NodeViewContent } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';
import type { ContainType } from './ContainBlock';

const CONTAIN_META: Record<
  ContainType,
  { label: string; colorVar: string }
> = {
  observation: { label: 'Observation', colorVar: '--studio-contain-observation' },
  argument: { label: 'Argument', colorVar: '--studio-contain-argument' },
  evidence: { label: 'Evidence', colorVar: '--studio-contain-evidence' },
  question: { label: 'Question', colorVar: '--studio-contain-question' },
  aside: { label: 'Aside', colorVar: '--studio-contain-aside' },
  raw: { label: 'Raw Material', colorVar: '--studio-contain-raw' },
};

export default function ContainBlockView(props: NodeViewProps) {
  const { node, editor, getPos } = props;
  const containType = (node.attrs.containType as ContainType) || 'observation';
  const meta = CONTAIN_META[containType] ?? CONTAIN_META.observation;

  const handleDissolve = () => {
    const pos = getPos();
    if (typeof pos === 'number') {
      editor.chain().focus(pos + 1).unsetContainBlock().run();
    }
  };

  return (
    <NodeViewWrapper
      className="studio-contain-block"
      data-contain-type={containType}
    >
      <div className="studio-contain-header" contentEditable={false}>
        <span className="studio-contain-badge">{meta.label}</span>
        <button
          type="button"
          className="studio-contain-dissolve"
          onClick={handleDissolve}
          title="Remove container, keep content"
        >
          dissolve
        </button>
      </div>
      <NodeViewContent className="studio-contain-content" />
    </NodeViewWrapper>
  );
}
```

### File: `src/styles/studio.css` (MODIFY)

Append contain block custom properties inside the existing `.studio-theme { }` block:

```css
  /* Contain block semantic colors */
  --studio-contain-observation: #3A8A9A;
  --studio-contain-argument: #B45A2D;
  --studio-contain-evidence: #D4AA4A;
  --studio-contain-question: #8A6A9A;
  --studio-contain-aside: #6A9A5A;
  --studio-contain-raw: #7A7268;
```

Append contain block styles at end of file:

```css
/* ── Contain Block ────────────────────────────── */

.studio-contain-block {
  --contain-color: var(--studio-contain-observation);
  margin: 20px 0;
  padding: 14px 16px 12px;
  border-radius: 8px;
  border-left: 3px solid var(--contain-color);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--contain-color) 25%, transparent);
  background-color: color-mix(in srgb, var(--contain-color) 5%, transparent);
  position: relative;
}

.studio-contain-block[data-contain-type="observation"] { --contain-color: var(--studio-contain-observation); }
.studio-contain-block[data-contain-type="argument"]    { --contain-color: var(--studio-contain-argument); }
.studio-contain-block[data-contain-type="evidence"]    { --contain-color: var(--studio-contain-evidence); }
.studio-contain-block[data-contain-type="question"]    { --contain-color: var(--studio-contain-question); }
.studio-contain-block[data-contain-type="aside"]       { --contain-color: var(--studio-contain-aside); }
.studio-contain-block[data-contain-type="raw"]         { --contain-color: var(--studio-contain-raw); }

.studio-contain-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
  user-select: none;
}

.studio-contain-badge {
  font-family: var(--studio-font-mono);
  font-size: 8.5px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--contain-color);
  padding: 2px 7px;
  border-radius: 3px;
  background-color: color-mix(in srgb, var(--contain-color) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--contain-color) 30%, transparent);
}

.studio-contain-dissolve {
  margin-left: auto;
  background: none;
  border: none;
  color: var(--studio-writing-paper-muted);
  cursor: pointer;
  font-family: var(--studio-font-mono);
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 3px;
  transition: color 0.1s ease;
}

.studio-contain-dissolve:hover {
  color: var(--studio-writing-paper-text);
}
```

### File: `src/components/studio/TiptapEditor.tsx` (MODIFY)

Add ContainBlock to the extensions array:

```typescript
import ContainBlock from './extensions/ContainBlock';

// Inside useEditor extensions array, after TaskItem:
ContainBlock,
```

### Verification

- [ ] ContainBlock renders inside the Tiptap editor with correct color and label.
- [ ] Dissolve button removes the wrapper, keeps the content inline.
- [ ] ContainBlock content is editable (cursor enters, text can be typed).
- [ ] Multiple ContainBlock types render with different colors.
- [ ] `npm run build` passes.

---

## Batch 1: Right-Click Context Menu

### Problem

The Stash and Contain actions need to be accessible via right-click on selected text, not a toolbar button.

### File: `src/components/studio/EditorContextMenu.tsx` (NEW)

Create a context menu component that:
- Listens for `contextmenu` events on the Tiptap editor DOM
- Only appears when text is selected
- Shows "Stash for Later" action (with &#x21E7;&#x2318;S shortcut hint)
- Shows "Contain as..." submenu with all 6 contain types, each with a color dot
- Closes on click outside, Escape, or action completion

Props:
- `editor: Editor` (Tiptap editor instance)
- `onStash: (text: string) => void`

Stash action: extract selected text via `editor.state.doc.textBetween(from, to, '\n')`, then `editor.chain().focus().deleteSelection().run()`, then call `onStash(text)`.

Contain action: call `editor.chain().focus().setContainBlock({ containType }).run()`.

### File: `src/styles/studio.css` (APPEND)

Add context menu styles:
- `.studio-context-menu`: fixed position, min-width 200px, padding 5px, border-radius 10px, bg `var(--studio-writing-paper-bg)`, border `var(--studio-writing-paper-border)`, shadow, animate in with `studio-menu-in` keyframes
- `.studio-context-item`: flex row, gap 10px, full width, padding 8px 12px, border-radius 7px, hover bg `rgba(180,90,45,0.06)`
- `.studio-context-icon-stash`: color teal
- `.studio-context-divider`: 1px separator
- `.studio-context-section-label`: mono 8px, uppercase, "Contain as..."
- `.studio-context-color-dot`: 10px square, 2px border radius, 2px border

Add `@keyframes studio-menu-in` (scale 0.97 + translateY -2px to normal, 0.12s ease-out).

### File: `src/components/studio/Editor.tsx` (MODIFY)

1. Import EditorContextMenu.
2. Add `stash` state array and `handleStash` callback.
3. Render EditorContextMenu after TiptapEditor, passing editor and onStash.
4. Add Cmd+Shift+S keyboard shortcut for stashing.
5. Extend WorkbenchEditorState in WorkbenchContext.tsx to include stash array.
6. Pass stash state through setEditorState.

### Verification

- [ ] Right-clicking selected text shows the custom context menu.
- [ ] Right-clicking with no selection does NOT show the menu.
- [ ] "Stash for Later" removes text and adds to stash.
- [ ] "Contain as..." wraps text in the appropriate ContainBlock.
- [ ] Cmd+Shift+S stashes selected text.
- [ ] Menu closes on click outside, Escape, or action.
- [ ] `npm run build` passes.

---

## Batch 2: Wiki-Link Extension (`[[` Trigger)

### Problem

Writers need to link to Commonplace entries while writing, using `[[` as a trigger.

### File: `src/components/studio/extensions/WikiLink.tsx` (NEW)

Tiptap Mark extension. Renders `[[Title]]` text with class `studio-wiki-link`. Attributes: `title` (string). ParseHTML: `span[data-wiki-link]`. Non-inclusive, excludes `_`.

### File: `src/components/studio/extensions/WikiLinkSuggestion.tsx` (NEW)

Tiptap Extension with a custom ProseMirror plugin that:
- Detects `[[` as a two-character trigger via `handleTextInput`
- Tracks the trigger position
- Calls `onOpen(query, from, to)` to open the popup
- Calls `onUpdate(query)` on each keystroke while active
- Calls `onClose()` on Escape or when text moves before trigger position
- Does NOT handle rendering; that is delegated to WikiLinkPopup

### File: `src/components/studio/WikiLinkPopup.tsx` (NEW)

React component positioned near the cursor. Receives `items`, `query`, `position`, `onSelect`, `onClose`. Shows filtered Commonplace entries. Arrow key navigation, Enter to select. Styled with `.studio-wiki-popup` classes.

### File: `src/styles/studio.css` (APPEND)

- `.studio-wiki-link`: color teal, font-weight 500, dashed underline in teal at 40% opacity, solid on hover
- `.studio-wiki-popup`: fixed, z-200, 360px wide, max-height 320px, dark surface bg, strong border, rounded 10px, shadow
- `.studio-wiki-popup-header`: mono 9px, uppercase, teal query highlight
- `.studio-wiki-popup-item`: full width button, hover bg surfaceHover, title in Vollkorn 13px, preview text in Cabin 11px, source in mono 9px teal

### File: `src/components/studio/TiptapEditor.tsx` (MODIFY)

1. Import WikiLink, WikiLinkSuggestion, WikiLinkPopup.
2. Add popup state management.
3. Add WikiLink and WikiLinkSuggestion to extensions.
4. Render WikiLinkPopup conditionally.
5. On selection: delete `[[query` text, insert `[[Title]]` with WikiLink mark.

### File: `src/lib/studio-mock-data.ts` (MODIFY)

Add `getMockCommonplaceEntries()` returning 6 entries with id, title, source, text fields.

### Verification

- [ ] Typing `[[` opens the wiki-link popup.
- [ ] Popup filters as you type after `[[`.
- [ ] Arrow keys + Enter for keyboard selection.
- [ ] Selected item inserts `[[Title]]` with teal styling.
- [ ] Escape closes popup.
- [ ] `npm run build` passes.

---

## Batch 3: Research Panel in WorkbenchPanel

### Problem

The right sidebar's editor mode only shows Outline and Notes. It needs a Research tab.

### File: `src/components/studio/WorkbenchPanel.tsx` (MODIFY)

Change editor mode tabs from `['outline', 'notes']` to `['research', 'outline', 'stash']`.

**Research tab contents** (five sections, all using mock data for now):
1. Sources: list of source cards with type badge, title, creator, role, left border accent. Plus "+ Add source" button.
2. Connected Content: backlink cards with type dot, title, shared source count.
3. Commonplace Links: parse editor content for `[[...]]` patterns, show matched entries with teal styling.
4. Active Thread: thread title, status, timeline entries with typed colored dots.
5. Next Steps: content item nextMove in terracotta card with action buttons.

**Stash tab**: render stash items from WorkbenchEditorState. Each shows quoted text, timestamp, Restore button, Delete button.

### File: `src/lib/studio-mock-data.ts` (MODIFY)

Add mock data functions: `getMockSourcesForContent()`, `getMockBacklinksForContent()`, `getMockThreadForContent()`.

### Verification

- [ ] Three tabs in editor mode: Research, Outline, Stash.
- [ ] All five Research sections render with mock data.
- [ ] Stash tab shows items, Restore inserts at cursor, Delete removes.
- [ ] Dashboard mode still works (no regression).
- [ ] `npm run build` passes.

---

## Batch 4: Visual Polish

### File: `src/styles/studio.css` (MODIFY)

1. Increase sidebar grid opacity: `.studio-sidebar-grid::before` opacity to 0.04
2. Increase workbench grid opacity: `.studio-workbench-grid::before` opacity to 0.03
3. Add page card left margin line: `.studio-page::before` with 1px line at left 51px, `rgba(180,90,45,0.08)`
4. Add focused page glow: `.studio-editor-shell[data-writing-focused="true"] .studio-page` with extra `0 0 0 1px rgba(180,90,45,0.08)` shadow
5. Change `--studio-toolbar-bg` from `#EEE3D7` to `#E8DDD0`
6. Reduce `.studio-stage-stepper` gap from 10px to 6px

### File: `src/components/studio/WordCountBand.tsx` (MODIFY)

Add wiki-link count and contain block count by traversing the editor document:
- Count `[[...]]` patterns in text content for link count
- Count `containBlock` nodes for contain count
- Display in teal and gold respectively, only when > 0

### Verification

- [ ] Blueprint textures visible on sidebar and workbench.
- [ ] Page card has left margin line.
- [ ] Page card glows on focus.
- [ ] Toolbar is warmer.
- [ ] Stage stepper is more compact.
- [ ] Word count band shows link and contain counts.
- [ ] `npm run build` passes.

---

## Build Order Summary

```
Batch 0: ContainBlock Tiptap extension (NodeView)
Batch 1: Right-click context menu (Stash + Contain actions)
Batch 2: Wiki-link extension ([[ trigger + popup)
Batch 3: Research panel in WorkbenchPanel (3-tab layout)
Batch 4: Visual polish (textures, margins, glow, counts)
```

Run `npm run build` after EACH batch. Do not proceed to the next batch if the build fails.

---

## Future Batches (not in this spec)

- **Research API integration**: Replace mock data with live calls to research_api endpoints
- **Commonplace search API**: Wire wiki-link popup to a live search endpoint
- **Stash persistence**: Save stash items to Django backend
- **ContainBlock type cycling**: Right-click a contained block to change its type
- **ContainBlock in markdown export**: Custom serializer for fenced contain blocks
