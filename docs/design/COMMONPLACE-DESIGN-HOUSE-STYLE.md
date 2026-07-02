# COMMONPLACE-DESIGN-HOUSE-STYLE

A standing design brief to prepend to every frontend handoff. It exists because an agent handed a data model renders every field as an equally weighted box. This brief hands the agent the decisions it cannot infer, so it stops rendering plumbing and starts rendering a product. It is the design counterpart to CONVENTIONS.md, and you reuse it rather than re-explaining design each time.

## The one rule

A data model is not a layout. The spec says what data exists; this brief says what matters, what is secondary, and what is hidden. The agent renders the second, never the first.

## Per surface, declare three things

Before a frontend handoff names any component, it names these, because the agent cannot infer them:

1. **Archetype.** One of: authoring (focused, single task, low chrome, advanced options disclosed on demand), monitoring (dense, many sources, asymmetric sizing for priority), triage (scannable list plus preview, low chrome), configuration (grouped by category, immediate feedback), exploration (mixed types, filtering, polymorphic rendering). The archetype sets density and chrome in one word, which is why it is the single highest-leverage thing you can say.
2. **Hierarchy.** The one primary element the user is here for, the secondary elements that support it, and the plumbing that is hidden. Primary dominates by size and position, secondary is quiet, plumbing is gone.
3. **Empty and plumbing.** Absent data collapses to nothing or one quiet line, never a labeled box. Plumbing, meaning binding IDs, worktree paths, tenant slugs, run-channel status, and bridge notices, is not user UI; it lives behind a developer toggle.

## The house system, use only these

- **Grid and spacing:** the 4 and 8 spacing scale from `tokens.css`. No arbitrary padding.
- **Color:** the amber and paper grounds, one accent per surface, pcb-green for memory and grounding, brass for agent and ingestion, oxblood for the harness console. Accents are fills, borders, and large text, never body text. No raw hex outside `tokens.css`.
- **Type:** the existing type scale, one display face for headings, one text face for body. No third face.
- **Motion:** chrome transitions only, resolving to zero under reduced motion. Content never animates.
- **Components, bound not built:** assistant-ui for the chat thread, attachments, and composer; the Skiper AI input as the composer; weave-spinner for thinking; NocoDB for grids and galleries; cosmos.gl and D3 and React Flow for the graph; Embedding Atlas for vectors; the 21st.dev file-tree; TipTap for notes; BlockSuite for canvas; Monaco for code. Nothing in this list is hand-rolled.

## Polymorphic rendering, which your backend already does

`renderable.rs` renders each object type as itself. The frontend must honor that. A git-status row, a CI check, a source connector, and a message are different objects with different affordances, so they get different visual treatments, not the same labeled box. Uniform boxes for heterogeneous objects is the smell that makes a surface read as a database dump.

## The smells to never ship

Equal-weight everything, chrome inflation with borders around borders, decoration without hierarchy, a labeled box for absent data, plumbing shown as UI, uniform rendering of heterogeneous objects, and symmetry where priority should show. If a review finds one, the surface is not done.

## How to use this

Prepend this brief to a frontend handoff. The handoff then adds only the surface-specific three declarations, archetype and hierarchy and empty-and-plumbing, plus the component list. The agent has the decisions and the system, so it renders a product rather than the schema.
