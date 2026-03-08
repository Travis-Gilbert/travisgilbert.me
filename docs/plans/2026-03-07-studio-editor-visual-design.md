# Studio Editor: Visual Design Spec

> **For Claude Code.** This document covers visual identity, layout decisions, and
> design intent for the Studio editor view specifically.
> No em dashes anywhere in code, comments, or copy.
> This complements `STUDIO_OVERHAUL_CLAUDE_CODE.md` and `CLAUDE_2.md`.
> When these docs conflict on Studio-specific design, this document wins.

---

## The Design Concept

The Studio editor should read as a **field notebook on an archivist's desk**, not a
generic writing app. The brand is investigative journalism meets architectural precision.
Every design decision should reinforce that identity.

The correct mental model: a single aged-paper document resting on a warm dark desk,
under directional lamp light. The desk has texture and presence. The paper has weight
and personality. The surrounding tools (sidebar, workbench) are the desk itself.

**Wrong mental model:** dialog box floating over a dark screen. Never let the paper
feel like a modal or overlay.

---

## Layout Zones

```
[ Sidebar 232px ] [ Stage bar 46px tall, full width             ]
                  [ Desk surface: dot grid + warm ambient glow  ]
                  [   Stage progress strip (2px, stage-colored) ]
                  [   Paper surface: #E4D9CC                    ]
                  [     Title zone: 32px top padding            ]
                  [     Toolbar rail: inside paper              ]
                  [     Writing body: indented past margin rule ]
                  [     Word count band: inside paper bottom    ]
                  [ Workbench panel: collapsible, 272px default ]
```

### Sidebar (232px, fixed)
- Background: `#111210`
- Top-left terracotta bloom: `radial-gradient(ellipse 320px 260px at 32% 32%, rgba(180,90,45,0.18) 0%, rgba(180,90,45,0.06) 42%, transparent 75%)`
- Nav items: active state has `2px left border` in `#B45A2D` with glow `box-shadow: 0 0 10px rgba(180,90,45,0.7)`
- Section labels: JetBrains Mono 9px, 0.22em letter-spacing, `rgba(237,231,220,0.28)`, uppercase
- Badge counts: JetBrains Mono 9px, `rgba(180,90,45,0.18)` bg, `#D4743A` text

### Stage Bar (46px, spans center + workbench columns)
- Background: `rgba(20,17,13,0.95)` with `backdrop-filter: blur(8px)`
- Border bottom: `1px solid rgba(237,231,220,0.07)`
- Contains: content type chip, stage pipeline, Back/Advance/Publish buttons, save indicator

#### Stage Pipeline (the key piece)
Render all 6 stages as a horizontal flow with connecting lines. Do NOT just show a label.

```
[idea dot] -- [research dot] -- [DRAFTING chip] -- [revising dot] -- [production dot] -- [published dot]
```

- Past stages: colored dot at 50% opacity, no label, no border
- Current stage: colored dot + label text + colored background chip + glowing dot
- Future stages: `rgba(237,231,220,0.18)` dot, no label
- Connecting lines: 16px wide, `rgba(180,90,45,0.4)` for past segments, `rgba(237,231,220,0.1)` for future
- Stage colors (do not change these):
  - idea: `#9A8E82`
  - research: `#3A8A9A`
  - drafting: `#D4AA4A`
  - revising: `#8A6A9A`
  - production: `#B45A2D`
  - published: `#6A9A5A`

### Desk Surface (flex: 1, the area around the paper)
- Base: `#231E18` (warm near-black, NOT cold slate)
- Dot field: `radial-gradient(circle, rgba(180,90,45,0.08) 1px, transparent 1px)`, `28px 28px`
- Blueprint grid: `linear-gradient` both axes, `rgba(180,90,45,0.032)`, `40px 40px`
- Ambient desk lamp glow: `radial-gradient(ellipse 900px 600px at 54% 48%, rgba(245,238,220,0.04) 0%, transparent 65%)`
- Padding around paper: `36px 24px 48px`

### The Paper

**Color: `#E4D9CC`** -- aged Moleskine, NOT near-white. This is non-negotiable.
If this feels too dark, that instinct is wrong. The contrast with the desk
should feel like paper under lamplight, not a bright screen.

