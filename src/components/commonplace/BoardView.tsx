'use client';

import { useState, useCallback, useMemo, useRef } from 'react';
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

  /**
   * Snapshot of the main board state. When switching to a frame tab,
   * the current items/connections/viewport are saved here so they can
   * be restored when the user clicks back to the "Board" tab.
   */
  const mainBoardSnapshot = useRef<{
    items: PlacedItem[];
    connections: BoardConnection[];
    viewport: ViewportState;
  }>({
    items: DEMO_BOARD.items,
    connections: DEMO_BOARD.connections,
    viewport: DEMO_BOARD.viewport,
  });

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
   */
  const handleCatalogDrop = useCallback(
    (catalogId: string, x: number, y: number) => {
      const object = CATALOG_OBJECTS.get(catalogId);
      if (!object) {
        toast.error('Object not found in catalog');
        return;
      }

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
        x: x - 110,
        y: y - 80,
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
   * Handle connect-on-drop: create a manual BoardConnection.
   */
  const handleConnect = useCallback(
    (fromItemId: string, toItemId: string) => {
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

  /**
   * Switch to the main board tab. Saves the current frame state back
   * to the frames array (if a frame is active), then restores the
   * main board snapshot.
   */
  const handleSwitchToBoard = useCallback(() => {
    if (activeFrameId) {
      /* Save current edits back to the active frame before switching */
      setFrames((prev) =>
        prev.map((f) =>
          f.id === activeFrameId
            ? { ...f, items: items.map((i) => ({ ...i })), connections: [...connections], viewport: { ...viewport } }
            : f,
        ),
      );
    }

    /* Restore the main board snapshot */
    setItems(mainBoardSnapshot.current.items);
    setConnections(mainBoardSnapshot.current.connections);
    setViewport(mainBoardSnapshot.current.viewport);
    setActiveFrameId(null);
  }, [activeFrameId, items, connections, viewport]);

  /**
   * Save the current board state as a new frame. The frame gets a
   * deep copy of the current items/connections/viewport.
   */
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

    /* If we were on the main board, snapshot it before switching */
    if (!activeFrameId) {
      mainBoardSnapshot.current = {
        items: items.map((i) => ({ ...i })),
        connections: [...connections],
        viewport: { ...viewport },
      };
    }

    setActiveFrameId(frame.id);
    toast.success(`Saved "${name}"`);
  }, [items, connections, viewport, frames.length, activeFrameId]);

  /**
   * Load a frame tab. Saves the current state first (to main board
   * snapshot or back to the active frame), then loads the target frame.
   */
  const handleLoadFrame = useCallback((frame: BoardFrame) => {
    /* Save current state before switching */
    if (!activeFrameId) {
      /* Currently on main board: snapshot it */
      mainBoardSnapshot.current = {
        items: items.map((i) => ({ ...i })),
        connections: [...connections],
        viewport: { ...viewport },
      };
    } else {
      /* Currently on another frame: save edits back */
      setFrames((prev) =>
        prev.map((f) =>
          f.id === activeFrameId
            ? { ...f, items: items.map((i) => ({ ...i })), connections: [...connections], viewport: { ...viewport } }
            : f,
        ),
      );
    }

    setItems(frame.items.map((i) => ({ ...i })));
    setConnections([...frame.connections]);
    setViewport({ ...frame.viewport });
    setActiveFrameId(frame.id);
    toast(`Loaded "${frame.name}"`);
  }, [activeFrameId, items, connections, viewport]);

  const handleDeleteFrame = useCallback((frameId: string) => {
    setFrames((prev) => prev.filter((f) => f.id !== frameId));
    /* If deleting the active frame, switch back to main board */
    if (activeFrameId === frameId) {
      setItems(mainBoardSnapshot.current.items);
      setConnections(mainBoardSnapshot.current.connections);
      setViewport(mainBoardSnapshot.current.viewport);
      setActiveFrameId(null);
    }
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
          onClick={handleSwitchToBoard}
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
