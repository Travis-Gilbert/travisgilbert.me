# Library v7 Redesign Spec

> **For Claude Code. One batch per session. Read entire spec before writing code.**
> **Read every file listed under "Read first" before writing a single line.**
> **Run `npm run build` after every batch. Do not proceed if the build fails.**

---

## Summary

The Library view gets six targeted improvements:

1. **Cluster cards redesigned**: D3 graph window showing internal structure, default-open terminal as the metadata surface, title + description only above terminal. No separate metadata badges.
2. **Search bar replaced with Cmd+K**: Remove the full-width search input. Add a `Cmd+K` icon button in the header area that triggers the existing CommandPalette.
3. **Influence chain fade fix**: Replace the hard scroll cutoff with a gradient fade overlay on both edges.
4. **"All Objects" section removed**: Library shows only contextually relevant content (resume, chain, clusters, resurfaced, projects/notebooks placeholders). No flat object grid.
5. **Resurfaced items as compact pills**: Replace full-width resurfaced cards with inline pill-shaped elements that wrap naturally. Move above placeholder sections.
6. **"Not yet clustered" lightweight section**: Unclustered objects shown as polymorphic inline pills between clusters and resurfaced.

---

## Build Order

```
Batch 1: ClusterCard redesign (graph window + terminal-as-metadata)
Batch 2: Search bar removal + Cmd+K integration
Batch 3: Influence chain fade fix + cluster color connection
Batch 4: Remove All Objects, add Unclustered section, reorder Resurfaced
Batch 5: Resurfaced compact pills + final layout cleanup
```

---

## Batch 1: ClusterCard Redesign

### Read first
- `src/components/commonplace/ClusterCard.tsx` (current cluster card, 5444 bytes)
- `src/components/commonplace/LibraryView.tsx` (where ClusterCard is used, 25888 bytes)
- `src/components/commonplace/TerminalBlock.tsx` (existing terminal component, 2923 bytes)
- `src/components/commonplace/TerminalCanvas.tsx` (terminal background canvas, 4058 bytes)
- `src/lib/commonplace.ts` (ClusterResponse type, ClusterMember type)
- `src/lib/commonplace-api.ts` (fetchClusters, fetchGraph)
- `src/styles/commonplace.css` (terminal tokens: --cp-term, --cp-term-border, --cp-term-text, etc.)

### Overview

Replace the current ClusterCard with a three-zone layout:

```
[  2px gradient accent bar (cluster color)              ]
[  SVG graph window (cluster-colored dot pattern bg)    ]
[  Title + description (vellum surface)                 ]
[  Terminal block (default open, IS the metadata)       ]
```

The terminal replaces all metadata badges. Member count, edge count, density, dominant type, type distribution, and member list all live inside the terminal. No "CLUSTER" badge, no green "N objects" pill.

### New file: `src/components/commonplace/ClusterGraphWindow.tsx`

SVG component that renders a force-layout-style visualization of the cluster's internal structure.

**Props:**
```typescript
interface ClusterGraphWindowProps {
  memberIds: number[];
  edges: Array<{ from: number; to: number }>;
  color: string; // cluster accent color
  width?: number; // default: container width
  height?: number; // scales with member count: Math.max(80, members.length * 22)
}
```

**Behavior:**
- Positions nodes in a circular layout with deterministic jitter (no animation, no force simulation)
- Node radius scales with edge count: `3 + Math.min(edges / 8, 1) * 5`
- Node color is the object's type color from `getObjectTypeIdentity()`
- Nodes with more edges get a subtle glow (a larger circle behind at low opacity)
- Edge lines use the cluster's accent color at 0.18 opacity
- Node labels in JetBrains Mono at 6.5px below each node, truncated at 14 chars
- Background: layered dot pattern using the cluster's color:
  ```css
  background-image:
    radial-gradient(circle, ${clusterColor}12 0.6px, transparent 0.6px),
    radial-gradient(circle, rgba(26,26,29,0.04) 0.4px, transparent 0.4px);
  background-size: 12px 12px, 8px 8px;
  background-position: 0 0, 4px 4px;
  mask-image: radial-gradient(ellipse at center, transparent 10%, black 70%);
  ```

**Data source:** The component receives `memberIds` and looks up objects via the same feed data already loaded by LibraryView. For edges, use the cluster's edge data from `fetchGraph()` filtered to only edges where both endpoints are in `memberIds`.

### Changes to `src/components/commonplace/ClusterCard.tsx`

