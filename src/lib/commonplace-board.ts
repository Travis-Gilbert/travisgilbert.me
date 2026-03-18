/**
 * Board data types and demo content.
 *
 * Types mirror the planned Django models (Board, PlacedItem,
 * BoardConnection, Frame). Demo data stands in until the
 * backend API is built.
 */

import type { RenderableObject } from '@/components/commonplace/objects/ObjectRenderer';

/* ─────────────────────────────────────────────────
   Core types
   ───────────────────────────────────────────────── */

export interface PlacedItem {
  id: string;
  objectRef: number;
  object: RenderableObject;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  /** ID of parent PlacedItem if stacked */
  stackedOn: string | null;
  /** 'right' or 'bottom' if stacked */
  stackPosition: 'right' | 'bottom' | null;
  /** Timestamp when placed (for recently placed glow) */
  placedAt: number;
}

export type ConnectionSource = 'engine' | 'manual';

export interface BoardConnection {
  id: string;
  fromItemId: string;
  toItemId: string;
  label: string;
  edgeType: 'related' | 'supports' | 'contradicts' | 'derived-from' | 'inspired-by';
  source: ConnectionSource;
  confirmed: boolean;
}

export interface BoardFrame {
  id: string;
  name: string;
  items: PlacedItem[];
  connections: BoardConnection[];
  viewport: ViewportState;
}

export interface ViewportState {
  panX: number;
  panY: number;
  zoom: number;
}

export interface BoardState {
  id: string;
  title: string;
  items: PlacedItem[];
  connections: BoardConnection[];
  frames: BoardFrame[];
  viewport: ViewportState;
}

/* ─────────────────────────────────────────────────
   Demo data
   ───────────────────────────────────────────────── */

const now = Date.now();

const DEMO_OBJECTS: RenderableObject[] = [
  {
    id: 1001,
    slug: 'how-buildings-learn',
    title: 'How Buildings Learn',
    object_type_slug: 'source',
    body: 'Stewart Brand on the six layers of change in buildings.',
    edge_count: 8,
  },
  {
    id: 1002,
    slug: 'governing-the-commons',
    title: 'Governing the Commons',
    object_type_slug: 'source',
    body: 'Elinor Ostrom on self-governance of shared resources.',
    edge_count: 12,
  },
  {
    id: 1003,
    slug: 'buildings-adapt',
    title: "Buildings that adapt outlast buildings that don't",
    object_type_slug: 'hunch',
    body: "Observation from Brand's shearing layers framework.",
    edge_count: 3,
  },
  {
    id: 1004,
    slug: 'stewart-brand',
    title: 'Stewart Brand',
    object_type_slug: 'person',
    body: 'Author, Whole Earth Catalog founder.',
    edge_count: 5,
  },
  {
    id: 1005,
    slug: 'stigmergy',
    title: 'Stigmergy',
    object_type_slug: 'concept',
    body: 'Indirect coordination through environmental traces.',
    edge_count: 4,
  },
  {
    id: 1006,
    slug: 'walkable-software',
    title: 'On walkable software',
    object_type_slug: 'note',
    body: 'Good software has the quality of a walkable city: human scale, discoverable, rewards exploration.',
    edge_count: 1,
  },
];

export const DEMO_BOARD: BoardState = {
  id: 'board-demo-1',
  title: 'Adaptation and Commons',
  items: DEMO_OBJECTS.map((obj, i) => ({
    id: `item-${obj.id}`,
    objectRef: obj.id,
    object: obj,
    x: 80 + (i % 3) * 280,
    y: 80 + Math.floor(i / 3) * 240,
    width: 220,
    height: 160,
    rotation: obj.object_type_slug === 'hunch' ? -0.8 : 0,
    stackedOn: null,
    stackPosition: null,
    placedAt: now - i * 10_000,
  })),
  connections: [
    {
      id: 'conn-1',
      fromItemId: 'item-1001',
      toItemId: 'item-1003',
      label: 'inspired',
      edgeType: 'inspired-by',
      source: 'manual',
      confirmed: true,
    },
    {
      id: 'conn-2',
      fromItemId: 'item-1001',
      toItemId: 'item-1004',
      label: '',
      edgeType: 'related',
      source: 'engine',
      confirmed: false,
    },
    {
      id: 'conn-3',
      fromItemId: 'item-1002',
      toItemId: 'item-1005',
      label: 'shared concept',
      edgeType: 'related',
      source: 'engine',
      confirmed: true,
    },
  ],
  frames: [],
  viewport: { panX: 0, panY: 0, zoom: 1 },
};
