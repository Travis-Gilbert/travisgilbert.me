# Studio Editor v3.1: Slash Commands, Embeds, and Stash Tasks

> **For Claude Code.** Read this entire document before touching any files.
> No em dashes anywhere. Use colons, semicolons, commas, or periods instead.
> Run `npm run build` after each batch to verify zero errors before proceeding.
> **Depends on:** v3 spec (`docs/plans/2026-03-05-studio-editor-v3.md`). All v3 batches must be complete before starting this spec.

## Overview

Three features that extend the v3 editor:

1. **Slash commands (`/`)**: Notion-style command palette triggered by typing `/`. Inserts headings, lists, blocks, contain blocks, embeds, and more.
2. **Iframe embed extension**: A Tiptap node for embedding D3 visualizations, Observable notebooks, and self-hosted chart pages with resize handles.
3. **Stash tasks**: To-do items in the Stash panel attached to the current content item, creatable via right-click context menu.

## Dependencies

```bash
npm install @tiptap/suggestion@^3.20.0
```

If already installed from v3, skip. No other new packages needed.

---

## Batch 0: Slash Command Extension

Uses `@tiptap/suggestion` with `char: '/'`. New files:
- `src/components/studio/extensions/SlashCommand.tsx`: Extension using Suggestion plugin with `/` trigger
- `src/components/studio/extensions/slashCommandItems.ts`: Command definitions grouped by section (Basic, Lists, Blocks, Contain, Embeds)
- `src/components/studio/SlashCommandPopup.tsx`: Grouped popup with keyboard navigation
- CSS: `.studio-slash-popup`, `.studio-slash-item`, `.studio-slash-icon` classes

Commands include: Text, H1-H3, Bullet/Numbered/Task List, Blockquote, Code Block, Divider, Table, Observation/Argument/Evidence/Question (contain blocks), Embed, Image.

## Batch 1: Iframe Embed Extension

Tiptap atom node with React NodeView. New files:
- `src/components/studio/extensions/IframeEmbed.tsx`: Node extension with src, height attributes, sandbox security
- `src/components/studio/extensions/IframeEmbedView.tsx`: React NodeView with domain badge, drag-to-resize handle
- CSS: `.studio-iframe-wrapper`, `.studio-iframe-header`, `.studio-iframe-resize` classes

Auto-normalizes Observable URLs (page URL to embed URL). Supports self-hosted D3 charts at `/embed/` routes. Sandbox attribute for security.

## Batch 2: Stash Tasks

To-do items in the Stash panel. Modifies:
- `WorkbenchPanel.tsx`: Tasks section above Saved for Later with checkbox list, add input, completed toggle
- `EditorContextMenu.tsx`: "Add Task" item (creates task from selection WITHOUT removing text)
- `WorkbenchContext.tsx`: Extended with tasks array, onAddTask, onToggleTask, onDeleteTask
- `Editor.tsx`: Task state management
- CSS: `.studio-task-input`, `.studio-task-checkbox`, `.studio-task-item` classes

## Build Order

```
Batch 0: Slash commands (/ trigger + command palette)
Batch 1: Iframe embeds (D3 / Observable / any URL)
Batch 2: Stash tasks (to-do items + context menu integration)
```

See the full spec at the committed markdown file for complete implementation details including all code examples, CSS, and verification checklists.
