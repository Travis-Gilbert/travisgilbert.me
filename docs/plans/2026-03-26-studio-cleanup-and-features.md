# Studio Cleanup and Features Spec
## 2026-03-26

> **For Claude Code. One batch per session. Run `npm run build` after each batch.**
> No em dashes anywhere. Use colons, semicolons, commas, or periods instead.
> Read every file listed in "Read first" before touching any code.

**Repo:** `Travis-Gilbert/travisgilbert.me`
**Stack:** Next.js, React 19, Tailwind v4, Turbopack
**Backend:** Django publishing API on Railway (Bearer token auth)

---

## What This Is

Seven fixes and features for Studio, ranging from CSS-only tweaks (scrollbar, paper width) to backend-wired features (claim audit, rembg collage) and a D3 visualization upgrade. Ordered from smallest risk to largest.

---

## Batch 1: Scrollbar + Paper Width

**Read first:**
- `src/styles/studio.css` (search for `.studio-writing-surface`, `.studio-page`, `.studio-scrollbar`, `.studio-main`)
- `src/components/studio/StudioLayout.tsx`

### 1A. Hide Scrollbar, Preserve Scroll

The writing surface scroll container (`.studio-writing-surface`) and main area (`.studio-main`) should hide the native scrollbar but keep scroll functionality. Use the webkit/Firefox approach.

**In `src/styles/studio.css`, add after the existing `.studio-scrollbar` rules:**

```css
/* Invisible scrollbar: scroll works, bar hidden */
.studio-scrollbar-hidden {
  scrollbar-width: none; /* Firefox */
  -ms-overflow-style: none; /* IE/Edge legacy */
}
.studio-scrollbar-hidden::-webkit-scrollbar {
  display: none; /* Chrome/Safari/Opera */
}
```

**In `src/components/studio/StudioLayout.tsx`:**

Add `studio-scrollbar-hidden` to the `<main>` element's className, replacing `studio-scrollbar`:

```typescript
<main
  className="studio-main studio-scrollbar-hidden"
  // ... rest unchanged
>
```

**In `src/components/studio/Editor.tsx`:**

Find the `.studio-writing-surface` container (the outermost div of the writing area that has `overflowY: 'auto'`). Add `studio-scrollbar-hidden` to its className. This is the div that wraps the stage strip, paper, and desk background.

Search for the JSX that renders the writing surface container. It will have `className` including `studio-writing-surface`. Append `studio-scrollbar-hidden` to that className string.

### 1B. Expand Paper Width Option

The paper width is currently controlled by `--studio-editor-column-width: min(100%, calc(72ch + 128px))` in `.studio-writing-surface`.

Increase to 80ch:

```css
.studio-writing-surface {
  --studio-editor-column-width: min(100%, calc(80ch + 128px));
}
```

This affects `.studio-page` width (which uses this variable), `.studio-stage-strip` width, and the `max-width` of content within the paper. The margin rule at 62px, toolbar padding at `76px` left, and prose padding at `76px` left all stay the same. The extra width goes to the right side of the text area.

**Verify:** The margin rule, ruled lines, grain texture, stage strip, and paper weathering all render correctly at the wider width. The paper still floats on the desk with visible desk background on both sides.

### 1C. Align Ruled Lines to Text

The ruled lines are set at `background-size: 100% 32px` on `.studio-prose`. The line height is `1.75` at `19px` font size, which equals `33.25px`. The ruled lines and text are misaligned.

Fix: change the ruled line spacing to match the computed line height:

```css
.studio-prose {
  /* ... existing styles ... */
  background-size: 100% calc(var(--studio-reading-font-size) * var(--studio-reading-line-height));
}
```

This makes the ruled lines track the actual line height, so if the user changes font size or line height in the reading panel, the lines stay aligned.

**Verification:**
- [ ] Scrollbar is invisible on the writing surface and main area
- [ ] Scrolling still works with mouse wheel, trackpad, and keyboard
- [ ] Paper is wider, margin rule and ruled lines are intact
- [ ] Ruled lines align with text baselines
- [ ] `npm run build` passes

