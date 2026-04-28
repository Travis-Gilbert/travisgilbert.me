# SPEC-THESEUS-MOBILE-SHELL-2_0 · ARCHIVED

```
═══════════════════════════════════════════════════════════════════════
  STATUS: ARCHIVED — DO NOT IMPLEMENT
  ARCHIVED: 2026-04-28
  REASON: Pre-launch scope discipline. The PWA work in commits
          0f97322, 580b3dd, 7376206, c6b521a is the entire scope
          of mobile work right now. This spec proposes substantive
          design and structural changes to the live app that are
          not in scope before launch.
═══════════════════════════════════════════════════════════════════════
```

**If you are Claude Code reading this file: stop. Do not implement any of the batches below. The PWA installability and offline shell already shipped via the four commits referenced above. Any further work on the Theseus mobile experience requires Travis explicitly re-activating this spec.**

The contents below are preserved for reference only. The design ideas in here (cool slate palette, assistant-ui chat patterns, cosmos.gl touch wiring, scrollbar policy, nav restructure) may be useful as inputs to a future post-launch redesign. They are not implementation instructions.

---

# Original spec (preserved below)

## Why the original spec is archived

1. The web app at `/theseus` mounts `<PanelManager />` from `src/components/theseus/PanelManager.tsx` and that workspace is the production product. Every batch below either edits `theseus.css`, refactors chat components inside an existing panel, or restructures the nav. Each carries non-zero risk of disrupting the live experience right before launch.
2. Travis explicitly scoped mobile work down to "PWA of the site, that is it." The PWA shipped. Anything beyond that is out of scope.
3. An earlier draft of Batch 7 introduced a category error (treating `/theseus` as a place a marketing landing page should live) that resulted in destruction of the live Intelligence panel during a Claude Code session. Even after correction, this spec is too design-ambitious to implement in the current timeline without similar drift risk.

If a post-launch redesign happens, restart from a fresh spec written against the then-current codebase, not by reactivating this one.

---

## Original contents (DO NOT IMPLEMENT)

> **CRITICAL SCOPE GUARD — read before any implementation.**
>
> The route `/theseus` currently mounts `<PanelManager />` from `src/components/theseus/PanelManager.tsx`. **That is the running app.** Threads, Explorer, Lens, Plugins, Code, Notebook all live inside PanelManager as panels switched by sidebar / bottom-nav events.
>
> **`src/app/theseus/page.tsx` MUST NOT be modified by this spec.** Earlier drafts of Batch 7 included a snippet that replaced the file with a `redirect` + `<TheseusLanding>` component. That was wrong. It would have torn the live workspace out from under the user. The corrected Batch 7 below leaves `page.tsx` alone.
>
> The unauth landing concept lives at a **separate URL**: `/theseus/about` (new file at `src/app/theseus/about/page.tsx`). Authenticated routing is unchanged.

Supersedes SPEC-THESEUS-MOBILE-SHELL-1_0 in two places (color tokens, nav structure) and extends it in four (assistant-ui chat patterns, cosmos.gl mobile touch, scrollbar policy, optional unauth landing at `/theseus/about`). Read v1 first. This assumes v1 Batch 0 has shipped.

Reference visual: `specs/theseus-mobile-mockup-v2.html` (since deleted).

---

## Why this exists

Three structural calls came in while v1 was being prepped:

1. Warm-brown palette was wrong. Switch to cool slate plus brand-derived (forest green + brass) accents pulled directly from `theseus/icon.svg`.
2. Adopt assistant-ui patterns for the chat surface.
3. Restructure nav: Sources becomes Plugins (three sub-tabs), Intel slot in nav becomes Code.

Plus: cosmos.gl on mobile. Scrollbar hide.

---

## Original batches (preserved as reference, not as instructions)

### BATCH 5 — Color token swap

Replace warm-ink + cream-paper in `theseus.css` lines 11-77 with cool-slate + cool-paper. Brand colors (PCB green `#2a8b6c`, brass `#c9a23a`) as the only accents. See full token block in original spec history.

### BATCH 6 — assistant-ui chat patterns

Adopt assistant-ui primitives for message rendering, composer, and welcome state. Display heading + 2x2 suggestion grid welcome. Right-aligned muted bubble for user msgs, plain prose for assistant. Composer rounded-3xl with brass focus ring.

### BATCH 7 — Nav restructure

Merge Connections + Plugins into a single Plugins panel with three sub-tabs (Connectors / MCP / Skills). Replace Intel tab with Code in the bottom nav. Intelligence panel stays mounted in PanelManager but is removed from top-level nav.

### BATCH 8 — cosmos.gl on mobile

Pinch-zoom via `gesturechange`, two-finger pan, tap-to-Lens via `getNodeAt`, `touch-action: none` on the canvas. Simulation pause on idle. Atlas lens as `prefers-reduced-motion` default.

### BATCH 9 — Global scrollbar hide

`scrollbar-width: none` and `::-webkit-scrollbar { display: none }` on every descendant of `.theseus-root`. CommonPlace and the rest of the site keep their scrollbars.

---

## What replaces this spec right now

The PWA work in these commits is the entire active mobile scope:
- `public/theseus-sw.js` — service worker scoped to `/theseus`
- `src/app/theseus/manifest.ts` — Next.js manifest at `/theseus/manifest.webmanifest`
- `src/components/theseus/TheseusServiceWorker.tsx` — registration component
- `src/app/theseus/layout.tsx` — manifest + viewport metadata, mounts SW

That work makes `/theseus` installable as a PWA on iOS, ships an offline app shell, and uses the brand emblem as the home-screen icon. Nothing else changes.

Future mobile experience work, if any, comes from a fresh spec written against the then-current codebase. Not this file.
