# Studio v4.2: Future Enhancements + Extended Font Options

> **For Claude Code.** Depends on v3 through v4.1 specs.
> No em dashes. Run `npm run build` after each batch.

## Six batches:

```
Batch 0: Extended writing surface fonts (Caudex, IBM Plex Sans, Cabin as distinct presets in Reading Settings)
Batch 1: Image resize handles (ResizableImage NodeView with drag-to-resize)
Batch 2: Collage preview insertion (insert generated collage image into editor)
Batch 3: Mention hover preview (tooltip card on @mention hover with excerpt, stage, word count)
Batch 4: Mention backlinks (ContentMention Django model, parse @mentions on save, Research panel "Mentioned In" section)
Batch 5: Slash command refinements (/link polish, /chart visual gallery picker with thumbnail previews)
```

## Key decisions:

- Caudex loaded via next/font as --font-caudex, positioned as the "Archivist" preset for historical/archival content
- Six font presets total: Amarna (writing serif), Caudex (academic serif), Cabin (humanist sans), IBM Plex Sans (clinical sans), System (default sans), Mono (JetBrains Mono)
- Each preset button in Reading Settings shows a sample in the actual font
- Image resize uses a React NodeView extending @tiptap/extension-image, width attribute persists in document
- ContentMention model tracks @mention relationships across documents, synced on save by parsing data-mention-id attributes
- Chart picker shows live iframe preview thumbnails of available self-hosted D3 charts

Full spec with code, CSS, Django models, and verification checklists in the downloadable STUDIO_V4_2_SPEC.md.
