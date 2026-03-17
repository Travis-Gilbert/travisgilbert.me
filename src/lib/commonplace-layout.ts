/**
 * CommonPlace split pane layout: types, serialization, and presets.
 *
 * The layout is a recursive binary tree. Each node is either:
 *   - Leaf: holds an array of tabs (views) and an activeTabIndex
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

export interface PaneTab {
  id: string;
  viewType: ViewType;
  label: string;
  /** Optional context: object ID, notebook slug, filter config */
  context?: Record<string, unknown>;
}

/** Leaf node: a single pane with one or more tabs */
export interface LeafPane {
  type: 'leaf';
  id: string;
  tabs: PaneTab[];
  activeTabIndex: number;
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
  isPreset: boolean;
}

/* ─────────────────────────────────────────────────
   ID generation
   ───────────────────────────────────────────────── */

let paneCounter = 0;

export function generatePaneId(): string {
  paneCounter += 1;
  return `pane-${Date.now()}-${paneCounter}`;
}

export function generateTabId(): string {
  paneCounter += 1;
  return `tab-${Date.now()}-${paneCounter}`;
}

/* ─────────────────────────────────────────────────
   Factory helpers
   ───────────────────────────────────────────────── */

export function createLeaf(viewType: ViewType = 'empty', label?: string): LeafPane {
  return {
    type: 'leaf',
    id: generatePaneId(),
    tabs: [
      {
        id: generateTabId(),
        viewType,
        label: label ?? viewTypeLabel(viewType),
      },
    ],
    activeTabIndex: 0,
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

function viewTypeLabel(viewType: ViewType): string {
  const labels: Record<ViewType, string> = {
    library: 'Library',
    grid: 'All Objects',
    timeline: 'Timeline',
    'scoped-timeline': 'My Timelines',
    network: 'Map',
    notebook: 'Notebook',
    project: 'Project',
    'object-detail': 'Object',
    calendar: 'Calendar',
    resurface: 'Resurface',
    'loose-ends': 'Loose Ends',
    compose: 'Compose',
    'connection-engine': 'Connection Engine',
    'model-view': 'Models',
    reminders: 'Reminders',
    settings: 'Settings',
    'promotion-queue': 'Review Queue',
    'emergent-types': 'Emergent Types',
    'entity-promotions': 'Entity Promotions',
    'notebook-formation': 'Notebook Formation',
    artifacts: 'Artifacts',
    empty: 'Empty',
  };
  return labels[viewType] ?? viewType;
}

/* ─────────────────────────────────────────────────
   Layout presets
   ───────────────────────────────────────────────── */

export const LAYOUT_PRESETS: SavedLayout[] = [
  {
    name: 'Focus',
    isPreset: true,
    tree: {
      type: 'leaf',
      id: 'focus',
      tabs: [{ id: 'library-1', viewType: 'library', label: 'Library' }],
      activeTabIndex: 0,
    },
  },
  {
    name: 'Research',
    isPreset: true,
    tree: {
      type: 'split',
      id: 'research-split',
      direction: 'horizontal',
      ratio: 0.55,
      first: {
        type: 'leaf',
        id: 'research-left',
        tabs: [{ id: 'library-2', viewType: 'library', label: 'Library' }],
        activeTabIndex: 0,
      },
      second: {
        type: 'leaf',
        id: 'research-right',
        tabs: [{ id: 'timeline-1', viewType: 'timeline', label: 'Timeline' }],
        activeTabIndex: 0,
      },
    },
  },
  {
    name: 'Studio',
    isPreset: true,
    tree: {
      type: 'split',
      id: 'studio-split',
      direction: 'horizontal',
      ratio: 0.33,
      first: {
        type: 'leaf',
        id: 'studio-left',
        tabs: [{ id: 'timeline-2', viewType: 'timeline', label: 'Timeline' }],
        activeTabIndex: 0,
      },
      second: {
        type: 'split',
        id: 'studio-right-split',
        direction: 'horizontal',
        ratio: 0.55,
        first: {
          type: 'leaf',
          id: 'studio-center',
          tabs: [{ id: 'compose-1', viewType: 'compose', label: 'Compose' }],
          activeTabIndex: 0,
        },
        second: {
          type: 'leaf',
          id: 'studio-right',
          tabs: [{ id: 'library-3', viewType: 'library', label: 'Library' }],
          activeTabIndex: 0,
        },
      },
    },
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

/** Move a tab within a leaf pane by delta positions (immutable) */
export function moveTab(node: PaneNode, paneId: string, delta: number): PaneNode {
  if (node.id === paneId && node.type === 'leaf') {
    const tabs = [...node.tabs];
    const idx = node.activeTabIndex;
    const newIdx = idx + delta;
    if (newIdx < 0 || newIdx >= tabs.length) return node;
    [tabs[idx], tabs[newIdx]] = [tabs[newIdx], tabs[idx]];
    return { ...node, tabs, activeTabIndex: newIdx };
  }
  if (node.type === 'split') {
    return {
      ...node,
      first: moveTab(node.first, paneId, delta),
      second: moveTab(node.second, paneId, delta),
    };
  }
  return node;
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

/** Add a tab to a leaf pane */
export function addTab(
  tree: PaneNode,
  paneId: string,
  viewType: ViewType,
  label?: string,
  context?: Record<string, unknown>,
): PaneNode {
  if (tree.id === paneId && tree.type === 'leaf') {
    const newTab: PaneTab = {
      id: generateTabId(),
      viewType,
      label: label ?? viewTypeLabel(viewType),
      context,
    };
    return {
      ...tree,
      tabs: [...tree.tabs, newTab],
      activeTabIndex: tree.tabs.length,
    };
  }
  if (tree.type === 'split') {
    return {
      ...tree,
      first: addTab(tree.first, paneId, viewType, label, context),
      second: addTab(tree.second, paneId, viewType, label, context),
    };
  }
  return tree;
}

/** Close a tab in a leaf pane */
export function closeTab(
  tree: PaneNode,
  paneId: string,
  tabIndex: number
): PaneNode {
  if (tree.id === paneId && tree.type === 'leaf') {
    if (tree.tabs.length <= 1) {
      // Last tab: replace with empty (closeTabOrPane handles pane removal)
      return {
        ...tree,
        tabs: [{ id: generateTabId(), viewType: 'empty', label: 'Empty' }],
        activeTabIndex: 0,
      };
    }
    const newTabs = tree.tabs.filter((_, i) => i !== tabIndex);
    const newActive = Math.min(tree.activeTabIndex, newTabs.length - 1);
    return { ...tree, tabs: newTabs, activeTabIndex: newActive };
  }
  if (tree.type === 'split') {
    return {
      ...tree,
      first: closeTab(tree.first, paneId, tabIndex),
      second: closeTab(tree.second, paneId, tabIndex),
    };
  }
  return tree;
}

/** Close a tab; if it was the last tab in a non-root pane, close the pane too */
export function closeTabOrPane(
  tree: PaneNode,
  paneId: string,
  tabIndex: number
): PaneNode {
  const target = findPane(tree, paneId);
  if (!target || target.type !== 'leaf') return tree;

  if (target.tabs.length <= 1) {
    // Last tab: close the entire pane (root falls back to empty leaf)
    return closePane(tree, paneId);
  }
  return closeTab(tree, paneId, tabIndex);
}

/** Set active tab in a leaf pane */
export function setActiveTab(
  tree: PaneNode,
  paneId: string,
  tabIndex: number
): PaneNode {
  if (tree.id === paneId && tree.type === 'leaf') {
    return { ...tree, activeTabIndex: Math.min(tabIndex, tree.tabs.length - 1) };
  }
  if (tree.type === 'split') {
    return {
      ...tree,
      first: setActiveTab(tree.first, paneId, tabIndex),
      second: setActiveTab(tree.second, paneId, tabIndex),
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
    if (parsed && (parsed.type === 'leaf' || parsed.type === 'split')) {
      return parsed as PaneNode;
    }
    return null;
  } catch {
    return null;
  }
}

function leafHasMeaningfulTab(node: LeafPane): boolean {
  return node.tabs.some((tab) => tab.viewType !== 'empty');
}

export function summarizeLayout(node: PaneNode): {
  leafCount: number;
  emptyLeafCount: number;
  meaningfulLeafCount: number;
} {
  if (node.type === 'leaf') {
    const meaningful = leafHasMeaningfulTab(node);
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
  { key: 'w', ctrl: true, label: 'Close Tab', action: 'close-tab' },
  { key: 'w', ctrl: true, shift: true, label: 'Close Pane', action: 'close-pane' },
  { key: 'Tab', ctrl: true, label: 'Next Tab', action: 'next-tab' },
  { key: 'Tab', ctrl: true, shift: true, label: 'Previous Tab', action: 'prev-tab' },
  { key: '1', ctrl: true, alt: true, label: 'Focus Layout', action: 'preset-focus' },
  { key: '2', ctrl: true, alt: true, label: 'Research Layout', action: 'preset-research' },
  { key: '3', ctrl: true, alt: true, label: 'Studio Layout', action: 'preset-studio' },
  { key: '[', alt: true, label: 'Shrink Split', action: 'ratio-shrink' },
  { key: ']', alt: true, label: 'Grow Split', action: 'ratio-grow' },
  { key: 'ArrowLeft', alt: true, shift: true, label: 'Move Tab Left', action: 'move-tab-left' },
  { key: 'ArrowRight', alt: true, shift: true, label: 'Move Tab Right', action: 'move-tab-right' },
];