---

## Batch 2: WikiLink `[[` Popup Close Bug

**Read first:**
- `src/components/studio/extensions/WikiLinkSuggestion.tsx`
- `src/components/studio/TiptapEditor.tsx` (search for `wikiPopup`)

### Problem

The `[[` popup opens when the user types `[[` but does not close when the user clicks elsewhere in the document, selects text with mouse, or moves the cursor via arrow keys past the trigger boundary. It only closes on Escape or when the text pattern stops matching via `handleTextInput`.

The root cause: the plugin's `apply` method in the state object only checks `if (from < prev.from)`, which catches backward cursor movement but not forward clicks or mouse-driven selection changes that land outside the `[[...` context.

### Fix in `src/components/studio/extensions/WikiLinkSuggestion.tsx`

Replace the `apply` method in the Plugin state config:

```typescript
apply(tr, prev, _oldState, newState) {
  const meta = tr.getMeta(pluginKey);
  if (meta) return meta;
  if (!prev.active) return prev;

  // Close if selection moved outside the [[ context
  const { from } = newState.selection;
  if (from < prev.from) {
    return { active: false, query: '', from: 0 };
  }

  // Check if the text between trigger and cursor still matches [[...
  const $pos = newState.selection.$from;
  const textBefore = $pos.parent.textBetween(
    0,
    $pos.parentOffset,
    undefined,
    '\uFFFC',
  );
  const match = textBefore.match(/\[\[([^\]]*?)$/);
  if (!match) {
    return { active: false, query: '', from: 0 };
  }

  return prev;
},
```

This adds a text-match check on every transaction (not just text input), which catches click-to-move, arrow key movement, and selection changes.

Also add `handleClick` to the `props` object to ensure `onClose` is called (the `apply` method cannot call side effects directly):

```typescript
props: {
  handleTextInput(view, from, _to, text) {
    // ... existing code unchanged ...
  },

  handleKeyDown(view, event) {
    // ... existing code unchanged ...
  },

  handleClick(view) {
    const state = pluginKey.getState(view.state);
    if (!state?.active) return false;

    // After click, check if cursor is still in [[ context
    setTimeout(() => {
      const newState = view.state;
      const $pos = newState.selection.$from;
      const textBefore = $pos.parent.textBetween(
        0,
        $pos.parentOffset,
        undefined,
        '\uFFFC',
      );
      const match = textBefore.match(/\[\[([^\]]*?)$/);
      if (!match) {
        isOpen = false;
        onClose();
        view.dispatch(
          view.state.tr.setMeta(pluginKey, {
            active: false,
            query: '',
            from: 0,
          }),
        );
      }
    }, 0);

    return false;
  },
},
```

Both changes together (the `apply` fix for state consistency AND the `handleClick` for calling `onClose`) ensure the popup closes on any cursor movement away from the `[[` context.

**Verification:**
- [ ] Type `[[` to open popup, then click elsewhere in the document. Popup closes.
- [ ] Type `[[`, press right arrow key past the context. Popup closes.
- [ ] Type `[[How`, select some text elsewhere with mouse. Popup closes.
- [ ] Normal `[[` flow still works: type `[[`, see popup, type query, select item.
- [ ] Escape still closes the popup.
- [ ] `npm run build` passes

---

## Batch 3: Sheet Title Sync with First Heading

**Read first:**
- `src/components/studio/Editor.tsx` (search for `handleUpdate`, `sheets`, `activeSheetId`, `updateSheet`)
- `src/lib/studio-api.ts` (search for `updateSheet`)

### Problem

When creating a new sheet, the sheet title stays as "Untitled" or whatever was passed initially. It should track the first `#` heading in the sheet's content.

### Fix in `src/components/studio/Editor.tsx`

