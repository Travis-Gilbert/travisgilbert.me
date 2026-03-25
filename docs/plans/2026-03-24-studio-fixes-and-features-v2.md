# Studio Fixes and Features Spec (v2)

## 2026-03-24

Repo: Travis-Gilbert/travisgilbert.me
Stack: Next.js 16.1.6, React 19.2.4, Tailwind v4, Turbopack
Backend: Django publishing API on Railway (Bearer token auth)

---

## Batch 1: Critical Bugs + Sheets Redesign

### 1A. Sheets Feature: Full Redesign

Two problems found:

1. No entry point exists. SheetList only renders when isSheetsMode is true, which requires sheets.length > 0. No UI to create the first sheet.

2. No content bridge. Clicking a sheet calls setActiveSheetId() but nobody saves the current sheet or loads the target sheet body into TiptapEditor.

Revised design: Sheets as sidebar toggle. When active, entire left sidebar transforms into sheet navigation panel.

State flow:
- User clicks Sheets in stage bar
- No sheets exist: create first sheet from current editor content, set sheetsMode true
- Sheets exist: toggle sheetsMode (sidebar swaps)
- Sidebar shows: back to nav link, sheet list with drag/status/wordcount/delete, add button, total count, compile button

Files: StudioLayout.tsx (sheetsMode state), StudioSidebar.tsx (conditional render), SheetList.tsx (fullPanel prop), StageStepper.tsx (Sheets toggle button), Editor.tsx (content bridge: saveCurrentSheet, handleSetActiveSheet, handleToggleSheets, handleAddSheet, handleDeleteSheet, sheet-aware autosave, initial load), WorkbenchContext.tsx (wire handlers), studio.css (new classes)

### 1B. Markdown Renders as Raw Text on Refresh

Root cause: Y.js seeding calls editor.commands.setContent(initialContent) which defaults to HTML parsing. Markdown becomes plain text.

Fix: In Y.js seeding effect in Editor.tsx, parse markdown through tiptap/markdown extension parser.

### 1C. Sidebar Does Not Reach Bottom

Fix: Add height 100% to aside element in StudioSidebar.tsx.

---

## Batch 2: Light Mode + Connections Rename + Sheet Word Count Goals

### 2A. Light Mode Color Correction

CONFIRMED COLORS (Travis reviewed swatches):
- Background (--studio-bg): #DDD4C6 (cool parchment)
- Paper (--studio-writing-paper-bg): #D8C8B2 (warm amber)
- Desk bg matches canvas bg (eliminates white perimeter)
- Temperature shift creates figure-ground separation (warm paper on cool bg)
- Shadow adds lift

File: src/styles/studio.css

Replace light mode tokens and writing surface overrides. Add .studio-page shadow in light mode.

### 2B. Section Labels Invisible on Light Content Area

File: src/styles/studio.css

Add .studio-theme-light .studio-section-label color override to rgba(42, 36, 32, 0.35).

### 2C. Rename Links Tab to Connections

File: src/components/studio/WorkbenchPanel.tsx line 129

Change label from Links to Connections. Internal key stays links.

### 2D. Sheet Word Count Goals with Progress Bars

Each sheet gets optional wordCountTarget field. When set, 2px progress bar renders below sheet title. Click word count to set target via inline input. Footer shows aggregate progress.

Changes needed:
- src/lib/studio-api.ts: add wordCountTarget to Sheet interface, createSheet opts, updateSheet payload
- src/components/studio/SheetList.tsx: progress bar, inline target editor
- src/components/studio/WorkbenchContext.tsx: add onUpdateSheetTarget callback
- src/components/studio/Editor.tsx: handleUpdateSheetTarget handler
- src/styles/studio.css: .studio-sheet-progress, .studio-sheet-progress-fill, .studio-sheet-target-input classes
- Django backend: add word_count_target IntegerField(null=True) to Sheet model + migration

---

## Batch 3: Features

### 3A. Delete Button with Custom Confirmation Modal
### 3B. Context-Aware New Button on Content Pages
### 3C. Empty State with CTA

## Batch 4: Cleanup

### 4A. Remove phosphor-icons/react from package.json
### 4B. README Page at /studio/readme

## Build Gate

npm run build after each batch.
