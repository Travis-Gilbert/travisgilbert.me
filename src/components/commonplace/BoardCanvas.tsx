'use client';

import {
  useState,
  useCallback,
  useRef,
  useEffect,
  type WheelEvent as ReactWheelEvent,
} from 'react';
import type { PlacedItem, BoardConnection, ViewportState } from '@/lib/commonplace-board';
import { getObjectTypeIdentity } from '@/lib/commonplace';
import { useCommonPlace } from '@/lib/commonplace-context';
import { useCardElevation } from '@/hooks/useCardElevation';
import { useRecentlyPlaced } from '@/hooks/useRecentlyPlaced';
import ConnectionBadge from './ConnectionBadge';
import EngineRelevancePip from './EngineRelevancePip';
import DragGhost from './DragGhost';

/* -----------------------------------------------
   Constants
   ----------------------------------------------- */

const GRID_SIZE = 48;
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.04;

/* -----------------------------------------------
   Placed card: warm parchment tint-wash style
   ----------------------------------------------- */

interface PlacedCardProps {
  item: PlacedItem;
  isSelected: boolean;
  isDragging: boolean;
  engineRelevantIds: Set<number>;
  onMouseDown: (e: React.MouseEvent, item: PlacedItem) => void;
  onContextMenu: (e: React.MouseEvent, item: PlacedItem) => void;
  onClick: (e: React.MouseEvent, item: PlacedItem) => void;
}

function PlacedCard({
  item,
  isSelected,
  isDragging,
  engineRelevantIds,
  onMouseDown,
  onContextMenu,
  onClick,
}: PlacedCardProps) {
  const { shadow } = useCardElevation(item.object.edge_count ?? 0);
  const glowClass = useRecentlyPlaced(item.placedAt);
  const typeIdentity = getObjectTypeIdentity(item.object.object_type_slug);
  const isHunch = item.object.object_type_slug === 'hunch';
  const isConcept = item.object.object_type_slug === 'concept';

  return (
    <div
      data-board-item
      data-selected={isSelected || undefined}
      data-dragging={isDragging || undefined}
      data-hunch={isHunch || undefined}
      draggable={false}
      tabIndex={0}
      className={glowClass ?? undefined}
      style={{
        position: 'absolute',
        left: item.x,
        top: item.y,
        width: item.width,
        transform: item.rotation ? `rotate(${item.rotation}deg)` : undefined,
        boxShadow: isDragging ? undefined : shadow,
        zIndex: isDragging ? 100 : 2,
        cursor: isDragging ? 'grabbing' : 'grab',
      }}
      onMouseDown={(e) => onMouseDown(e, item)}
      onContextMenu={(e) => onContextMenu(e, item)}
      onClick={(e) => onClick(e, item)}
    >
      {/* Tint-wash card body */}
      <div
        style={{
          position: 'relative',
          padding: '10px 12px',
          borderRadius: isConcept ? 16 : isHunch ? 3 : 6,
          backgroundColor: `color-mix(in srgb, ${typeIdentity.color} ${isSelected ? 10 : 6}%, transparent)`,
          border: `1px solid ${isSelected
            ? `color-mix(in srgb, ${typeIdentity.color} 30%, transparent)`
            : `color-mix(in srgb, ${typeIdentity.color} 8%, transparent)`
          }`,
          transition: 'background-color 200ms, border-color 200ms',
          overflow: 'hidden',
        }}
      >
        {/* Type kicker */}
        <div
          style={{
            fontFamily: 'var(--font-metadata)',
            fontSize: 8,
            fontWeight: 600,
            letterSpacing: '0.06em',
            color: typeIdentity.color,
            textTransform: 'uppercase',
            marginBottom: 4,
          }}
        >
          {typeIdentity.label}
        </div>

        {/* Title */}
        <div
          style={{
            fontFamily: 'var(--cp-font-body, system-ui)',
            fontSize: 13,
            fontWeight: 600,
            fontStyle: isHunch ? 'italic' : undefined,
            color: '#2A2420',
            lineHeight: 1.3,
            marginBottom: 3,
          }}
        >
          {item.object.title}
        </div>

        {/* Body preview */}
        {item.object.body && (
          <div
            style={{
              fontFamily: 'var(--cp-font-body, system-ui)',
              fontSize: 10.5,
              color: '#5C564E',
              lineHeight: 1.4,
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
            }}
          >
            {item.object.body}
          </div>
        )}

        <ConnectionBadge
          count={item.object.edge_count ?? 0}
          typeColor={typeIdentity.color}
        />
        <EngineRelevancePip
          isRelevant={engineRelevantIds.has(item.object.id)}
        />
      </div>
    </div>
  );
}

