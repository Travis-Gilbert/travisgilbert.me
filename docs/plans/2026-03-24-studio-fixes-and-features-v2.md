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

---

## Batch 2: Light Mode + Connections Rename + Sheet Word Count Goals

### 2A. Light Mode Color Correction

CONFIRMED COLORS (Travis reviewed swatches):
- Background (--studio-bg): #DDD4C6 (cool parchment)
- Paper (--studio-writing-paper-bg): #D8C8B2 (warm amber)
- Paper sits DARKER and WARMER on a cooler, slightly lighter background
- Temperature shift creates figure-ground separation
- Shadow adds lift

Current problem: desk bg (#EDE7DF) is lighter than paper (#E4D9CC), creating a white halo perimeter.

#### File: src/styles/studio.css

Replace the light mode token overrides:

```css
.studio-theme-light {
  --studio-bg: #DDD4C6;
  --studio-surface: #E8E0D4;
  --studio-surface-hover: #DFD6C8;
  --studio-surface-raised: #E8E0D4;

  /* Text, accents, stages, borders, shadows unchanged from current values */
}
```

Replace the writing surface overrides:

```css
.studio-theme-light .studio-writing-surface {
  --studio-desk-bg: var(--studio-bg);
  --studio-writing-paper-bg: #D8C8B2;
  --studio-writing-paper-shadow:
    0 2px 12px rgba(42, 36, 32, 0.1),
    0 0 0 1px rgba(42, 36, 32, 0.04);

  background-color: var(--studio-desk-bg);
  background-image: none;
}
```

Add page shadow for the editor paper:

```css
.studio-theme-light .studio-page {
  box-shadow:
    0 2px 12px rgba(42, 36, 32, 0.1),
    0 0 0 1px rgba(42, 36, 32, 0.04);
  border-radius: 2px;
}
```

### 2B. Section Labels Invisible on Light Content Area

Current .studio-section-label uses color: rgba(237, 231, 220, 0.38) which is cream-on-cream in light mode.

#### File: src/styles/studio.css

Add:

```css
.studio-theme-light .studio-section-label {
  color: rgba(42, 36, 32, 0.35);
}
```

### 2C. Rename "Links" Tab to "Connections"

One-line change.

#### File: src/components/studio/WorkbenchPanel.tsx

In the TAB_CONFIG constant, change:

```typescript
// FROM:
links: { Icon: LinkIcon, label: 'Links' },

// TO:
links: { Icon: LinkIcon, label: 'Connections' },
```

The key stays `links` (no route or state changes needed). Only the display label changes.

### 2D. Sheet Word Count Goals with Progress Bars

Each sheet gets an optional word count target. When set, a thin progress bar appears under the sheet title in the sidebar sheet list. This gives writers a visual sense of how far each section is from its goal.

#### Step 1: Extend the Sheet type

File: src/lib/studio-api.ts

Add wordCountTarget to the Sheet interface:

```typescript
export interface Sheet {
  id: string;
  contentType: string;
  contentSlug: string;
  order: number;
  title: string;
  body: string;
  isMaterial: boolean;
  status: 'idea' | 'drafting' | 'locked' | null;
  wordCount: number;
  wordCountTarget: number | null;  // NEW FIELD
  createdAt: string;
  updatedAt: string;
}
```

Update createSheet opts type to include wordCountTarget:

```typescript
export async function createSheet(
  contentType: string,
  slug: string,
  opts: Partial<Pick<Sheet, 'title' | 'body' | 'isMaterial' | 'status' | 'wordCountTarget'>> = {},
): Promise<Sheet | null> {
```

Update updateSheet payload type:

```typescript
export async function updateSheet(
  contentType: string,
  slug: string,
  id: string,
  payload: Partial<Pick<Sheet, 'title' | 'body' | 'order' | 'isMaterial' | 'status' | 'wordCountTarget'>>,
): Promise<Sheet | null> {
```

NOTE: Django backend needs a matching migration to add word_count_target IntegerField(null=True, blank=True) to the Sheet model. The API will return null for existing sheets until the migration runs.

#### Step 2: Add progress bar to SheetList

File: src/components/studio/SheetList.tsx

Inside each sheet item, after the word count display, add a progress bar when wordCountTarget is set:

```typescript
{sheet.wordCountTarget && sheet.wordCountTarget > 0 && (
  <div
    className="studio-sheet-progress"
    title={`${sheet.wordCount} / ${sheet.wordCountTarget} words`}
  >
    <div
      className="studio-sheet-progress-fill"
      style={{
        width: `${Math.min(100, (sheet.wordCount / sheet.wordCountTarget) * 100)}%`,
        backgroundColor: sheet.wordCount >= sheet.wordCountTarget
          ? 'var(--studio-green)'
          : 'var(--studio-tc)',
      }}
    />
  </div>
)}
```

#### Step 3: Add set-target interaction

When the user clicks the word count display on a sheet, show a small inline input to set the target. This avoids a modal for something this small.

```typescript
// State in SheetList:
const [editingTargetId, setEditingTargetId] = useState<string | null>(null);
const [targetInput, setTargetInput] = useState('');

// On word count click:
onClick={(e) => {
  e.stopPropagation();
  setEditingTargetId(sheet.id);
  setTargetInput(String(sheet.wordCountTarget ?? ''));
}}

// Inline input (replaces word count when editing):
{editingTargetId === sheet.id ? (
  <input
    type="number"
    className="studio-sheet-target-input"
    value={targetInput}
    onChange={(e) => setTargetInput(e.target.value)}
    onBlur={() => {
      const val = parseInt(targetInput, 10);
      if (!isNaN(val) && val > 0) {
        onUpdateSheetTarget?.(sheet.id, val);
      } else if (targetInput === '' || targetInput === '0') {
        onUpdateSheetTarget?.(sheet.id, null); // clear target
      }
      setEditingTargetId(null);
    }}
    onKeyDown={(e) => {
      if (e.key === 'Enter') e.currentTarget.blur();
      if (e.key === 'Escape') setEditingTargetId(null);
    }}
    autoFocus
    placeholder="Target"
  />
) : (
  <span className="studio-sheet-wordcount" onClick={handleClick}>
    {sheet.wordCount}w
    {sheet.wordCountTarget ? ` / ${sheet.wordCountTarget}` : ''}
  </span>
)}
```

#### Step 4: Wire the update callback

File: src/components/studio/WorkbenchContext.tsx

Add to WorkbenchEditorState:

```typescript
onUpdateSheetTarget?: (id: string, target: number | null) => void;
```

File: src/components/studio/Editor.tsx

Add handler:

```typescript
const handleUpdateSheetTarget = useCallback(async (sheetId: string, target: number | null) => {
  try {
    await updateSheet(normalizedContentType, slug, sheetId, {
      wordCountTarget: target,
    });
    setSheets(prev => prev.map(s =>
      s.id === sheetId ? { ...s, wordCountTarget: target } : s
    ));
  } catch {
    toast.error('Could not update target');
  }
}, [normalizedContentType, slug]);
```

Wire in the setEditorState call:

```typescript
onUpdateSheetTarget: handleUpdateSheetTarget,
```

#### Step 5: CSS for progress bar and target input

File: src/styles/studio.css

```css
.studio-sheet-progress {
  width: 100%;
  height: 2px;
  background: var(--studio-border);
  border-radius: 1px;
  margin-top: 4px;
  overflow: hidden;
}

.studio-sheet-progress-fill {
  height: 100%;
  border-radius: 1px;
  transition: width 0.3s ease, background-color 0.3s ease;
}

.studio-sheet-target-input {
  width: 56px;
  padding: 1px 4px;
  font-family: var(--studio-font-mono);
  font-size: 9px;
  color: var(--studio-text-bright);
  background: var(--studio-surface);
  border: 1px solid var(--studio-border-tc);
  border-radius: 2px;
  outline: none;
  text-align: right;
}

.studio-sheet-target-input:focus {
  border-color: var(--studio-tc);
}

/* Hide number input spinners */
.studio-sheet-target-input::-webkit-outer-spin-button,
.studio-sheet-target-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
```

#### Step 6: Sheet footer total with combined progress

When in fullPanel mode, the footer shows total word count. If any sheets have targets, also show combined progress:

```typescript
// In SheetsFooter component:
const totalWords = sheets.reduce((sum, s) => sum + s.wordCount, 0);
const totalTarget = sheets.reduce((sum, s) => sum + (s.wordCountTarget ?? 0), 0);

// Render:
<div className="studio-sheet-footer-stats">
  <span>Total: {totalWords.toLocaleString()} words</span>
  {totalTarget > 0 && (
    <span>{Math.round((totalWords / totalTarget) * 100)}% of target</span>
  )}
</div>
{totalTarget > 0 && (
  <div className="studio-sheet-progress" style={{ marginTop: 6 }}>
    <div
      className="studio-sheet-progress-fill"
      style={{
        width: `${Math.min(100, (totalWords / totalTarget) * 100)}%`,
        backgroundColor: totalWords >= totalTarget ? 'var(--studio-green)' : 'var(--studio-tc)',
      }}
    />
  </div>
)}
```

---

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

## Confirmed Design Decisions

- Light mode bg: #DDD4C6 (cool parchment)
- Light mode paper: #D8C8B2 (warm amber, darker than bg, temperature-shifted)
- Paper separation: box-shadow, not color gap
- Current dark mode paper (#E4D9CC) is NOT changed
- Delete confirmation: custom modal (Batch 3)
- Sheets sidebar: full sidebar replacement toggle (Batch 1)
- Links tab renamed to Connections (Batch 2)
- Sheet word count goals: per-sheet target with 2px progress bar, click-to-set (Batch 2)
- Django backend needs word_count_target migration on Sheet model