**Remove:**
- The green "N objects" badge
- The "CLUSTER" label badge
- The summary text section
- The member preview pills at the bottom
- The gradient background wash on the entire card

**Replace with:**
```
1. Top gradient accent bar (2px, cluster color, gradient intensity scales with member count)
2. ClusterGraphWindow (height adapts to member count)
3. Title section: Vollkorn title + IBM Plex description, 8px 10px padding
4. TerminalBlock (default expanded, no toggle needed initially)
```

**Terminal content (using existing TerminalBlock component):**
```
cluster analysis                    [green dot] COMPLETE
members    5
edges      8
density    0.80
dominant   source
types      2 source, 1 concept, 1 hunch, 1 person
---
[member list with type pips and edge counts]
```

Each member row in the terminal:
```
[type-colored dot] Object Title                    4e
```

**Props update:**
```typescript
interface ClusterCardProps {
  clusterKey: string;
  label: string;
  color?: string;
  summary?: string;
  memberCount: number;
  members: RenderableObject[];
  // NEW: edges for the graph window
  edges?: Array<{ from: number; to: number }>;
  selected?: boolean;
  onSelectCluster?: (clusterKey: string) => void;
  onOpenObject?: (obj: RenderableObject) => void;
  onContextMenu?: (e: React.MouseEvent, obj: RenderableObject) => void;
}
```

### Changes to `src/components/commonplace/LibraryView.tsx`

- Pass edge data to ClusterCard (requires fetching graph data alongside clusters)
- Change the cluster grid from `gridTemplateColumns: '1fr 1fr'` to support asymmetric sizing:
  - The cluster with the most members gets `gridColumn: 'span 2'` in a 2-column grid
  - Smaller clusters get `span 1`
  - Threshold: clusters with 3+ members get the wide treatment if they are the densest

### Verification
- [ ] ClusterCard renders with graph window showing typed-colored nodes
- [ ] Terminal is visible by default with metadata rows
- [ ] Member list appears in terminal with type pips
- [ ] Cluster grid is asymmetric (densest cluster wider)
- [ ] `npm run build` passes

---

## Batch 2: Search Bar Removal + Cmd+K Integration

### Read first
- `src/components/commonplace/LibraryView.tsx` (search input section)
- `src/components/commonplace/CommandPalette.tsx` (existing Cmd+K palette, 11687 bytes)
- `src/components/commonplace/CommonPlaceSidebar.tsx` (may have Cmd+K trigger)

### Changes to `src/components/commonplace/LibraryView.tsx`

**Remove:**
- The full-width search bar `<div>` with the `<input>` element
- The `searchQuery` state
- The filter logic that depends on `searchQuery`
- The `6 results` counter

**Add in the header row** (next to the Resurface button, or in the top-right area):
- A Cmd+K trigger button matching the screenshot from the site:
  ```tsx
  <button onClick={openCommandPalette} style={{
    display: 'inline-flex', alignItems: 'center', gap: 8,
    padding: '4px 8px', cursor: 'pointer',
    background: 'transparent', border: 'none',
  }}>
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <circle cx={11} cy={11} r={7} stroke="var(--cp-chrome-muted)" strokeWidth={1.5} />
      <path d="M20 20l-3-3" stroke="var(--cp-chrome-muted)" strokeWidth={1.5} strokeLinecap="round" />
    </svg>
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 2,
      padding: '3px 6px', borderRadius: 4,
      background: 'var(--cp-chrome-raise)', border: '1px solid var(--cp-chrome-line)',
      fontFamily: 'var(--cp-font-mono)', fontSize: 10, fontWeight: 500,
      color: 'var(--cp-chrome-muted)',
    }}>
      {'\u2318'}K
    </span>
  </button>
  ```

**Integration:** The CommandPalette component is already mounted in the app. The Cmd+K button should call `requestView` or dispatch a custom event that the CommandPalette listens for. Check `CommandPalette.tsx` for the trigger mechanism.

**Keep:** The type filter pills remain. They filter within the clusters and resurfaced sections, not a flat object list.

### Verification
- [ ] No search bar visible on Library
- [ ] Cmd+K button visible in header area
- [ ] Clicking Cmd+K opens the CommandPalette
- [ ] Type filter pills still work
- [ ] `npm run build` passes

---

## Batch 3: Influence Chain Fade Fix + Cluster Color Connection

### Read first
- `src/components/commonplace/LineageSwimlane.tsx` (3475 bytes)
- `src/components/commonplace/LibraryView.tsx` (where LineageSwimlane is rendered)

