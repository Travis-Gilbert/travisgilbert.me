# Studio v4.2: Remaining Future Enhancements

> **For Claude Code.** Depends on all prior specs (v3 through v4.1).
> No em dashes. Run `npm run build` after each batch.

## Eight batches covering every deferred enhancement from v3 through v4.1:

```
Batch 0: Image resize handles (ResizableImage NodeView with corner drag + left/center/right alignment bar)
Batch 1: Mention hover preview (300ms delay tooltip showing type dot, title, excerpt on @mention hover)
Batch 2: Mention backlinks (EditorMention Django model, extract mentions on save, "Mentioned In" Research panel section)
Batch 3: Collage preview in editor (insert generated hero image inline via ResizableImage)
Batch 4: AI writing commands (Next.js /api/ai/transform route proxying to Anthropic, scriptwriter voice rules in system prompt, loading placeholder)
Batch 5: Custom input rules ({v: description} to {VISUAL:}, [ns] to [NEEDS SOURCE], [q: text] to [QUESTION:], symbol shortcodes)
Batch 6: D3 chart gallery (ChartPickerPopup with iframe previews, registry in studio-charts.ts)
Batch 7: Block drag handles with real DnD (NodeSelection on handle mousedown, ProseMirror native drag, drop indicator)
```

## Key decisions:

- Image resize uses the same drag pattern as iframe resize (consistent UX)
- Mention backlinks are a new Django model (EditorMention), synced on every save, not a computed query
- AI commands use Claude Sonnet 4 with the scriptwriter skill's voice rules baked into the system prompt, including the em-dash ban
- Custom input rules use Travis's actual shorthand: {v:} for visual directions, [ns] for needs-source, [q:] for questions
- Chart gallery reads from a static registry (studio-charts.ts) rather than filesystem scanning
- Block DnD leverages ProseMirror's native NodeSelection + draggable behavior

Full spec with all code, models, CSS, and verification checklists in the downloadable STUDIO_V4_2_SPEC.md.
