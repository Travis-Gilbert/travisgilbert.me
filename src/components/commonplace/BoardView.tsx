'use client';

import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { BookmarkBook } from 'iconoir-react';
import type { PlacedItem, BoardConnection, ViewportState, BoardFrame } from '@/lib/commonplace-board';
import { DEMO_BOARD } from '@/lib/commonplace-board';
import BoardCanvas from './BoardCanvas';

interface BoardViewProps {
  paneId?: string;
}

export default function BoardView({ paneId }: BoardViewProps) {
  const [items, setItems] = useState<PlacedItem[]>(DEMO_BOARD.items);
  const [connections] = useState<BoardConnection[]>(DEMO_BOARD.connections);
  const [viewport, setViewport] = useState<ViewportState>(DEMO_BOARD.viewport);
  const [frames, setFrames] = useState<BoardFrame[]>([]);

  const handleItemMove = useCallback((itemId: string, x: number, y: number) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, x, y } : item,
      ),
    );
  }, []);

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
    toast.success(`Saved "${name}"`);
  }, [items, connections, viewport, frames.length]);

  const handleLoadFrame = useCallback((frame: BoardFrame) => {
    setItems(frame.items);
    toast(`Loaded "${frame.name}"`);
  }, []);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      {/* Board title bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          borderBottom: '1px solid var(--cp-border-faint)',
          backgroundColor: 'rgba(244, 243, 240, 0.5)',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            fontFamily: 'var(--cp-font-title)',
            fontSize: 15,
            color: '#2A2420',
          }}
        >
          {DEMO_BOARD.title}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Saved frames */}
          {frames.length > 0 && (
            <div style={{ display: 'flex', gap: 4 }}>
              {frames.map((frame) => (
                <button
                  key={frame.id}
                  type="button"
                  onClick={() => handleLoadFrame(frame)}
                  style={{
                    padding: '2px 8px',
                    borderRadius: 4,
                    border: '1px solid rgba(196, 154, 74, 0.3)',
                    backgroundColor: 'transparent',
                    color: '#C49A4A',
                    fontFamily: 'var(--font-metadata)',
                    fontSize: 10,
                    cursor: 'pointer',
                    letterSpacing: '0.04em',
                  }}
                >
                  {frame.name}
                </button>
              ))}
            </div>
          )}

          {/* Save frame button */}
          <button
            type="button"
            onClick={handleSaveFrame}
            title="Save current layout as a frame"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '3px 8px',
              borderRadius: 4,
              border: '1px solid rgba(42, 36, 32, 0.15)',
              backgroundColor: 'transparent',
              color: 'rgba(42, 36, 32, 0.5)',
              fontFamily: 'var(--font-metadata)',
              fontSize: 10,
              cursor: 'pointer',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}
          >
            <BookmarkBook width={12} height={12} strokeWidth={1.5} />
            Save Frame
          </button>

          {/* Stats */}
          <div
            style={{
              fontFamily: 'var(--font-metadata)',
              fontSize: 10,
              color: 'rgba(42, 36, 32, 0.4)',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
            }}
          >
            {items.length} objects, {connections.length} connections
          </div>
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
        />
      </div>
    </div>
  );
}