**Width:** `min(100%, calc(72ch + 128px))`, centered

**Shadow:** warm directional light from above, NOT dramatic float:
```css
box-shadow:
  0 1px 3px rgba(20,14,8,0.12),
  0 3px 10px rgba(20,14,8,0.18),
  0 8px 24px rgba(20,14,8,0.12),
  inset 0 -1px 0 rgba(255,255,255,0.08);
```

**Never use:** `box-shadow: 0 24px 44px rgba(0,0,0,0.22)` -- this creates a floating
modal, not a resting document.

**Border radius:** `0 0 3px 3px` (flat top where stage strip attaches, slight rounding at bottom)

#### Paper Texture (two layers, both required)
Layer 1 -- coarse grain (fractalNoise):
```css
background-image: url("data:image/svg+xml,...fractalNoise baseFrequency='0.62' numOctaves='5'...");
background-size: 250px 250px;
mix-blend-mode: multiply;
opacity: 0.13;
```

Layer 2 -- fine fiber (turbulence):
```css
background-image: url("data:image/svg+xml,...turbulence baseFrequency='0.85' numOctaves='3'...");
background-size: 120px 120px;
mix-blend-mode: multiply;
opacity: 0.07;
```

Both layers use `position: absolute; inset: 0; pointer-events: none; z-index: 1`.
A single-layer grain at opacity 0.055 is too subtle. Always use both layers.

#### Left Margin Rule (required -- this is the identity element)
A single 1px vertical line, terracotta-tinted, at `left: 62px`:
```css
position: absolute;
top: 0; bottom: 0; left: 62px;
width: 1px;
background: rgba(180,90,45,0.28);
z-index: 2;
pointer-events: none;
```

This is a composition notebook margin line. It ties terracotta into the paper zone,
confirms the field-notebook identity, and creates a margin gutter for future
annotation features. Do not remove it or increase its opacity above 0.30.

#### Ruled Lines (faint, in writing body area only)
```css
background-image: linear-gradient(rgba(42,36,32,0.045) 1px, transparent 1px);
background-size: 100% 32px;
background-position-y: 172px; /* offset below title + toolbar */
```

#### Stage Progress Strip (sits above paper, attached to paper top)
```css
height: 2px;
background: linear-gradient(90deg, {stageColor} 0%, {stageColor}55 60%, transparent 100%);
border-radius: 2px 2px 0 0;
```
This strip is a separate element rendered immediately above the paper div so it
appears to grow from the top edge of the document.

---

## Paper Internal Structure

### Title Zone
- Padding: `32px 52px 24px 76px` (left offset puts title PAST the margin rule)
- No visible border or input box around the title field
- Title sits on the paper surface as a headline, not inside a form control
- Above the title: a small metadata row with content type + stage in JetBrains Mono 9px
- `caret-color: #B45A2D` on the title input
- Font: Vollkorn 700, 27px, `#2A2420`, line-height 1.25

### Toolbar Rail (inside the paper, NOT chrome)
This is the most critical structural decision. The toolbar must live inside the
paper zone with only a subtle tint to separate it from the writing body.

```css
border-top: 1px solid rgba(42,36,32,0.10);
border-bottom: 1px solid rgba(42,36,32,0.08);
background: rgba(42,36,32,0.04);
padding: 4px 52px 4px 76px; /* left matches title indent */
```

Toolbar buttons: ghost-button style with `border: 1px solid transparent` that gets
a light border on hover. Not bare text characters floating in space.
Format buttons (B, I, U, S): Georgia/serif font so they carry typographic meaning.
Block format buttons (H1, H2, etc.): JetBrains Mono 10.5px.

If the toolbar is rendered as a separate dark chrome band above the paper, the design
is wrong. It should read as a printed ruler strip on the paper's top margin.

### Writing Body
- Padding: `28px 52px 64px 76px` (same left indent past margin rule)
- Font: Amarna Variable (fallback: Georgia), 18.5px, line-height 1.8, `#2A2420`
- Cursor color: `#B45A2D`
- Left gutter (0 to 62px) reserved for future margin annotations

### Word Count Band (bottom of paper, inside paper)
```css
border-top: 1px solid rgba(42,36,32,0.08);
background: rgba(42,36,32,0.03);
padding: 10px 52px 12px 76px;
```