### Changes to `src/components/commonplace/LineageSwimlane.tsx`

**Fix the hard cutoff:** Wrap the scroll container in a `position: relative` div with gradient overlay pseudo-elements:

```tsx
{/* Right fade overlay */}
<div style={{
  position: 'absolute', right: 0, top: 0, bottom: 0, width: 56, zIndex: 2,
  background: 'linear-gradient(270deg, var(--cp-bg), transparent)',
  pointerEvents: 'none',
}} />
```

Add `paddingRight: 56` to the scroll container so content doesn't hide behind the fade.

**Restore type colors on chain nodes:** The chain node cards currently use `var(--cp-border-faint)` for borders. Change to:
- Border: `1px solid ${typeColor}25` (type color at 25% opacity)
- Background: `linear-gradient(180deg, ${typeColor}06, transparent)`
- Date label: use `typeColor` instead of `var(--cp-text-faint)`

Where `typeColor` comes from `getObjectTypeIdentity(node.object_type_slug).color`.

**Cluster connection indicator:** Add a subtle 2px bar at the bottom of each chain node showing which cluster it belongs to:
```tsx
{clusterColor && (
  <div style={{
    position: 'absolute', bottom: 0, left: 4, right: 4, height: 2,
    borderRadius: 1, background: clusterColor, opacity: 0.3,
  }} />
)}
```

This requires passing cluster data to the LineageSwimlane. In LibraryView, compute a map of `objectId -> clusterColor` from the cluster data and pass it as a prop.

### Verification
- [ ] Influence chain fades at right edge instead of hard cutoff
- [ ] Chain nodes show type-colored borders and backgrounds
- [ ] Chain nodes show cluster color bar at bottom when the object belongs to a cluster
- [ ] `npm run build` passes

---

## Batch 4: Remove All Objects + Add Unclustered Section + Reorder Resurfaced

### Read first
- `src/components/commonplace/LibraryView.tsx` (the "All Objects" section near the bottom)

### Changes to `src/components/commonplace/LibraryView.tsx`

**Remove the "All Objects" section entirely:**
- Remove the `<SectionHead label="All Objects">` and the grid of ObjectRenderers below it
- Remove the `allObjects` mapping and `filteredNodes` logic that powered it (unless needed for other sections)

**Add "Not yet clustered" section after clusters:**
- Compute unclustered objects: objects not in any cluster's member list
- Render as inline polymorphic pills (not cards):
  ```tsx
  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
    {unclustered.map(obj => {
      const identity = getObjectTypeIdentity(obj.object_type_slug);
      return (
        <button key={obj.slug} onClick={() => handleObjectClick(obj)} style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '5px 12px 5px 8px',
          borderRadius: identity.slug === 'concept' || identity.slug === 'person' ? 100 : 6,
          border: `1px solid ${identity.color}20`,
          background: `${identity.color}06`,
          // ... font styling based on type
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: identity.color }} />
          {obj.display_title ?? obj.title}
        </button>
      );
    })}
  </div>
  ```
- Include mini connection SVGs on pills that have connections

**Reorder sections (top to bottom):**
1. Header (Library title + stats + Resurface button + Cmd+K)
2. Resume Cards (unchanged)
3. Influence Chain (with fade fix)
4. Type filter pills
5. Clusters (asymmetric grid with graph windows)
6. Not yet clustered (inline pills)
7. Resurfaced (compact pills, moved UP from below placeholders)
8. Projects (placeholder header)
9. Notebooks (placeholder header)

### Verification
- [ ] No "All Objects" section visible
- [ ] Unclustered objects appear as inline pills after clusters
- [ ] Resurfaced section is above Projects/Notebooks placeholders
- [ ] Section order matches the spec
- [ ] `npm run build` passes

---

## Batch 5: Resurfaced Compact Pills + Final Layout Cleanup

### Read first
- `src/components/commonplace/LibraryView.tsx` (resurfaced section)
- `src/components/commonplace/ResurfaceView.tsx` (for reference on resurface card structure)
- `src/components/commonplace/objectRenderables.ts` (renderableFromResurfaceCard helper)

### Changes to resurfaced rendering in LibraryView

Replace the current resurfaced cards (which use ObjectRenderer at full width with explanation annotations) with compact pills:

