'use client';

import { useState, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { Plus, Xmark } from 'iconoir-react';
import type { PlacedItem, BoardConnection, ViewportState, BoardFrame } from '@/lib/commonplace-board';
import { DEMO_BOARD } from '@/lib/commonplace-board';
import { getObjectTypeIdentity } from '@/lib/commonplace';
import BoardCanvas from './BoardCanvas';

/**
 * Catalog lookup: maps numeric IDs and string component IDs to
 * RenderableObjects for creating PlacedItems on drop.
 *
 * Currently draws from DEMO_BOARD objects. When the API is wired,
 * this will be replaced by a fetch call or context lookup.
 */
const CATALOG_OBJECTS = new Map(
  DEMO_BOARD.items.map((item) => [String(item.objectRef), item.object]),
);

interface BoardViewProps {
  paneId?: string;
}

export default function BoardView({ paneId }: BoardViewProps) {
  const [items, setItems] = useState<PlacedItem[]>(DEMO_BOARD.items);
  const [connections, setConnections] = useState<BoardConnection[]>(DEMO_BOARD.connections);
  const [viewport, setViewport] = useState<ViewportState>(DEMO_BOARD.viewport);
  const [frames, setFrames] = useState<BoardFrame[]>([]);
  const [activeFrameId, setActiveFrameId] = useState<string | null>(null);

  /** Set of objectRef IDs currently placed on the board */
  const placedObjectIds = useMemo(
    () => new Set(items.map((i) => i.objectRef)),
    [items],
  );

  /** Set of connection pairs for duplicate detection (sorted so A-B === B-A) */
  const connectionPairKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const conn of connections) {
      const sorted = [conn.fromItemId, conn.toItemId].sort().join('::');
      keys.add(sorted);
    }
    return keys;
  }, [connections]);

  const handleItemMove = useCallback((itemId: string, x: number, y: number) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, x, y } : item,
      ),
    );
  }, []);

  /**
   * Handle a catalog item being dropped onto the canvas.
   * Creates a new PlacedItem at the drop coordinates.
   * If the object is already on the board, shows a notice instead.
   */
  const handleCatalogDrop = useCallback(
    (catalogId: string, x: number, y: number) => {
      const object = CATALOG_OBJECTS.get(catalogId);
      if (!object) {
        toast.error('Object not found in catalog');
        return;
      }

      /* Prevent duplicate placement */
      if (placedObjectIds.has(object.id)) {
        toast('Already on the board', {
          description: object.title,
        });
        return;
      }

      const typeIdentity = getObjectTypeIdentity(object.object_type_slug);
      const isHunch = object.object_type_slug === 'hunch';

      const newItem: PlacedItem = {
        id: `item-${object.id}-${Date.now()}`,
        objectRef: object.id,
        object,
        x: x - 110, /* center the 220px card on the drop point */
        y: y - 80,  /* center vertically on the drop point */
        width: 220,
        height: 160,
        rotation: isHunch ? -0.8 : 0,
        stackedOn: null,
        stackPosition: null,
        placedAt: Date.now(),
      };

      setItems((prev) => [...prev, newItem]);
      toast.success(`Placed "${object.title}"`, {
        description: typeIdentity.label,
      });
    },
    [placedObjectIds],
  );

  /**
   * Handle connect-on-drop: create a manual BoardConnection between
   * two placed items. Prevents duplicate connections (treats A-B and
   * B-A as the same pair).
   */
  const handleConnect = useCallback(
    (fromItemId: string, toItemId: string) => {
      /* Duplicate check (order-independent) */
      const pairKey = [fromItemId, toItemId].sort().join('::');
      if (connectionPairKeys.has(pairKey)) {
        const fromItem = items.find((i) => i.id === fromItemId);
        const toItem = items.find((i) => i.id === toItemId);
        toast('Already connected', {
          description: `${fromItem?.object.title ?? 'Item'} and ${toItem?.object.title ?? 'Item'}`,
        });
        return;
      }

      const newConnection: BoardConnection = {
        id: `conn-manual-${Date.now()}`,
        fromItemId,
        toItemId,
        label: '',
        edgeType: 'related',
        source: 'manual',
        confirmed: true,
      };

      setConnections((prev) => [...prev, newConnection]);

      const fromItem = items.find((i) => i.id === fromItemId);
      const toItem = items.find((i) => i.id === toItemId);

      toast.success('Connected', {
        description: `${fromItem?.object.title ?? 'Item'} and ${toItem?.object.title ?? 'Item'}`,
      });
    },
    [connectionPairKeys, items],
  );

  const handleSaveFrame = useCallback(() => {
    const name = `Frame ${frames.length + 1}`;
    const frame: BoardFrame = {
      id: `frame-${Date.now()}`,
      name,
      items: items.map((i) => ({ ...i })),
      connections: [...connections],
      viewport: { ...viewport },
    };
    setFrames((prev) => [...prev, frame]);
    setActiveFrameId(frame.id);
    toast.success(`Saved "${name}"`);
  }, [items, connections, viewport, frames.length]);

  const handleLoadFrame = useCallback((frame: BoardFrame) => {
    setItems(frame.items);
    setActiveFrameId(frame.id);
    toast(`Loaded "${frame.name}"`);
  }, []);

  const handleDeleteFrame = useCallback((frameId: string) => {
    setFrames((prev) => prev.filter((f) => f.id !== frameId));
    if (activeFrameId === frameId) setActiveFrameId(null);
  }, [activeFrameId]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      {/* Tab strip */}
      <div
        style={{
          height: 36,
          backgroundColor: 'var(--cp-chrome)',
          borderBottom: '1px solid var(--cp-chrome-line)',
          display: 'flex',
          alignItems: 'stretch',
          flexShrink: 0,
          overflow: 'hidden',
        }}
      >
        {/* Board tab */}
        <button
          type="button"
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '0 16px',
            border: 'none',
            borderBottom: activeFrameId === null
              ? '2px solid var(--cp-red)'
              : '2px solid transparent',
            backgroundColor: activeFrameId === null ? 'var(--cp-chrome-raise)' : 'transparent',
            cursor: 'pointer',
            fontFamily: 'var(--cp-font-title)',
            fontSize: 15,
            fontWeight: 600,
            color: activeFrameId === null ? 'var(--cp-chrome-text)' : 'var(--cp-chrome-dim)',
            whiteSpace: 'nowrap',
          }}
          onClick={() => {
            setActiveFrameId(null);
            setItems(DEMO_BOARD.items);
          }}
        >
          Board
        </button>

        {/* Frame tabs */}
        {frames.map((frame) => (
          <div
            key={frame.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '0 12px',
              borderBottom: activeFrameId === frame.id
                ? '2px solid #C49A4A'
                : '2px solid transparent',
              backgroundColor: activeFrameId === frame.id ? 'var(--cp-chrome-raise)' : 'transparent',
              cursor: 'pointer',
            }}
            onClick={() => handleLoadFrame(frame)}
          >
            <span
              style={{
                fontFamily: 'var(--cp-font-title)',
                fontSize: 14,
                fontWeight: 500,
                color: activeFrameId === frame.id ? 'var(--cp-chrome-text)' : 'var(--cp-chrome-dim)',
              }}
            >
              {frame.name}
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteFrame(frame.id);
              }}
              style={{
                width: 16,
                height: 16,
                borderRadius: 3,
                border: 'none',
                background: 'transparent',
                color: 'var(--cp-chrome-dim)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0,
              }}
            >
              <Xmark width={10} height={10} strokeWidth={2} />
            </button>
          </div>
        ))}

        {/* Add frame */}
        <button
          type="button"
          onClick={handleSaveFrame}
          title="Save current layout as a frame"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 32,
            border: 'none',
            background: 'transparent',
            color: 'var(--cp-chrome-dim)',
            cursor: 'pointer',
          }}
        >
          <Plus width={14} height={14} strokeWidth={1.5} />
        </button>

        <div style={{ flex: 1 }} />

        {/* Stats */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '0 14px',
            fontFamily: 'var(--font-metadata)',
            fontSize: 10,
            color: 'var(--cp-chrome-dim)',
            letterSpacing: '0.04em',
          }}
        >
          {items.length} objects · {connections.length} connections
        </div>
      </div>

      {/* Canvas */}
      <div style={{ flex: 1, position: 'relative' }}>
        <BoardCanvas
          items={items}
          connections={connections}
          viewport={viewport}
          onViewportChange={setViewport}
          onItemMove={handleItemMove}
          onCatalogDrop={handleCatalogDrop}
          onConnect={handleConnect}
        />
      </div>
    </div>
  );
}