Word count is the **dominant element**: 36px, JetBrains Mono 700, colored by current stage.
Secondary metrics (chars, read time, paragraphs): 13px, `#6A5E52`.
Session metrics right-aligned: 12px, `#8A7A6A`.

This hierarchy is intentional. Do not equalize the sizes.

---

## Workbench Panel

The workbench panel is **collapsible and width-adjustable**. These behaviors must be
preserved across any redesign work.

- Default width: 272px
- Collapsed: panel hidden entirely, content area takes full remaining width
- Toggle: a collapse handle on the left edge of the panel (subtle, not prominent)
- Width adjustment: a drag handle on the panel's left border
- Min width when open: 220px; max: 400px

When collapsed, the stage bar's right section (save indicator) should remain visible
in the top bar rather than disappearing.

### Workbench Tabs
All 5 tabs are always visible even when collapsed (they become a vertical icon strip):
`RESEARCH | OUTLINE | STASH | HISTORY | COLLAB`

- Tab bar: `height: 38px`, `borderBottom: 1px solid rgba(237,231,220,0.08)`
- Active tab: `borderBottom: 2px solid {stageColor}` (stage-reactive), `rgba(180,90,45,0.1)` bg
- Tab labels: JetBrains Mono 8px, 0.08em letter-spacing, uppercase
- Background: `#111210` (same as sidebar -- the workbench is a desk surface, not a panel)

### Workbench Content Styling
All content cards in the workbench use the evidence-card pattern:
```css
border-left: 2px solid {relevantColor};
border-radius: 0 4px 4px 0;
background: rgba(237,231,220,0.03);
border: 1px solid rgba(237,231,220,0.07); /* other 3 sides */
```

Section labels: JetBrains Mono 9px, uppercase, `rgba(237,231,220,0.30)`.
Empty states: italic, `rgba(237,231,220,0.35)`, no centered placeholder graphics.

---

## What NOT to Do

These are anti-patterns. If any of these appear in the implementation, fix them:

- **Paper as `#FAF6F1` or lighter:** too bright, reads as a web page, not paper
- **Toolbar as separate dark chrome band above paper:** kills the document illusion
- **Title with visible input border:** makes it look like a form field
- **`box-shadow: 0 24px 44px` on paper:** floating modal feel, not resting document
- **Word count equalized with secondary metrics:** word count must dominate visually
- **Stage shown as a single label only:** must show the full pipeline as a flow
- **Desk as cold near-black (`#111`, `#0F0F0F`):** must be warm near-black (`#231E18`)
- **Paper grain at `opacity: 0.055` single layer:** too subtle, use the two-layer system
- **Left margin rule removed:** this is the brand identity element for the editor
- **Blueprint grid at `opacity: 0.022`:** too subtle, use `0.032` minimum on desk
- **Workbench collapse/resize logic removed during style changes:** preserve it always

---

## CSS Variable Reference (editor-specific additions to studio.css)

```css
/* Writing surface */
--studio-writing-paper-bg: #E4D9CC;
--studio-writing-paper-text: #2A2420;
--studio-writing-paper-muted: #6A5E52;
--studio-writing-margin-rule: rgba(180,90,45,0.28);
--studio-writing-ruled-line: rgba(42,36,32,0.045);
--studio-desk-bg: #231E18;

/* Toolbar inside paper */
--studio-toolbar-bg: rgba(42,36,32,0.04);
--studio-toolbar-border: rgba(42,36,32,0.09);

/* Workbench */
--studio-workbench-width: 272px;
--studio-workbench-width-min: 220px;
--studio-workbench-width-max: 400px;
```

---

## Affected Files

When implementing this spec, the primary files to touch are:

```
src/styles/studio.css
src/components/studio/Editor.tsx
src/components/studio/TiptapEditor.tsx
src/components/studio/EditorToolbar.tsx
src/components/studio/WordCountBand.tsx
src/components/studio/StageStepper.tsx
src/components/studio/WorkbenchPanel.tsx
```

Do NOT change:
- `src/styles/studio.css` token names (only values)
- The workbench collapse/resize logic (only styling)
- Django API wiring in `src/lib/studio-api.ts`
