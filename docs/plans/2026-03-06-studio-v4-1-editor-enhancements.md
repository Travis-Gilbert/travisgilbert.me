# Studio v4.1: Syntax Highlighting, Image Upload, Collage Workflow, @Mentions

> **For Claude Code.** Depends on v3, v3.1, v3.2, v4 specs.
> No em dashes. Run `npm run build` after each batch.

## Five batches:

```
Batch 0: Syntax-highlighted code blocks (CodeBlockLowlight + React NodeView with language picker + copy button)
Batch 1: Image upload (drag-and-drop + paste via ProseMirror plugin, Django upload endpoint, 10MB limit)
Batch 2: Collage engine workflow (Django endpoint wrapping collage_engine.py, cutout picker, preview panel in WorkbenchPanel)
Batch 3: @Mentions (Tiptap Mention extension with @ trigger, content search API across all types, type-colored chips)
Batch 4: Clever editor (Typography with em-dash disabled, ColorHighlighter for inline hex swatches)
```

## New dependencies:

```bash
npm install @tiptap/extension-mention@^3.20.0 lowlight@^3.0.0 highlight.js@^11.0.0 @tiptap/extension-code-block-lowlight@^3.20.0
```

## Key decisions:

- Code blocks use a warm dark theme (#2A2420 bg) matching the Studio brand palette, not a default highlight.js theme
- Image upload goes to Django backend (publishing_api/media/editor/), not a third-party CDN
- Collage engine runs server-side on Railway via a Django view that imports collage_engine.compose()
- @Mentions use official @tiptap/extension-mention with a unified content search endpoint querying all 5 content types
- Typography extension explicitly disables em-dash conversion (emDash: false) per Travis's typographic preference
- ColorHighlighter uses ProseMirror decorations (widget after hex code), not marks, so it doesn't affect document content

Full spec with all code, CSS, Django views, and verification checklists in the downloadable STUDIO_V4_1_SPEC.md.
