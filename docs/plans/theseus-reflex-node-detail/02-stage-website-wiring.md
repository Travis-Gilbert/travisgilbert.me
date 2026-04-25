# Stage 2: Website Wiring (Website repo)

Repo: `/Users/travisgilbert/Tech Dev Local/Creative/Website/`

Outcome: A `nodeDetailUrl.ts` helper, a Vitest suite covering the URL resolver, the `ExplorerShell.tsx` wiring that opens the Reflex tab on per-node double-click without firing the existing atlas-lens toggle, a `?focus=<pk>` URL param handler that focuses the node and zooms to it, and a documented env var.

All paths in this stage are in the Website repo. Do not commit any of these files from the Index-API repo.

---

## Task 18: nodeDetailUrl helper

Goal: a small TypeScript helper that resolves the Reflex base URL from `NEXT_PUBLIC_REFLEX_NODE_DETAIL_URL` (defaulting to `https://node.travisgilbert.me`) and exposes `nodeDetailUrl(pk)` plus `openNodeDetail(pk)`.

Files to create:

- `/Users/travisgilbert/Tech Dev Local/Creative/Website/src/lib/theseus/nodeDetailUrl.ts`

Exact code:

```ts
/**
 * Helper for navigating to the Reflex node detail page.
 *
 * Reads `NEXT_PUBLIC_REFLEX_NODE_DETAIL_URL` at build time. Falls back
 * to the production hostname when the env var is unset so dev / preview
 * builds without configuration still produce a navigable URL.
 *
 * `openNodeDetail(pk)` opens the URL in a new tab with `noopener,noreferrer`
 * so the new page cannot reach back into the Explorer (security plus
 * keeps the cosmos.gl simulation isolated from the new tab).
 */

const DEFAULT_BASE = 'https://node.travisgilbert.me';

function resolveBase(): string {
  const fromEnv = process.env.NEXT_PUBLIC_REFLEX_NODE_DETAIL_URL;
  if (typeof fromEnv === 'string' && fromEnv.length > 0) {
    return fromEnv.replace(/\/+$/, '');
  }
  return DEFAULT_BASE;
}

export function nodeDetailUrl(pk: string | number): string {
  const base = resolveBase();
  return `${base}/n/${pk}`;
}

export function openNodeDetail(pk: string | number): void {
  if (typeof window === 'undefined') return;
  window.open(nodeDetailUrl(pk), '_blank', 'noopener,noreferrer');
}
```

Verification command:

```bash
cd "/Users/travisgilbert/Tech Dev Local/Creative/Website" && npx tsc --noEmit -p tsconfig.json
```

Acceptance criterion: TypeScript compiles without errors.

Delegate to: nextjs-engine-pro

---

## Task 19: Vitest test for nodeDetailUrl

Goal: cover env-set, env-unset fallback, numeric pk, string pk, and trailing-slash trim cases.

Files to create:

- `/Users/travisgilbert/Tech Dev Local/Creative/Website/src/lib/theseus/__tests__/nodeDetailUrl.test.ts`

Exact code:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';

const ENV_KEY = 'NEXT_PUBLIC_REFLEX_NODE_DETAIL_URL';

async function freshImport() {
  vi.resetModules();
  return await import('../nodeDetailUrl');
}

afterEach(() => {
  delete process.env[ENV_KEY];
  vi.unstubAllGlobals();
});

describe('nodeDetailUrl', () => {
  it('uses the production fallback when the env var is unset', async () => {
    delete process.env[ENV_KEY];
    const { nodeDetailUrl } = await freshImport();
    expect(nodeDetailUrl(42)).toBe('https://node.travisgilbert.me/n/42');
  });

  it('uses the env var when set', async () => {
    process.env[ENV_KEY] = 'http://localhost:3000';
    const { nodeDetailUrl } = await freshImport();
    expect(nodeDetailUrl(7)).toBe('http://localhost:3000/n/7');
  });

  it('trims trailing slashes from the env value', async () => {
    process.env[ENV_KEY] = 'http://localhost:3000/';
    const { nodeDetailUrl } = await freshImport();
    expect(nodeDetailUrl(7)).toBe('http://localhost:3000/n/7');
  });

  it('accepts string pk', async () => {
    delete process.env[ENV_KEY];
    const { nodeDetailUrl } = await freshImport();
    expect(nodeDetailUrl('1234')).toBe('https://node.travisgilbert.me/n/1234');
  });
});