Find the `handleUpdate` callback (the function passed to TiptapEditor's `onUpdate` prop that fires on every editor change). Add heading extraction logic:

```typescript
// Inside handleUpdate, after the existing body/word count updates:

// Sync sheet title with first heading
if (isSheetsMode && activeSheetId && editor) {
  const firstHeading = (() => {
    let found = '';
    editor.state.doc.descendants((node) => {
      if (found) return false; // stop traversal
      if (node.type.name === 'heading' && node.attrs.level === 1) {
        found = node.textContent.trim();
        return false;
      }
      // Also accept h2 if no h1 exists
      if (!found && node.type.name === 'heading' && node.attrs.level === 2) {
        found = node.textContent.trim();
      }
      return true;
    });
    return found;
  })();

  if (firstHeading) {
    setSheets((prev) =>
      prev.map((s) =>
        s.id === activeSheetId && s.title !== firstHeading
          ? { ...s, title: firstHeading }
          : s,
      ),
    );
  }
}
```

For the reverse direction (editing sheet title updates the heading), add a handler in the sheet sidebar. Find where sheets are rendered in `StudioSidebar.tsx` or `SheetList.tsx` (wherever the sheet title is editable). When the title input changes:

```typescript
const handleSheetTitleChange = (sheetId: string, newTitle: string) => {
  // Update local state
  setSheets((prev) =>
    prev.map((s) => (s.id === sheetId ? { ...s, title: newTitle } : s)),
  );

  // If this is the active sheet, update the first heading in the editor
  if (sheetId === activeSheetId && editor) {
    let headingPos: number | null = null;
    editor.state.doc.descendants((node, pos) => {
      if (headingPos !== null) return false;
      if (node.type.name === 'heading' && (node.attrs.level === 1 || node.attrs.level === 2)) {
        headingPos = pos;
        return false;
      }
      return true;
    });

    if (headingPos !== null) {
      const headingNode = editor.state.doc.nodeAt(headingPos);
      if (headingNode) {
        editor.chain()
          .focus()
          .command(({ tr }) => {
            tr.replaceWith(
              headingPos!,
              headingPos! + headingNode.nodeSize,
              editor.state.schema.nodes.heading.create(
                { level: headingNode.attrs.level },
                editor.state.schema.text(newTitle),
              ),
            );
            return true;
          })
          .run();
      }
    }
  }
};
```

Also update the sheet title on the backend when it changes. Debounce this to avoid excessive API calls:

```typescript
// Debounced save after title change
const sheetTitleSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

// In the title change handler, after local state update:
if (sheetTitleSaveTimer.current) clearTimeout(sheetTitleSaveTimer.current);
sheetTitleSaveTimer.current = setTimeout(() => {
  updateSheet(normalizedContentType, slug, sheetId, { title: newTitle });
}, 1000);
```

For non-sheet content: apply the same heading-to-title sync for the main content item. When the first heading changes, update `currentTitle` state. When the title input changes, update the first heading in the editor.

**Verification:**
- [ ] Create a new sheet. Type `# My Title`. Sheet title in sidebar updates to "My Title".
- [ ] Change the heading text. Sheet title updates within a second.
- [ ] Edit the sheet title in the sidebar. The `#` heading in the editor updates.
- [ ] Switch between sheets. Each sheet shows the correct title.
- [ ] `npm run build` passes

---

## Batch 4: Claim Audit Backend Wiring

**Read first:**
- `src/components/studio/ClaimAuditPanel.tsx`
- `src/lib/studio-api.ts` (search for `auditClaims`, `ClaimAuditResult`)
- `src/components/studio/WorkbenchPanel.tsx` (search for `ClaimAuditPanel`, `Run Audit`)

### Problem

The "Run Audit" button in the research panel calls `auditClaims()` which hits `/ml/claim-audit/` on the Django backend. This endpoint either does not exist or returns an error. The button appears to do nothing because the error is caught silently.

### 4A. Fix the Frontend: Wire ClaimAuditPanel into WorkbenchPanel

In `WorkbenchPanel.tsx`, the `ResearchMode` component renders a "Run Audit" button directly (not using `ClaimAuditPanel`). There are two audit buttons: one in `ResearchMode` (the simple inline button) and the full `ClaimAuditPanel` component. The inline button does nothing.

Replace the inline "Run Audit" button in `ResearchMode` with the actual `ClaimAuditPanel` component. Find the section in the `ResearchMode` function that renders:

```typescript
<span ...>CLAIM AUDIT</span>
<button ...>Run Audit</button>
```

Replace with:

```typescript
<ClaimAuditPanel
  getEditorText={() => {
    if (!editor) return '';
    const md = (editor as any).getMarkdown?.();
    return md ?? editor.getText();
  }}
  contentType={contentItem?.contentType ?? ''}
  slug={contentItem?.slug ?? ''}
  sourceSlugs={sources.map((s: any) => s.slug ?? '').filter(Boolean)}
/>
```

Ensure `ClaimAuditPanel` is imported at the top of `WorkbenchPanel.tsx`. It already is (check existing imports).

Pass `editor` and `contentItem` through to the `ResearchMode` component if they are not already available there.

### 4B. Add Loading and Error States

In `ClaimAuditPanel.tsx`, add visible feedback:

1. When loading, show a pulsing terracotta dot next to "Auditing...":

```typescript
{loading && (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginTop: '8px',
    fontFamily: 'var(--studio-font-mono)',
    fontSize: '10px',
    color: 'var(--studio-text-2)',
  }}>
    <span className="studio-pulse" />
    Analyzing claims against sources...
  </div>
)}
```

2. When the API fails, show the error instead of silently catching:

```typescript
const [error, setError] = useState<string | null>(null);

// In runAudit catch:
} catch (err) {
  setResult(null);
  setError('Claim audit is not available yet. The backend endpoint needs to be deployed.');
}
```

3. When no sources are linked, show a helpful message instead of the button:

```typescript
{sourceSlugs.length === 0 ? (
  <div style={{
    fontFamily: 'var(--studio-font-body)',
    fontSize: '12px',
    color: 'var(--studio-text-3)',
    fontStyle: 'italic',
    marginTop: '4px',
  }}>
    Add sources above to enable claim auditing.
  </div>
) : (
  <button onClick={runAudit} disabled={loading} ...>
    {loading ? 'Auditing...' : 'Run Audit'}
  </button>
)}
```

### 4C. Django Backend Endpoint

This is for the `publishing_api` Django backend. Create the claim audit endpoint.

**File: `publishing_api/apps/editor/views.py`** (append new view)

```python
class ClaimAuditView(View):
    """POST: extract claims from text and check against linked sources."""

    def post(self, request):
        import json
        body = json.loads(request.body)
        text = body.get('text', '')
        source_slugs = body.get('source_slugs', [])

        if len(text) < 50:
            return JsonResponse({'error': 'Text too short for audit'}, status=400)

        # Extract claims: sentences that make factual assertions
        # Simple heuristic: sentences containing numbers, proper nouns,
        # or declarative verbs (is, was, has, are, were)
        import re
        sentences = re.split(r'(?<=[.!?])\s+', text)
        claim_patterns = re.compile(
            r'\b(is|was|are|were|has|had|will|can|does|did|'
            r'shows?|proves?|demonstrates?|reveals?|indicates?|'
            r'according to|percent|million|billion|thousand)\b',
            re.IGNORECASE,
        )

        claims = []
        for sentence in sentences:
            sentence = sentence.strip()
            if len(sentence) < 20:
                continue
            if claim_patterns.search(sentence):
                claims.append({
                    'text': sentence[:200],
                    'supported': False,
                    'supportingSource': None,
                    'confidence': None,
                })

        # If sources are linked, check claims against source content
        # This is the basic version; the full NLI pipeline comes later
        # via Index-API integration
        if source_slugs:
            from apps.editor.models import Source
            for source_slug in source_slugs[:10]:
                try:
                    source = Source.objects.get(slug=source_slug)
                    source_text = (source.extracted_text or '').lower()
                    for claim in claims:
                        if not claim['supported']:
                            # Simple keyword overlap check
                            claim_words = set(
                                w for w in claim['text'].lower().split()
                                if len(w) > 4
                            )
                            overlap = sum(
                                1 for w in claim_words if w in source_text
                            )
                            if overlap >= 3:
                                claim['supported'] = True
                                claim['supportingSource'] = source.title or source_slug
                                claim['confidence'] = min(0.95, overlap * 0.15)
                except Source.DoesNotExist:
                    continue

        supported_count = sum(1 for c in claims if c['supported'])
        return JsonResponse({
            'claims': claims,
            'summary': {
                'total': len(claims),
                'supported': supported_count,
                'unsupported': len(claims) - supported_count,
            },
        })
```

**File: `publishing_api/apps/editor/urls.py`** (add URL pattern)

```python
path('ml/claim-audit/', ClaimAuditView.as_view(), name='claim-audit'),
```

Note: If the `Source` model does not exist yet in the Django backend, create it or adjust the view to work with whatever source storage model exists. Check `publishing_api/apps/editor/models.py` for the actual model name. The source data may come from the Sourcebox feature (`SourceboxSource` in `studio-api.ts`). Adapt the query accordingly.

**Verification:**
- [ ] Click "Run Audit" with sources linked. Claims appear with supported/unsupported status.
- [ ] Click "Run Audit" with no sources. Helpful message shown instead.
- [ ] If backend is unavailable, error message shown (not silent failure).
- [ ] Loading state shows pulsing dot.
- [ ] `npm run build` passes

---

## Batch 5: Collage Builder with Automatic Background Removal

**Read first:**
- `src/components/studio/CollagePanel.tsx`
- Check Django backend for existing collage endpoints: `publishing_api/apps/editor/urls.py` (search for `collage`)

### Problem

The collage builder requires pre-cut images with backgrounds already removed. This is a friction step that prevents use. Adding `rembg` (U2Net-based background removal) on the Django backend lets the collage builder accept any image and auto-remove backgrounds.

### 5A. Django Backend: Add rembg Endpoint

**Install rembg on the Django backend:**

```bash
pip install rembg[cpu] Pillow
```

Note: `rembg[cpu]` installs the CPU-only version of ONNX Runtime. For Railway deployment, ensure the build includes this dependency in `requirements.txt`.

**File: `publishing_api/apps/editor/views.py`** (append new view)

```python
class RemoveBackgroundView(View):
    """POST: accept an image, remove background, return cutout PNG."""

    def post(self, request):
        from rembg import remove
        from PIL import Image
        import io
        import os
        import uuid

        image_file = request.FILES.get('image')
        if not image_file:
            return JsonResponse({'error': 'No image provided'}, status=400)

        try:
            input_image = Image.open(image_file)
            # Convert to RGBA if needed
            if input_image.mode != 'RGBA':
                input_image = input_image.convert('RGBA')

            # Remove background
            output_image = remove(input_image)

            # Save to collage cutouts directory
            cutout_dir = os.path.join(
                os.environ.get('MEDIA_ROOT', '/app/media'),
                'collage', 'cutouts',
            )
            os.makedirs(cutout_dir, exist_ok=True)

            filename = f'{uuid.uuid4().hex[:12]}.png'
            filepath = os.path.join(cutout_dir, filename)

            output_image.save(filepath, 'PNG')

            return JsonResponse({
                'success': True,
                'path': f'collage/cutouts/{filename}',
                'name': os.path.splitext(image_file.name)[0],
            })
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)
```

**File: `publishing_api/apps/editor/urls.py`:**

```python
path('upload/remove-bg/', RemoveBackgroundView.as_view(), name='remove-bg'),
```

### 5B. Frontend: Auto-Remove Background on Upload

**In `src/components/studio/CollagePanel.tsx`:**

Replace the `uploadCollageImage` function to first remove the background:

```typescript
async function uploadCollageImage(file: File): Promise<{ success: boolean; cutout?: CutoutItem }> {
  const formData = new FormData();
  formData.append('image', file);

  try {
    // Step 1: Remove background via rembg
    const bgRes = await fetch(`${STUDIO_URL}/upload/remove-bg/`, {
      method: 'POST',
      body: formData,
      credentials: 'omit',
    });

    if (!bgRes.ok) {
      // Fallback: try uploading as-is (already a cutout)
      const fallbackRes = await fetch(`${STUDIO_URL}/upload/collage/`, {
        method: 'POST',
        body: formData,
        credentials: 'omit',
      });
      return { success: fallbackRes.ok };
    }

    const data = await bgRes.json();
    return {
      success: data.success,
      cutout: data.success ? { path: data.path, name: data.name } : undefined,
    };
  } catch {
    return { success: false };
  }
}
```

Update the `handleFileDrop` function to use the new return type and refresh cutouts after each upload.

Update the drop zone label text:

```typescript
{uploading ? 'Removing backgrounds...' : 'Drop images here (backgrounds auto-removed)'}
```

**Verification:**
- [ ] Drop a regular photo into the collage builder. Background is removed automatically.
- [ ] The cutout appears in the cutout list after processing.
- [ ] If rembg fails, the original image is uploaded as fallback.
- [ ] The "Drop images here" label indicates auto-removal.
- [ ] `npm run build` passes

---

## Batch 6: D3 Force-Directed Tree Graphs

**Read first:**
- `src/components/studio/LiveResearchGraph.tsx`
- `src/components/studio/ConnectionConstellation.tsx`
- Observable D3 force-directed tree: https://observablehq.com/@d3/force-directed-tree

### Problem

The current D3 graphs in Studio are basic force layouts without tree hierarchy structure. Replace with a colored force-directed tree following the Observable canonical pattern, which shows hierarchical relationships with collapsible nodes and color-coded depth.

### 6A. Create Shared ForceTree Component

**New file: `src/components/studio/ForceTree.tsx`**

This is a reusable D3 force-directed tree that both Studio (research relationships) and CommonPlace (cluster visualization) can use with different data adapters.

```typescript
'use client';

import { useRef, useEffect, useCallback } from 'react';
import * as d3 from 'd3';

interface TreeNode {
  id: string;
  label: string;
  children?: TreeNode[];
  color?: string;
  // Metadata for tooltips
  type?: string;
  detail?: string;
}

interface ForceTreeProps {
  data: TreeNode;
  width?: number;
  height?: number;
  /** Color scale: maps depth to color. Default uses Studio palette */
  colorScale?: (depth: number) => string;
  /** Called when a node is clicked */
  onNodeClick?: (node: TreeNode) => void;
  /** Node radius range [min, max]. Default: [4, 8] */
  radiusRange?: [number, number];
  /** Link distance. Default: 30 */
  linkDistance?: number;
  /** Charge strength. Default: -50 */
  chargeStrength?: number;
}

const STUDIO_TREE_COLORS = [
  '#B45A2D', // terracotta: root/primary
  '#2D5F6B', // teal: sources
  '#C49A4A', // gold: connections
  '#5A7A4A', // green: published/verified
  '#8A6A9A', // purple: backlinks
  '#9A9088', // muted: uncategorized
];

export default function ForceTree({
  data,
  width = 600,
  height = 400,
  colorScale,
  onNodeClick,
  radiusRange = [4, 8],
  linkDistance = 30,
  chargeStrength = -50,
}: ForceTreeProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  const resetZoom = useCallback(() => {
    const svg = svgRef.current;
    if (!svg || !zoomRef.current) return;
    d3.select(svg)
      .transition()
      .duration(400)
      .call(zoomRef.current.transform, d3.zoomIdentity);
  }, []);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || !data) return;

    const root = d3.hierarchy(data);
    const links = root.links();
    const nodes = root.descendants();

    const defaultColor = (depth: number) =>
      STUDIO_TREE_COLORS[depth % STUDIO_TREE_COLORS.length];
    const getColor = colorScale ?? defaultColor;

    const simulation = d3.forceSimulation(nodes as any)
      .force('link', d3.forceLink(links as any)
        .id((d: any) => d.index)
        .distance(linkDistance)
        .strength(1))
      .force('charge', d3.forceManyBody().strength(chargeStrength))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('x', d3.forceX(width / 2).strength(0.05))
      .force('y', d3.forceY(height / 2).strength(0.05));

    const sel = d3.select(svg);
    sel.selectAll('*').remove();

    // Container for zoom/pan
    const g = sel.append('g');

    // Zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });
    sel.call(zoom);
    zoomRef.current = zoom;

    // Links
    const link = g.append('g')
      .attr('stroke', 'rgba(255, 255, 255, 0.12)')
      .attr('stroke-width', 1.5)
      .selectAll('line')
      .data(links)
      .join('line');

    // Nodes
    const node = g.append('g')
      .selectAll('circle')
      .data(nodes)
      .join('circle')
      .attr('r', (d: any) => {
        const hasChildren = d.children && d.children.length > 0;
        return hasChildren ? radiusRange[1] : radiusRange[0];
      })
      .attr('fill', (d: any) => {
        // Use node's own color if provided, otherwise depth-based
        return d.data.color ?? getColor(d.depth);
      })
      .attr('stroke', 'rgba(0, 0, 0, 0.3)')
      .attr('stroke-width', 1)
      .style('cursor', onNodeClick ? 'pointer' : 'default')
      .call(d3.drag<any, any>()
        .on('start', (event, d: any) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on('drag', (event, d: any) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on('end', (event, d: any) => {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        }) as any);

    if (onNodeClick) {
      node.on('click', (_event: any, d: any) => {
        onNodeClick(d.data);
      });
    }

    // Labels (visible on hover via title element)
    node.append('title')
      .text((d: any) => d.data.label);

    // Tick
    simulation.on('tick', () => {
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);
      node
        .attr('cx', (d: any) => d.x)
        .attr('cy', (d: any) => d.y);
    });

    return () => {
      simulation.stop();
    };
  }, [data, width, height, colorScale, onNodeClick, radiusRange, linkDistance, chargeStrength]);

  return (
    <div className="studio-research-graph-container" style={{ height }}>
      <svg
        ref={svgRef}
        className="studio-research-graph-svg"
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
      />
      <div className="studio-research-graph-controls">
        <button type="button" onClick={resetZoom} title="Reset zoom">
          &#x21BA;
        </button>
      </div>
    </div>
  );
}
```

### 6B. Update LiveResearchGraph to Use ForceTree

Replace the contents of `LiveResearchGraph.tsx` with a wrapper that converts research trail data into the `TreeNode` format and renders `ForceTree`.

The root node is the current content item. Sources are children of the root. Backlinks are also children but with a different color.

```typescript
// Adapter: convert research trail to tree structure
function buildResearchTree(
  title: string,
  sources: ResearchTrailSource[],
  backlinks: ResearchTrailBacklink[],
  accentColor: string,
): TreeNode {
  return {
    id: 'root',
    label: title,
    color: accentColor,
    children: [
      ...sources.map((s) => ({
        id: `src-${s.slug}`,
        label: s.title,
        color: '#B45A2D',
        type: 'source',
        detail: s.domain,
      })),
      ...backlinks.map((b) => ({
        id: `bl-${b.slug}`,
        label: b.title,
        color: '#3A8A9A',
        type: 'backlink',
        detail: b.contentType,
      })),
    ],
  };
}
```

### 6C. CommonPlace Integration Note

The `ForceTree` component is designed to be reused by CommonPlace for its cluster visualization replacement. CommonPlace would provide a different data adapter that converts cluster data into the `TreeNode` format. That integration is a separate spec. This batch only creates the component and wires it into Studio.

**Verification:**
- [ ] Research graph in the workbench shows a colored force-directed tree
- [ ] Root node (content item) is in terracotta, sources in teal, backlinks in purple
- [ ] Nodes are draggable
- [ ] Zoom and pan work (scroll wheel, drag)
- [ ] Reset zoom button works
- [ ] `npm run build` passes

---

## Batch 7: Light Mode Research Panel Fix

**Read first:**
- `src/styles/studio.css` (search for `.studio-theme-light .studio-workbench`)

### Problem

The research panel source cards in light mode are washed out. The workbench uses dark slate chrome (`--studio-bg-sidebar: #2B3544`) but the source cards inside it inherit tokens that produce low contrast.

### Fix

The source cards rendered by `ResearchMode` in `WorkbenchPanel.tsx` use inline styles that reference `var(--studio-text-1)` etc. In light mode, these variables are overridden to dark warm colors (`#2A2420`) by the `.studio-theme-light` class. But the workbench re-overrides them back to cream on slate via `.studio-theme-light .studio-workbench`.

The source cards SHOULD use the cream-on-slate tokens (they sit inside the dark workbench). The issue is that the card's inner content area (the parchment-colored card body with the article title and excerpt) is too close in color to the dark chrome around it.

In `src/styles/studio.css`, add scoped styles for source cards inside the workbench in light mode:

```css
/* Light mode: source cards in workbench get readable contrast */
.studio-theme-light .studio-workbench .studio-source-card-body {
  background: rgba(240, 234, 224, 0.08);
  border: 1px solid rgba(240, 234, 224, 0.10);
  border-radius: 6px;
  padding: 10px 12px;
}

.studio-theme-light .studio-workbench .studio-source-card-title {
  color: var(--studio-chrome-text-1);
}

.studio-theme-light .studio-workbench .studio-source-card-excerpt {
  color: var(--studio-chrome-text-2);
}

.studio-theme-light .studio-workbench .studio-source-card-domain {
  color: var(--studio-chrome-text-3);
}
```

Then in `WorkbenchPanel.tsx`, add these classNames to the source card elements in the `ResearchMode` component. Find the source card rendering (the div with `borderLeft: 3px solid...`) and add:
- `className="studio-source-card-body"` to the card container
- `className="studio-source-card-title"` to the title div
- `className="studio-source-card-excerpt"` to the excerpt div
- `className="studio-source-card-domain"` to the domain div

This allows the CSS to scope the colors correctly without changing the inline styles that work for dark mode.

**Verification:**
- [ ] Switch to light mode. Source cards in the workbench are readable.
- [ ] Card title is bright cream, excerpt is muted cream, domain is slate gray.
- [ ] Dark mode source cards are unchanged.
- [ ] `npm run build` passes

---

## Build Order

1. **Batch 1:** Scrollbar + Paper Width + Ruled Lines (CSS only, zero risk)
2. **Batch 2:** WikiLink popup close bug (small Tiptap plugin fix)
3. **Batch 3:** Sheet title sync (Editor.tsx state logic)
4. **Batch 4:** Claim audit wiring (frontend + Django endpoint)
5. **Batch 5:** Collage with rembg (Django endpoint + CollagePanel update)
6. **Batch 6:** D3 Force Tree (new component + LiveResearchGraph rewrite)
7. **Batch 7:** Light mode research panel (CSS + classNames)

Batches 1-3 are frontend-only. Batches 4-5 require Django deployment. Batch 6 is a new component. Batch 7 is CSS.

---

## Key File Map

| File | Batches | Purpose |
|------|---------|---------|
| `src/styles/studio.css` | 1, 7 | Scrollbar hiding, paper width, light mode cards |
| `src/components/studio/StudioLayout.tsx` | 1 | Add scrollbar-hidden class to main |
| `src/components/studio/Editor.tsx` | 1, 3 | Scrollbar class, sheet title sync |
| `src/components/studio/extensions/WikiLinkSuggestion.tsx` | 2 | Popup close fix |
| `src/components/studio/ClaimAuditPanel.tsx` | 4 | Loading/error states |
| `src/components/studio/WorkbenchPanel.tsx` | 4, 7 | Wire ClaimAuditPanel, add classNames |
| `src/components/studio/CollagePanel.tsx` | 5 | Auto background removal |
| `src/components/studio/ForceTree.tsx` | 6 | New shared D3 component |
| `src/components/studio/LiveResearchGraph.tsx` | 6 | Rewrite to use ForceTree |
| `publishing_api/apps/editor/views.py` | 4, 5 | Claim audit + rembg endpoints |
| `publishing_api/apps/editor/urls.py` | 4, 5 | URL patterns |
