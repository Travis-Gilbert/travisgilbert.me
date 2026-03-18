import { useState, useCallback, useRef } from 'react';

interface DragItem {
  id: string;
  startX: number;
  startY: number;
}

interface DragState {
  isDragging: boolean;
  draggedIds: Set<string>;
  origins: Map<string, { x: number; y: number }>;
  delta: { dx: number; dy: number };
}

interface UseBoardDragStateReturn {
  state: DragState;
  startDrag: (items: DragItem[], clientX: number, clientY: number) => void;
  updateDrag: (clientX: number, clientY: number) => void;
  endDrag: () => { ids: string[]; dx: number; dy: number } | null;
  cancelDrag: () => void;
}

export function useBoardDragState(): UseBoardDragStateReturn {
  const [state, setState] = useState<DragState>({
    isDragging: false,
    draggedIds: new Set(),
    origins: new Map(),
    delta: { dx: 0, dy: 0 },
  });

  const startPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const startDrag = useCallback(
    (items: DragItem[], clientX: number, clientY: number) => {
      startPosRef.current = { x: clientX, y: clientY };
      const origins = new Map<string, { x: number; y: number }>();
      const ids = new Set<string>();
      for (const item of items) {
        origins.set(item.id, { x: item.startX, y: item.startY });
        ids.add(item.id);
      }
      setState({
        isDragging: true,
        draggedIds: ids,
        origins,
        delta: { dx: 0, dy: 0 },
      });
    },
    [],
  );

  const updateDrag = useCallback((clientX: number, clientY: number) => {
    setState((prev) => {
      if (!prev.isDragging) return prev;
      return {
        ...prev,
        delta: {
          dx: clientX - startPosRef.current.x,
          dy: clientY - startPosRef.current.y,
        },
      };
    });
  }, []);

  const endDrag = useCallback(() => {
    let result: { ids: string[]; dx: number; dy: number } | null = null;
    setState((prev) => {
      if (prev.isDragging) {
        result = {
          ids: Array.from(prev.draggedIds),
          dx: prev.delta.dx,
          dy: prev.delta.dy,
        };
      }
      return {
        isDragging: false,
        draggedIds: new Set(),
        origins: new Map(),
        delta: { dx: 0, dy: 0 },
      };
    });
    return result;
  }, []);

  const cancelDrag = useCallback(() => {
    setState({
      isDragging: false,
      draggedIds: new Set(),
      origins: new Map(),
      delta: { dx: 0, dy: 0 },
    });
  }, []);

  return { state, startDrag, updateDrag, endDrag, cancelDrag };
}
