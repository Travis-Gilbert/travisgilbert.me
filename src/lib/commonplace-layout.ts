/**
 * CommonPlace split pane layout: types, serialization, and presets.
 *
 * The layout is a recursive binary tree. Each node is either:
 *   - Leaf: holds a single view (viewId) and optional context
 *   - Split: holds two children with a direction and size ratio
 *
 * This tree structure enables arbitrary nesting while remaining
 * trivially JSON-serializable for saved layouts.
 */

import type { ViewType } from '@/lib/commonplace';

/* ─────────────────────────────────────────────────
   Core types
   ───────────────────────────────────────────────── */

export type SplitDirection = 'horizontal' | 'vertical';

/** Leaf node: a single pane displaying one view */
export interface LeafPane {
  type: 'leaf';
  id: string;
  viewId: ViewType;
  context?: Record<string, unknown>;
}

/** Split node: two children separated by a drag handle */
export interface SplitPane {
  type: 'split';
  id: string;
  direction: SplitDirection;
  /** First child's share as a fraction (0.0 to 1.0). Second gets the rest. */
  ratio: number;
  first: PaneNode;
  second: PaneNode;
}

export type PaneNode = LeafPane | SplitPane;

/** Serialized layout for persistence */
export interface SavedLayout {
  name: string;
  tree: PaneNode;
}

/* ─────────────────────────────────────────────────
   ID generation
   ───────────────────────────────────────────────── */

let paneCounter = 0;

export function generatePaneId(): string {
  paneCounter += 1;
  return `pane-${Date.now()}-${paneCounter}`;
}

/* ─────────────────────────────────────────────────
   Factory helpers
   ───────────────────────────────────────────────── */

export function createLeaf(viewType: ViewType = 'empty', context?: Record<string, unknown>): LeafPane {
  return {
    type: 'leaf',
    id: generatePaneId(),
    viewId: viewType,
    context,
  };
}

export function createSplit(
  direction: SplitDirection,
  first: PaneNode,
  second: PaneNode,
  ratio = 0.5
): SplitPane {
  return {
    type: 'split',
    id: generatePaneId(),
    direction,
    ratio,
    first,
    second,
  };
}

/* ─────────────────────────────────────────────────
   Layout presets
   ───────────────────────────────────────────────── */

export const LAYOUT_PRESETS: SavedLayout[] = [
  {
    name: 'Focus',
    tree: createLeaf('timeline'),
  },
  {
    name: 'Research',
    tree: createSplit('horizontal', createLeaf('timeline'), createLeaf('network'), 0.55),
  },
  {
    name: 'Studio',
    tree: createSplit('horizontal', createLeaf('compose'), createLeaf('timeline'), 0.55),
  },
];

/* ─────────────────────────────────────────────────
   Tree traversal and mutation
   ───────────────────────────────────────────────── */

/** Find a pane by ID in the tree */
export function findPane(node: PaneNode, id: string): PaneNode | null {
  if (node.id === id) return node;
  if (node.type === 'split') {
    return findPane(node.first, id) ?? findPane(node.second, id);
  }
  return null;
}

/** Find the nearest ancestor SplitPane containing the given pane ID */
export function findParentSplit(node: PaneNode, childId: string): (PaneNode & { type: 'split' }) | null {
  if (node.type !== 'split') return null;
  if (node.first.id === childId || node.second.id === childId) return node as PaneNode & { type: 'split' };
  return findParentSplit(node.first, childId) ?? findParentSplit(node.second, childId);
}

/** Replace a pane by ID, returning a new tree (immutable) */
export function replacePane(
  node: PaneNode,
  id: string,
  replacement: PaneNode
): PaneNode {
  if (node.id === id) return replacement;
  if (node.type === 'split') {
    return {
      ...node,
      first: replacePane(node.first, id, replacement),
      second: replacePane(node.second, id, replacement),
    };
  }
  return node;
}

/** Replace the view in a specific leaf pane (immutable) */
export function replaceView(
  tree: PaneNode,
  paneId: string,
  viewId: ViewType,
  context?: Record<string, unknown>,
): PaneNode {
  if (tree.type === 'leaf') {
    if (tree.id === paneId) {
      return { ...tree, viewId, context };
    }
    return tree;
  }
  return {
    ...tree,
    first: replaceView(tree.first, paneId, viewId, context),
    second: replaceView(tree.second, paneId, viewId, context),
  };
}

/** Find the first leaf pane displaying a given view type */
export function findLeafWithView(
  node: PaneNode,
  viewId: ViewType,
): LeafPane | null {
  if (node.type === 'leaf') {
    return node.viewId === viewId ? node : null;
  }
  return findLeafWithView(node.first, viewId) ?? findLeafWithView(node.second, viewId);
}

