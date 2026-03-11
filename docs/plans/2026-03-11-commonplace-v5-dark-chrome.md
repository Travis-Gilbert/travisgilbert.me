# CommonPlace v5: Dark Chrome Instrument Redesign

> **For Claude Code. One batch per session. Read entire spec before writing code.**
> **Read every file listed under "Read first" before writing a single line.**
> **Run `npm run build` after every batch. Do not proceed if the build fails.**

---

## Architecture Summary

CommonPlace is migrating from a warm-studio aesthetic to a **Dark Chrome Instrument** design language. The shell uses graphite chrome (#1C1C20), content surfaces use vellum (#F4F3F0), and engine signals use red pencil (#C4503C). All machine-generated surfaces render in JetBrains Mono on dark terminal backgrounds.

The app structure changes:
1. **Library** replaces the default landing (anti-inbox, self-organizing home)
2. **Compose** gets a bottom engine terminal and right-side toolkit panel
3. **Sidebar** collapses to icon rail in Compose mode
4. **Context menu** provides right-click actions on all objects (Stash, Connect, Contain)
5. **Polymorphic object renderers** replace the generic NodeCard
6. **Cluster cards** and **lineage swimlanes** become first-class surfaces

### Key Design Decisions

- **Typography**: Vollkorn (titles), IBM Plex Sans (body/UI), JetBrains Mono (metadata/engine/terminal)
- **Font features**: All fonts use `font-kerning: normal` and explicit `font-feature-settings` for ligatures
- **No em dashes** anywhere in code, comments, or copy
- **Terminal is always dark** (#1A1C22) regardless of anything else
- **Engine = JetBrains Mono**: Any surface showing machine output uses JetBrains Mono
- **User content = Vollkorn/IBM Plex**: Any surface showing user-created content uses the editorial stack
- **Terminal surfaces use canvas** with a subtle mulberry32 seeded dot pattern and teal gradient accent

### UI Libraries

| Library | Purpose | Install |
|---------|---------|---------|
| cmdk | Command palette (Cmd+K) | `npm i cmdk` |
| vaul | Bottom drawer for mobile + stash panel | `npm i vaul` |
| sonner | Toast notifications (already installed) | -- |
| @floating-ui/react | Tooltips, popovers, context menu positioning | `npm i @floating-ui/react` |
| @iconoir/react | Icon system (replaces inline SVG paths) | `npm i @iconoir/react` |

---

## Build Order Summary

```
Batch 0: Font installation (IBM Plex Sans, font-feature-settings)
Batch 1: Color token migration (chrome palette, construction grid, glow)
Batch 2: Polymorphic object renderers (10 type-specific components)
Batch 3: Terminal block component (canvas background, mulberry32 dots, teal gradient)
Batch 4: Library module (anti-inbox home, clusters, lineage, resume)
Batch 5: Compose engine terminal (collapsible bottom panel, tension, gaps)
Batch 6: Sidebar collapse (icon rail mode for compose)
Batch 7: Context menu (right-click: stash, connect, contain)
Batch 8: Dot field background (canvas, remove CSS dot fields)
Batch 9: Cluster + lineage API integration
```

Full implementation details in COMMONPLACE-V5-CLAUDE-CODE.md (local spec).
