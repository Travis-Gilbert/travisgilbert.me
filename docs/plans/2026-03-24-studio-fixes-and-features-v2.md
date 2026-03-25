# Studio Fixes and Features Spec (v2)

## 2026-03-24

Repo: Travis-Gilbert/travisgilbert.me
Stack: Next.js 16.1.6, React 19.2.4, Tailwind v4, Turbopack
Backend: Django publishing API on Railway (Bearer token auth)

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

## Batch 2: Design Fixes (Light Mode)

### 2A. White Perimeter Around Writing Surface

Make desk bg match page bg. Paper lifts via shadow.

### 2B. Light Mode Background Too Bright

Darken canvas from F5E6D2 to E8D8C4. Add page shadow.

### 2C. Section Labels Invisible on Light Content Area

Add light mode override for studio-section-label color.

## Batch 3: Features

### 3A. Delete Button with Custom Confirmation Modal

New DeleteConfirmModal component matching Studio design.

### 3B. Context-Aware New Button on Content Pages

Add New button to ContentList that creates content of current type directly.

### 3C. Empty State with CTA

Replace bare text with dashed border container and create button.

## Batch 4: Cleanup

### 4A. Remove phosphor-icons/react from package.json

### 4B. README Page at /studio/readme

## Build Gate

npm run build after each batch.
