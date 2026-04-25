# ADR 0003: Keep existing detail surfaces as peers, not replacements

## Status
Accepted

## Context
Three detail surfaces already exist on the main site: `NodeDetailPanel` (right-side inline preview in CommonPlace), `AtlasNodeDetail` (atlas-lens overlay), and `ObjectDrawer` (slide-in drawer for non-Explorer routes). The new Reflex page is a fourth surface for the same conceptual entity (an Object). Two postures are available: deprecate-and-replace, or coexist-as-peers.

## Decision
Coexist. The three existing surfaces remain unchanged and continue to serve lightweight inline previews. The Reflex page is the heavyweight standalone deep view, opened only on per-node double-click in `ExplorerShell`.

## Consequences
- Zero risk to the existing CommonPlace UX. No refactor, no regression surface.
- Clear separation of concerns: inline = preview, standalone = deep view.
- Long runway for the Reflex page to prove out before any consolidation conversation.
- Four surfaces for one entity is more code paths to keep visually consistent. Mitigated by the fact that the Reflex page lives in a different visual language (separate repo dir, Reflex defaults) and is not expected to match the inline previews pixel-for-pixel.
- Reversible: if we later decide one of the inline surfaces should redirect to Reflex instead of rendering in place, that is a single-component change.
