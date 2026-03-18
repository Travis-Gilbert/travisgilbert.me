import { useCallback, useEffect } from 'react';

interface BoardItem {
  id: string;
  x: number;
  y: number;
}

interface UseBoardKeyboardNavOptions {
  items: BoardItem[];
  focusedId: string | null;
  onFocusItem: (id: string) => void;
  onOpenContextMenu: (id: string) => void;
  onToggleDrag: (id: string) => void;
  onStartConnect: (id: string) => void;
  isCanvasFocused: boolean;
}

export function useBoardKeyboardNav({
  items,
  focusedId,
  onFocusItem,
  onOpenContextMenu,
  onToggleDrag,
  onStartConnect,
  isCanvasFocused,
}: UseBoardKeyboardNavOptions) {
  const findNearest = useCallback(
    (direction: 'up' | 'down' | 'left' | 'right') => {
      if (!focusedId) return null;
      const current = items.find((i) => i.id === focusedId);
      if (!current) return null;

      const candidates = items.filter((item) => {
        if (item.id === focusedId) return false;
        switch (direction) {
          case 'up':
            return item.y < current.y;
          case 'down':
            return item.y > current.y;
          case 'left':
            return item.x < current.x;
          case 'right':
            return item.x > current.x;
        }
      });

      if (candidates.length === 0) return null;

      return candidates.reduce((nearest, item) => {
        const distA =
          Math.abs(nearest.x - current.x) + Math.abs(nearest.y - current.y);
        const distB =
          Math.abs(item.x - current.x) + Math.abs(item.y - current.y);
        return distB < distA ? item : nearest;
      });
    },
    [items, focusedId],
  );

  useEffect(() => {
    if (!isCanvasFocused) return;

    const handler = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowUp':
        case 'ArrowDown':
        case 'ArrowLeft':
        case 'ArrowRight': {
          e.preventDefault();
          const dir = e.key.replace('Arrow', '').toLowerCase() as
            | 'up'
            | 'down'
            | 'left'
            | 'right';
          const nearest = findNearest(dir);
          if (nearest) onFocusItem(nearest.id);
          break;
        }
        case 'Enter':
          if (focusedId) {
            e.preventDefault();
            onOpenContextMenu(focusedId);
          }
          break;
        case ' ':
          if (focusedId) {
            e.preventDefault();
            onToggleDrag(focusedId);
          }
          break;
        case 'c':
        case 'C':
          if (focusedId && !e.metaKey && !e.ctrlKey) {
            e.preventDefault();
            onStartConnect(focusedId);
          }
          break;
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [
    isCanvasFocused,
    focusedId,
    findNearest,
    onFocusItem,
    onOpenContextMenu,
    onToggleDrag,
    onStartConnect,
  ]);
}