describe('openNodeDetail', () => {
  it('calls window.open with the correct URL and flags', async () => {
    delete process.env[ENV_KEY];
    const open = vi.fn();
    vi.stubGlobal('window', { open });
    const { openNodeDetail } = await freshImport();
    openNodeDetail(99);
    expect(open).toHaveBeenCalledWith(
      'https://node.travisgilbert.me/n/99',
      '_blank',
      'noopener,noreferrer',
    );
  });

  it('is a no op when window is undefined', async () => {
    vi.stubGlobal('window', undefined);
    delete process.env[ENV_KEY];
    const { openNodeDetail } = await freshImport();
    expect(() => openNodeDetail(99)).not.toThrow();
  });
});
```

Verification command:

```bash
cd "/Users/travisgilbert/Tech Dev Local/Creative/Website" && npm run test -- nodeDetailUrl
```

Acceptance criterion: 6 tests pass.

Delegate to: nextjs-engine-pro

---

## Task 20: Wire ExplorerShell onPointDoubleClick + lens-toggle guard

Goal: in `ExplorerShell.tsx`, pass `onPointDoubleClick` to `<CosmosGraphCanvas>` so per-node double-click opens the Reflex tab. Modify the existing DOM `dblclick` listener at lines 79-93 to consult a `nodeDoubleClickedRef` flag that the new handler sets, so the lens-toggle does NOT fire on per-node double-clicks. Empty-canvas double-click continues to toggle the atlas lens.

Files to modify:

- `/Users/travisgilbert/Tech Dev Local/Creative/Website/src/components/theseus/explorer/ExplorerShell.tsx`

Step 1: add the import at the existing import block (near the other `@/lib/theseus/*` imports). Add this line directly under the `import { onTheseusEvent } from '@/lib/theseus/events';` line:

```ts
import { openNodeDetail } from '@/lib/theseus/nodeDetailUrl';
```

Step 2: declare the ref next to the other refs in the component body. Add directly under `const canvasRef = useRef<CosmosGraphCanvasHandle>(null);`:

```ts
const nodeDoubleClickedRef = useRef(false);
```

Step 3: replace the existing `useEffect` block that installs the DOM `dblclick` listener (currently `ExplorerShell.tsx:79-93`) with the version below. Locate the block by the comment `// Double-click on empty canvas anywhere transitions to Atlas (the` and replace through the closing `}, [lens, handleLensChange]);`:

```tsx
  // Per-node double-click opens the Reflex node detail tab. Empty-canvas
  // double-click continues to toggle the atlas lens. The two paths are
  // mutually exclusive: onPointDoubleClick (cosmos.gl synthesized event)
  // sets nodeDoubleClickedRef.current=true; the DOM dblclick listener
  // early returns when that flag is set so the lens toggle does not
  // fire on top of a node open.
  useEffect(() => {
    const container = document.querySelector('.atlas-canvas');
    if (!container) return;
    function onDblClick(event: Event) {
      if (nodeDoubleClickedRef.current) return;
      if (lens === 'atlas') return;
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (target.tagName !== 'CANVAS') return;
      handleLensChange('atlas');
    }
    container.addEventListener('dblclick', onDblClick);
    return () => container.removeEventListener('dblclick', onDblClick);
  }, [lens, handleLensChange]);
```

Step 4: pass the new `onPointDoubleClick` prop to `<CosmosGraphCanvas>`. Locate the existing block:

```tsx
          <CosmosGraphCanvas
            ref={canvasRef}
            points={points}
            links={links}
            onPointClick={setSelectedId}
            labelsOn={labelsOn}
          />
```

Replace it with:

```tsx
          <CosmosGraphCanvas
            ref={canvasRef}
            points={points}
            links={links}
            onPointClick={setSelectedId}
            onPointDoubleClick={(pointId) => {
              nodeDoubleClickedRef.current = true;
              window.setTimeout(() => {
                nodeDoubleClickedRef.current = false;
              }, 50);
              openNodeDetail(pointId);
            }}
            labelsOn={labelsOn}
          />
```

Verification command:

```bash
cd "/Users/travisgilbert/Tech Dev Local/Creative/Website" && npx tsc --noEmit -p tsconfig.json && npm run lint
```

Acceptance criterion: TypeScript compiles. ESLint passes (no new warnings on `ExplorerShell.tsx`).

Delegate to: nextjs-engine-pro

---

## Task 21: JSDOM test: per-node dblclick opens Reflex, lens does not toggle

Goal: a Vitest + JSDOM test that mounts `ExplorerShell`, simulates `onPointDoubleClick` firing on a point id, and asserts (a) `window.open` was called with the expected URL, (b) the lens state did NOT change to `'atlas'` for that gesture.

Files to create:

- `/Users/travisgilbert/Tech Dev Local/Creative/Website/src/components/theseus/explorer/__tests__/ExplorerShell.dblclick.test.tsx`

Exact code:

```tsx
/**
 * Verifies the gesture contract from ADR 0004:
 *   per-node double-click  -> opens Reflex tab, lens unchanged
 *   empty-canvas dblclick  -> toggles lens (covered by existing behavior)
 *
 * The full ExplorerShell tree is heavy (cosmos.gl, mosaic, hooks); this
 * test focuses on the wiring contract by exercising the ref-flag guard
 * directly against a minimal harness that mirrors the same logic.
 */