/** Split an existing leaf pane into two */
export function splitLeaf(
  tree: PaneNode,
  paneId: string,
  direction: SplitDirection,
  newViewType: ViewType = 'empty'
): PaneNode {
  const target = findPane(tree, paneId);
  if (!target || target.type !== 'leaf') return tree;

  const newLeaf = createLeaf(newViewType);
  const split = createSplit(direction, target, newLeaf);
  return replacePane(tree, paneId, split);
}

/** Close a pane: remove it from its parent split, promote the sibling */
export function closePane(tree: PaneNode, paneId: string): PaneNode {
  if (tree.id === paneId) {
    // Can't close the root; return empty leaf
    return createLeaf('empty');
  }
  if (tree.type === 'split') {
    if (tree.first.id === paneId) return tree.second;
    if (tree.second.id === paneId) return tree.first;
    return {
      ...tree,
      first: closePane(tree.first, paneId),
      second: closePane(tree.second, paneId),
    };
  }
  return tree;
}

/** Update a split's ratio */
export function updateRatio(
  tree: PaneNode,
  splitId: string,
  ratio: number
): PaneNode {
  if (tree.id === splitId && tree.type === 'split') {
    return { ...tree, ratio: Math.max(0.15, Math.min(0.85, ratio)) };
  }
  if (tree.type === 'split') {
    return {
      ...tree,
      first: updateRatio(tree.first, splitId, ratio),
      second: updateRatio(tree.second, splitId, ratio),
    };
  }
  return tree;
}

/** Collect all leaf IDs in the tree */
export function collectLeafIds(node: PaneNode): string[] {
  if (node.type === 'leaf') return [node.id];
  return [...collectLeafIds(node.first), ...collectLeafIds(node.second)];
}

/** Find an adjacent leaf pane (sibling) for "open in other pane" behavior */
export function findAdjacentLeaf(tree: PaneNode, fromPaneId: string): string | null {
  const leafIds = collectLeafIds(tree);
  const idx = leafIds.indexOf(fromPaneId);
  if (leafIds.length < 2) return null;
  return leafIds[idx + 1] ?? leafIds[idx - 1] ?? null;
}

/* ─────────────────────────────────────────────────
   Serialization (safe for localStorage / API)
   ───────────────────────────────────────────────── */

export function serializeLayout(tree: PaneNode): string {
  return JSON.stringify(tree);
}

export function deserializeLayout(json: string): PaneNode | null {
  try {
    const parsed = JSON.parse(json);
    if (!parsed || (parsed.type !== 'leaf' && parsed.type !== 'split')) {
      return null;
    }
    // Reject old tab-based layouts (force migration to v6)
    if (parsed.type === 'leaf' && Array.isArray(parsed.tabs)) {
      return null;
    }
    return parsed as PaneNode;
  } catch {
    return null;
  }
}

export function summarizeLayout(node: PaneNode): {
  leafCount: number;
  emptyLeafCount: number;
  meaningfulLeafCount: number;
} {
  if (node.type === 'leaf') {
    const meaningful = node.viewId !== 'empty';
    return {
      leafCount: 1,
      emptyLeafCount: meaningful ? 0 : 1,
      meaningfulLeafCount: meaningful ? 1 : 0,
    };
  }

  const first = summarizeLayout(node.first);
  const second = summarizeLayout(node.second);
  return {
    leafCount: first.leafCount + second.leafCount,
    emptyLeafCount: first.emptyLeafCount + second.emptyLeafCount,
    meaningfulLeafCount: first.meaningfulLeafCount + second.meaningfulLeafCount,
  };
}

export function shouldDiscardPersistedLayout(node: PaneNode): boolean {
  const summary = summarizeLayout(node);

  if (summary.meaningfulLeafCount === 0) return true;
  if (summary.emptyLeafCount >= 3) return true;

  return summary.leafCount >= 4 && summary.emptyLeafCount >= summary.meaningfulLeafCount;
}

/* ─────────────────────────────────────────────────
   Keyboard shortcut definitions
   ───────────────────────────────────────────────── */

export interface KeyBinding {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  label: string;
  action: string;
}

export const KEY_BINDINGS: KeyBinding[] = [
  { key: '\\', ctrl: true, label: 'Split Horizontal', action: 'split-horizontal' },
  { key: '-', ctrl: true, label: 'Split Vertical', action: 'split-vertical' },
  { key: 'w', ctrl: true, label: 'Close Pane', action: 'close-pane' },
  { key: '1', ctrl: true, alt: true, label: 'Focus Layout', action: 'preset-focus' },
  { key: '2', ctrl: true, alt: true, label: 'Research Layout', action: 'preset-research' },
  { key: '3', ctrl: true, alt: true, label: 'Studio Layout', action: 'preset-studio' },
  { key: '[', alt: true, label: 'Shrink Split', action: 'ratio-shrink' },
  { key: ']', alt: true, label: 'Grow Split', action: 'ratio-grow' },
];
