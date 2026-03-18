'use client';

import { useState, useCallback } from 'react';
import type { PlacedItem, BoardConnection, ViewportState } from '@/lib/commonplace-board';
import { DEMO_BOARD } from '@/lib/commonplace-board';
import BoardCanvas from './BoardCanvas';

interface BoardViewProps {
  paneId?: string;
}

export default function BoardView({ paneId }: BoardViewProps) {
  const [items, setItems] = useState<PlacedItem[]>(DEMO_BOARD.items);
  const [connections] = useState<BoardConnection[]>(DEMO_BOARD.connections);
  const [viewport, setViewport] = useState<ViewportState>(DEMO_BOARD.viewport);

  const handleItemMove = useCallback((itemId: string, x: number, y: number) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, x, y } : item,
      ),
    );
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
