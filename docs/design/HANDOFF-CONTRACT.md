# THE HANDOFF CONTRACT

The standing preamble for every frontend handoff (SPEC-PARAMETRIC-DESIGN-SYSTEM D6).
A surface handoff is exactly four parts. An agent building a surface receives
values it cannot invent and judgment it cannot skip. If a handoff is missing a
part, the build does not start; ask for the missing part instead.

## Part 1: The product seed

The entire design decision surface for the product, about sixteen values:

- CommonPlace web: `design/seeds/commonplace.seed.json` (this repo)
- Harness console: `apps/harness-console/design/seeds/harness.seed.json` (Theorem)
- Theorem instrument: `apps/desktop/design/seeds/theorem.seed.json` (Theorem)

Brand is numbers. The three seeds share one schema and differ only in values.
A new product is a new seed, never a new stylesheet.

## Part 2: The generated tokens

`tokens.gen.css`, emitted by `scripts/generate-tokens.ts` (canonical copy here;
mirrored at `tools/design-tokens/` in Theorem) from the seed. Regenerate with:

```
npm run tokens
```

Every visual value a component uses comes from this file: the fluid type steps
(`--text--2 .. --text-6`), the commensurable space scale (`--space-1..n` on the
4px grid), the OKLCH ramps and semantic aliases (`--surface-0/1/2`, text tiers,
`--accent`, `--accent-memory`, `--accent-agent`, focus ring, hairline), the
motion trio with its reduced-motion zeroing, the display-font axis maps
(`--font-display-opsz-*`, `--font-display-wdth`), and the strata canvas recipe
(`--canvas-strata`). A raw color, size, or duration literal outside the
generated files is a defect; `scripts/check-raw-values.mjs` fails the commit.

## Part 3: The house style

`docs/design/COMMONPLACE-DESIGN-HOUSE-STYLE.md`. The seed supplies values; the
house style supplies judgment: the one rule (a data model is not a layout), the
archetype vocabulary, the bound-not-built component list, polymorphic
rendering, and the smells that fail review.

## Part 4: The three per-surface declarations, plus the component list

The only surface-specific design content a handoff adds:

1. **Archetype** - authoring, monitoring, triage, configuration, or exploration.
2. **Hierarchy** - the one primary element, the quiet secondaries, the hidden
   plumbing.
3. **Empty and plumbing** - absent data collapses to nothing; plumbing lives
   behind a developer toggle.

Plus the component list, drawn from the house style's bound-not-built manifest.

## Review bar

A surface built from this contract reviews clean on two axes, both computable:

- **Values**: `node scripts/check-raw-values.mjs` finds no raw literal; the
  generator self-check (`npm run tokens` exits 0) holds contrast, grid, and
  motion invariants.
- **Hierarchy**: the rendered surface matches the three declarations; any house
  style smell (equal-weight everything, labeled boxes for absent data, plumbing
  as UI, uniform rendering of heterogeneous objects) fails the review.

## The loop this enables

The seed is small, versioned data. Stored as a graph object it is branchable
through graph-version: fork a seed, render both, keep the winner. Design
becomes an experiment the same machinery already scores.