import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { useEffect, useRef, useState } from 'react';

import { openNodeDetail } from '@/lib/theseus/nodeDetailUrl';

vi.mock('@/lib/theseus/nodeDetailUrl', () => ({
  openNodeDetail: vi.fn(),
  nodeDetailUrl: (pk: string | number) => `https://node.travisgilbert.me/n/${pk}`,
}));

function Harness({
  onPointDoubleClick,
}: {
  onPointDoubleClick: (pointId: string) => void;
}) {
  const nodeDoubleClickedRef = useRef(false);
  const [lens, setLens] = useState<'flow' | 'atlas'>('flow');

  useEffect(() => {
    const container = document.querySelector('.atlas-canvas');
    if (!container) return;
    function onDblClick(event: Event) {
      if (nodeDoubleClickedRef.current) return;
      if (lens === 'atlas') return;
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (target.tagName !== 'CANVAS') return;
      setLens('atlas');
    }
    container.addEventListener('dblclick', onDblClick);
    return () => container.removeEventListener('dblclick', onDblClick);
  }, [lens]);

  return (
    <div className="atlas-canvas">
      <canvas
        data-testid="canvas"
        onDoubleClick={() => {
          nodeDoubleClickedRef.current = true;
          window.setTimeout(() => {
            nodeDoubleClickedRef.current = false;
          }, 50);
          onPointDoubleClick('42');
        }}
      />
      <span data-testid="lens">{lens}</span>
    </div>
  );
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('ExplorerShell double-click contract', () => {
  it('per-node double-click opens Reflex and leaves the lens alone', () => {
    const handler = vi.fn((pointId: string) => openNodeDetail(pointId));
    const { getByTestId } = render(<Harness onPointDoubleClick={handler} />);
    fireEvent.doubleClick(getByTestId('canvas'));
    expect(handler).toHaveBeenCalledWith('42');
    expect(openNodeDetail).toHaveBeenCalledWith('42');
    expect(getByTestId('lens').textContent).toBe('flow');
  });

  it('empty-canvas double-click on a non-canvas target does NOT open Reflex and does NOT toggle lens', () => {
    const handler = vi.fn((pointId: string) => openNodeDetail(pointId));
    const { container, getByTestId } = render(<Harness onPointDoubleClick={handler} />);
    const wrapper = container.querySelector('.atlas-canvas') as HTMLElement;
    fireEvent.doubleClick(wrapper);
    expect(openNodeDetail).not.toHaveBeenCalled();
    expect(handler).not.toHaveBeenCalled();
    expect(getByTestId('lens').textContent).toBe('flow');
  });
});
```

Verification command:

```bash
cd "/Users/travisgilbert/Tech Dev Local/Creative/Website" && npm run test -- ExplorerShell.dblclick
```

Acceptance criterion: 2 tests pass. The first proves per-node dblclick fires `openNodeDetail` and lens stays `flow`. The second proves the wrapper-level dblclick path does NOT trigger the Reflex open and does not toggle lens (canvas-tag guard preserved).

Delegate to: nextjs-engine-pro

---

## Task 22: Read ?focus=<pk> in ExplorerShell and apply focus + zoom

Goal: when `ExplorerShell` mounts on a URL like `/theseus/explorer?focus=12345`, read the search param via `useSearchParams`, locate the matching `CosmoPoint` by id, and apply a `SceneDirectivePatch` that focuses the node and zooms to it via `GraphAdapter.zoomToNode`.

Files to modify:

- `/Users/travisgilbert/Tech Dev Local/Creative/Website/src/components/theseus/explorer/ExplorerShell.tsx`

Step 1: add the `useSearchParams` import. Add directly above the existing `import { useTheseus } from '@/components/theseus/TheseusShell';`:

```ts
import { useSearchParams } from 'next/navigation';
```

Step 2: extend the existing import of `applySceneDirective` from the cosmograph adapter to also bring in `applySceneDirectivePatch`. Locate the existing line:

```ts
import {
  applySceneDirective,
  readTopologyInterpretation,
} from '@/lib/theseus/cosmograph/adapter';
```

Replace it with:

```ts
import {
  applySceneDirective,
  applySceneDirectivePatch,
  readTopologyInterpretation,
} from '@/lib/theseus/cosmograph/adapter';
```

Step 3: read the param in the component body. Add directly under `const [lens, setLens] = useState<LensId>('flow');`:

```ts
  const searchParams = useSearchParams();
  const focusPk = searchParams?.get('focus') ?? null;
  const focusAppliedRef = useRef<string | null>(null);
```

Step 4: add a new effect that applies a focus patch once per navigation. Place this effect directly under the existing `useEffect` block that subscribes to `explorer:apply-directive`:

```tsx
  // Honor ?focus=<pk> on mount so the Reflex page's "Back to Explorer"
  // link lands on a focused node. Runs once per (focus, points) pair so
  // the user can pan / zoom away after the initial focus without it
  // snapping back. Skips when points are empty (graph still loading).
  useEffect(() => {
    if (!focusPk) return;
    if (points.length === 0) return;
    if (focusAppliedRef.current === focusPk) return;
    const found = points.find((p: CosmoPoint) => String(p.id) === String(focusPk));
    if (!found) return;
    applySceneDirectivePatch(canvasRef.current, {
      focus: { ids: [String(found.id)] },
      camera: { kind: 'zoom', nodeId: String(found.id), durationMs: 800, distanceFactor: 3 },
    });
    setSelectedId(String(found.id));
    focusAppliedRef.current = focusPk;
  }, [focusPk, points]);
```

Verification command:

```bash
cd "/Users/travisgilbert/Tech Dev Local/Creative/Website" && npx tsc --noEmit -p tsconfig.json && npm run lint
```

Acceptance criterion: TypeScript compiles. ESLint passes. Manual smoke (recorded for Stage 4 task 31): visiting `/theseus/explorer?focus=<known-pk>` focuses and zooms to that node on first load.

Delegate to: nextjs-engine-pro

---

## Task 23: Document NEXT_PUBLIC_REFLEX_NODE_DETAIL_URL in .env.local.example

Goal: ensure the new env var is discoverable to anyone setting up a fresh checkout.

Files to modify:

- `/Users/travisgilbert/Tech Dev Local/Creative/Website/.env.local.example`

Append the following block to the end of the file (preserve the existing contents):

```
# Theseus Reflex node detail service. Optional. Defaults to
# https://node.travisgilbert.me when unset. Set to http://localhost:3000
# (or wherever you run reflex_node_detail locally) for local dev.
NEXT_PUBLIC_REFLEX_NODE_DETAIL_URL=https://node.travisgilbert.me
```

If `.env.local.example` does not exist in the Website repo at this path, create it with the block above as its contents.

Verification command:

```bash
grep -c NEXT_PUBLIC_REFLEX_NODE_DETAIL_URL "/Users/travisgilbert/Tech Dev Local/Creative/Website/.env.local.example"
```

Acceptance criterion: prints `1` (one occurrence). The block appears in the file.

Delegate to: nextjs-engine-pro

---

## Stage 2 exit criteria

- `npm run test -- nodeDetailUrl` and `npm run test -- ExplorerShell.dblclick` both pass.
- `npx tsc --noEmit` and `npm run lint` succeed for the Website repo.
- `.env.local.example` contains the new env var documentation.
- Only files listed in this stage are staged for commit (no accidental unrelated edits to ExplorerShell or other files).