```tsx
function ResurfacedPill({ object, signal, explanation, onClick, onContextMenu }) {
  const identity = getObjectTypeIdentity(object.object_type_slug);
  return (
    <button onClick={() => onClick?.(object)} style={{
      display: 'inline-flex', alignItems: 'center', gap: 8,
      padding: '6px 14px 6px 10px',
      borderRadius: 100,
      border: '1px solid var(--cp-red-line)',
      background: 'var(--cp-red-soft)',
      maxWidth: 320,
      cursor: 'pointer',
    }}>
      {/* Mini connection graph (optional, if object has connections) */}
      <MiniConnectionGraph object={object} size={20} />
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{
            width: 5, height: 5, borderRadius: '50%',
            background: identity.color, flexShrink: 0,
          }} />
          <span style={{
            fontFamily: 'var(--cp-font-body)', fontSize: 12, fontWeight: 600,
            color: 'var(--cp-text)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {object.display_title ?? object.title}
          </span>
        </div>
        <div style={{
          fontFamily: 'var(--cp-font-mono)', fontSize: 8,
          color: 'var(--cp-red)', marginTop: 1,
          letterSpacing: '0.04em',
        }}>
          {signal.replace(/_/g, ' ')}
        </div>
      </div>
    </button>
  );
}
```

The pills flow inline with `display: flex; flexWrap: wrap; gap: 8`. They never stretch full-width.

### New file: `src/components/commonplace/MiniConnectionGraph.tsx`

Small SVG component that renders an object's local connection structure:

**Props:**
```typescript
interface MiniConnectionGraphProps {
  object: RenderableObject;
  size?: number; // default: 22
}
```

**Behavior:**
- Center node colored by object type
- Surrounding nodes positioned radially, colored by their type
- Edge lines from center to each connected node
- Uses edge data from the object's `edge_count` and connected objects from graph data
- Returns null if the object has no connections

### Final layout cleanup
- Ensure consistent spacing between sections (24px between major sections)
- Ensure section headers use the existing pattern: mono label + thin line
- Verify all sections respect the `maxWidth: 880` content constraint
- Confirm the Resurface button is positioned correctly in the header

### Verification
- [ ] Resurfaced items render as compact pills, not full-width cards
- [ ] Pills wrap inline and never stretch to fill the page
- [ ] Mini connection graphs appear on pills with connections
- [ ] All sections have consistent spacing
- [ ] Full page layout matches the prototype order
- [ ] `npm run build` passes

---

## Files Changed (Summary)

| File | Action |
|------|--------|
| `src/components/commonplace/ClusterCard.tsx` | Major rewrite: graph window, terminal-as-metadata |
| `src/components/commonplace/ClusterGraphWindow.tsx` | New file: SVG cluster visualization |
| `src/components/commonplace/MiniConnectionGraph.tsx` | New file: small SVG per-object connection graph |
| `src/components/commonplace/LibraryView.tsx` | Remove search bar, remove All Objects, add Cmd+K, add unclustered section, reorder sections, asymmetric cluster grid |
| `src/components/commonplace/LineageSwimlane.tsx` | Fade overlay, type colors, cluster color bars |

## Files NOT Changed

- `src/styles/commonplace.css` (all tokens already exist)
- `src/lib/commonplace.ts` (types already support this)
- `src/lib/commonplace-api.ts` (fetchClusters, fetchGraph already exist)
- `src/components/commonplace/objects/ObjectRenderer.tsx` (polymorphic rendering untouched)
- `src/components/commonplace/ResumeCards.tsx` (kept as-is)
- `src/components/commonplace/CommandPalette.tsx` (already works, just needs trigger)
- `src/components/commonplace/TerminalBlock.tsx` (reused inside ClusterCard)
- `src/components/commonplace/TerminalCanvas.tsx` (reused via TerminalBlock)

## Design Tokens Used (all from commonplace.css)

```
Terminal: --cp-term, --cp-term-border, --cp-term-text, --cp-term-muted, --cp-term-green, --cp-term-amber
Chrome: --cp-chrome-raise, --cp-chrome-line, --cp-chrome-muted
Content: --cp-bg, --cp-card, --cp-surface, --cp-border, --cp-border-faint
Text: --cp-text, --cp-text-muted, --cp-text-faint
Accent: --cp-red, --cp-red-soft, --cp-red-line
Type colors: via getObjectTypeIdentity().color
Fonts: --cp-font-title (Vollkorn), --cp-font-body (IBM Plex Sans), --cp-font-mono (JetBrains Mono)
```

## Prototype Reference

The interactive prototype for this redesign is `library-v7.jsx` in the project knowledge. Use it as visual reference but implement using the existing component library and CSS tokens, not the prototype's inline styles.