/* -----------------------------------------------
   Connection renderer with hover hit areas
   ----------------------------------------------- */

interface ConnectionLinesProps {
  connections: BoardConnection[];
  items: PlacedItem[];
  hoveredId: string | null;
  onHover: (id: string | null) => void;
}

function ConnectionLines({ connections, items, hoveredId, onHover }: ConnectionLinesProps) {
  const itemMap = new Map(items.map((i) => [i.id, i]));

  return (
    <svg
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        overflow: 'visible',
      }}
    >
      {connections.map((conn) => {
        const from = itemMap.get(conn.fromItemId);
        const to = itemMap.get(conn.toItemId);
        if (!from || !to) return null;

        const x1 = from.x + from.width / 2;
        const y1 = from.y + (from.height ?? 160) / 2;
        const x2 = to.x + to.width / 2;
        const y2 = to.y + (to.height ?? 160) / 2;

        const isEngine = conn.source === 'engine';
        const color = isEngine ? '#2D5F6B' : '#B8623D';
        const isHovered = hoveredId === conn.id;
        const opacity = isHovered ? 0.7 : conn.confirmed ? 0.4 : 0.25;
        const strokeDash = conn.confirmed ? undefined : '4 4';
        const strokeWidth = conn.confirmed ? 1.5 : 1;

        let d: string;
        if (isEngine) {
          const midY = (y1 + y2) / 2;
          d = `M ${x1} ${y1} L ${x1} ${midY} L ${x2} ${midY} L ${x2} ${y2}`;
        } else {
          const cpx = (x1 + x2) / 2 + (y2 - y1) * 0.15;
          const cpy = (y1 + y2) / 2;
          d = `M ${x1} ${y1} Q ${cpx} ${cpy} ${x2} ${y2}`;
        }

        return (
          <g key={conn.id}>
            {/* Invisible wide hit area */}
            <path
              d={d}
              stroke="transparent"
              strokeWidth={16}
              fill="none"
              style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
              onMouseEnter={() => onHover(conn.id)}
              onMouseLeave={() => onHover(null)}
            />
            {/* Shadow stroke for manual connections */}
            {!isEngine && (
              <path
                d={d}
                stroke={color}
                strokeWidth={0.5}
                strokeOpacity={0.18}
                fill="none"
              />
            )}
            {/* Primary stroke */}
            <path
              d={d}
              stroke={color}
              strokeWidth={isHovered ? strokeWidth + 0.5 : strokeWidth}
              strokeDasharray={strokeDash}
              strokeOpacity={opacity}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Label */}
            {conn.label && (
              <text
                x={(x1 + x2) / 2}
                y={(y1 + y2) / 2 - 6}
                fill={color}
                fillOpacity={isHovered ? 0.8 : 0.5}
                fontSize={9}
                fontFamily="var(--font-metadata)"
                fontStyle="italic"
                textAnchor="middle"
              >
                {conn.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/* -----------------------------------------------
   Empty state
   ----------------------------------------------- */

function BoardEmptyState() {
  return (
    <div
      style={{
        position: 'absolute',
        top: '40%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        textAlign: 'center',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: 12,
          border: '2px dashed rgba(45, 95, 107, 0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 16px',
          fontSize: 28,
          color: 'rgba(45, 95, 107, 0.3)',
        }}
      >
        +
      </div>
      <div
        style={{
          fontFamily: 'var(--font-metadata)',
          fontSize: 12,
          color: 'rgba(42, 36, 32, 0.35)',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
        }}
      >
        Drag objects from the sidebar to begin
      </div>
    </div>
  );
}

/* -----------------------------------------------
   Main canvas
   ----------------------------------------------- */

interface BoardCanvasProps {
  items: PlacedItem[];
  connections: BoardConnection[];
  viewport: ViewportState;
  onViewportChange: (v: ViewportState) => void;
  onItemMove: (itemId: string, x: number, y: number) => void;
  /** Called when a catalog item is dropped onto the canvas */
  onCatalogDrop?: (catalogId: string, x: number, y: number) => void;
  engineRelevantIds?: Set<number>;
}

export default function BoardCanvas({
  items,
  connections,
  viewport,
  onViewportChange,
  onItemMove,
  onCatalogDrop,
  engineRelevantIds = new Set(),
}: BoardCanvasProps) {
  const { selectedItems, selectSingle, toggleSelectItem, clearSelection, openContextMenu, openDrawer } =
    useCommonPlace();

  const containerRef = useRef<HTMLDivElement>(null);
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  const [dragId, setDragId] = useState<string | null>(null);
  const dragStart = useRef<{ x: number; y: number; itemX: number; itemY: number } | null>(null);
  const [dropTarget, setDropTarget] = useState<{ x: number; y: number } | null>(null);
  const [hoveredConnectionId, setHoveredConnectionId] = useState<string | null>(null);

  /* -- Zoom via scroll wheel -- */
  const handleWheel = useCallback(
    (e: ReactWheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
      const nextZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, viewport.zoom + delta));
      onViewportChange({ ...viewport, zoom: nextZoom });
    },
    [viewport, onViewportChange],
  );

  /* -- Pan via middle click -- */
  const handleCanvasMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button === 1) {
        isPanning.current = true;
        panStart.current = {
          x: e.clientX,
          y: e.clientY,
          panX: viewport.panX,
          panY: viewport.panY,
        };
        e.preventDefault();
      }
    },
    [viewport],
  );

  /* -- Item drag -- */
  const handleItemMouseDown = useCallback(
    (e: React.MouseEvent, item: PlacedItem) => {
      if (e.button !== 0) return;
      e.stopPropagation();

      if (e.shiftKey) {
        toggleSelectItem(item.id);
        return;
      }

      if (!selectedItems.has(item.id)) {
        selectSingle(item.id);
      }
      setDragId(item.id);
      dragStart.current = {
        x: e.clientX,
        y: e.clientY,
        itemX: item.x,
        itemY: item.y,
      };
    },
    [selectedItems, selectSingle, toggleSelectItem],
  );

  const handleItemClick = useCallback(
    (e: React.MouseEvent, item: PlacedItem) => {
      if (e.shiftKey) return;
      if (e.detail === 2) {
        openDrawer(item.object.slug);
      }
    },
    [openDrawer],
  );

  const handleItemContextMenu = useCallback(
    (e: React.MouseEvent, item: PlacedItem) => {
      e.preventDefault();
      openContextMenu(e.clientX, e.clientY, item.object);
    },
    [openContextMenu],
  );

  /* -- Global mouse move/up for drag and pan -- */
  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      if (isPanning.current) {
        const dx = e.clientX - panStart.current.x;
        const dy = e.clientY - panStart.current.y;
        onViewportChange({
          ...viewport,
          panX: panStart.current.panX + dx,
          panY: panStart.current.panY + dy,
        });
        return;
      }

      if (dragId && dragStart.current) {
        const dx = (e.clientX - dragStart.current.x) / viewport.zoom;
        const dy = (e.clientY - dragStart.current.y) / viewport.zoom;
        onItemMove(dragId, dragStart.current.itemX + dx, dragStart.current.itemY + dy);
      }
    };

    const handleUp = () => {
      isPanning.current = false;
      setDragId(null);
      dragStart.current = null;
    };

    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
    return () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
    };
  }, [dragId, viewport, onViewportChange, onItemMove]);

  /* -- Keyboard: Escape clears selection -- */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') clearSelection();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [clearSelection]);

  /* -- Click empty canvas clears selection -- */
  const handleCanvasClick = useCallback(
    (e: React.MouseEvent) => {
      if (!(e.target as HTMLElement).closest('[data-board-item]')) {
        clearSelection();
      }
    },
    [clearSelection],
  );

  /* -- Catalog drag-over: show crosshair at canvas-space position -- */
  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      if (!e.dataTransfer.types.includes('application/commonplace-catalog')) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      const bounds = containerRef.current?.getBoundingClientRect();
      if (bounds) {
        setDropTarget({
          x: (e.clientX - bounds.left - viewport.panX) / viewport.zoom,
          y: (e.clientY - bounds.top - viewport.panY) / viewport.zoom,
        });
      }
    },
    [viewport],
  );

  /* -- Catalog drop: parse ID and position, call parent handler -- */
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      if (!e.dataTransfer.types.includes('application/commonplace-catalog')) return;
      e.preventDefault();
      e.stopPropagation();

      const catalogId = e.dataTransfer.getData('application/commonplace-catalog');
      if (!catalogId) {
        setDropTarget(null);
        return;
      }

      const bounds = containerRef.current?.getBoundingClientRect();
      if (bounds && onCatalogDrop) {
        const x = (e.clientX - bounds.left - viewport.panX) / viewport.zoom;
        const y = (e.clientY - bounds.top - viewport.panY) / viewport.zoom;
        onCatalogDrop(catalogId, x, y);
      }

      setDropTarget(null);
    },
    [viewport, onCatalogDrop],
  );

  const draggedItem = dragId ? items.find((i) => i.id === dragId) : null;

  return (
    <div
      ref={containerRef}
      className="board-canvas"
      role="application"
      aria-label="Board canvas"
      tabIndex={0}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        backgroundColor: '#F4F3F0',
        cursor: isPanning.current ? 'grabbing' : 'default',
      }}
      onWheel={handleWheel}
      onMouseDown={handleCanvasMouseDown}
      onClick={handleCanvasClick}
      onDragStart={(e) => e.preventDefault()}
      onDragOver={handleDragOver}
      onDragLeave={() => setDropTarget(null)}
      onDrop={handleDrop}
    >
      {/* Grid background */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `
            linear-gradient(rgba(45, 95, 107, 0.07) 1px, transparent 1px),
            linear-gradient(90deg, rgba(45, 95, 107, 0.07) 1px, transparent 1px)
          `,
          backgroundSize: `${GRID_SIZE * viewport.zoom}px ${GRID_SIZE * viewport.zoom}px`,
          backgroundPosition: `${viewport.panX}px ${viewport.panY}px`,
          pointerEvents: 'none',
        }}
      />

      {/* Terracotta ambient glow */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: '40vw',
          height: '40vh',
          background: 'radial-gradient(ellipse at 100% 0%, rgba(184, 98, 61, 0.025), transparent)',
          pointerEvents: 'none',
        }}
      />

      {/* Transformed content layer */}
      <div
        style={{
          position: 'absolute',
          transformOrigin: '0 0',
          transform: `translate(${viewport.panX}px, ${viewport.panY}px) scale(${viewport.zoom})`,
        }}
      >
        <ConnectionLines
          connections={connections}
          items={items}
          hoveredId={hoveredConnectionId}
          onHover={setHoveredConnectionId}
        />

        {items.map((item) => (
          <PlacedCard
            key={item.id}
            item={item}
            isSelected={selectedItems.has(item.id)}
            isDragging={dragId === item.id}
            engineRelevantIds={engineRelevantIds}
            onMouseDown={handleItemMouseDown}
            onContextMenu={handleItemContextMenu}
            onClick={handleItemClick}
          />
        ))}

        {draggedItem && dragStart.current && (
          <DragGhost
            x={dragStart.current.itemX}
            y={dragStart.current.itemY}
            width={draggedItem.width}
            height={draggedItem.height ?? 160}
            typeColor={getObjectTypeIdentity(draggedItem.object.object_type_slug).color}
          />
        )}

        {/* Drop target crosshair */}
        {dropTarget && (
          <div
            className="board-drop-crosshair"
            style={{ left: dropTarget.x - 10, top: dropTarget.y - 10, width: 20, height: 20 }}
          />
        )}
      </div>

      {/* Empty state */}
      {items.length === 0 && <BoardEmptyState />}

      {/* Zoom controls overlay (bottom-right, Figma style) */}
      <div
        style={{
          position: 'absolute',
          bottom: 12,
          right: 12,
          display: 'flex',
          gap: 2,
          zIndex: 20,
        }}
      >
        {[
          { label: '\u2212', action: () => onViewportChange({ ...viewport, zoom: Math.max(MIN_ZOOM, viewport.zoom - ZOOM_STEP * 3) }) },
          { label: `${Math.round(viewport.zoom * 100)}%`, action: undefined as (() => void) | undefined },
          { label: '+', action: () => onViewportChange({ ...viewport, zoom: Math.min(MAX_ZOOM, viewport.zoom + ZOOM_STEP * 3) }) },
          { label: 'Fit', action: () => onViewportChange({ panX: 0, panY: 0, zoom: 1 }) },
        ].map((btn) => (
          <button
            key={btn.label}
            type="button"
            onClick={btn.action}
            disabled={!btn.action}
            style={{
              padding: '4px 8px',
              borderRadius: 4,
              border: '1px solid rgba(42, 36, 32, 0.12)',
              backgroundColor: 'rgba(244, 243, 240, 0.9)',
              backdropFilter: 'blur(4px)',
              fontFamily: 'var(--font-metadata)',
              fontSize: 10,
              color: btn.action ? '#5C564E' : '#9A948A',
              cursor: btn.action ? 'pointer' : 'default',
            }}
          >
            {btn.label}
          </button>
        ))}
      </div>
    </div>
  );
}
