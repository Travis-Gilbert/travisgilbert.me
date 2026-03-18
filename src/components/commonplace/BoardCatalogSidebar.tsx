'use client';

/**
 * BoardCatalogSidebar: replaces the default CommonPlace sidebar when the
 * Board view is active. Shows nav header, search, objects catalog,
 * components, and compose button.
 *
 * When compose mode is active, splits vertically into compose editor (top)
 * and compressed catalog (bottom) with a draggable divider.
 */

import { useState, useCallback, useRef } from 'react';
import type { CSSProperties } from 'react';
import { getObjectTypeIdentity } from '@/lib/commonplace';

/* ─────────────────────────────────────────────────
   Types
   ───────────────────────────────────────────────── */

interface CatalogObject {
  id: number;
  title: string;
  type: string;
  connections: number;
}

interface CatalogComponent {
  id: string;
  label: string;
  parent: string;
  color: string;
}

interface BoardCatalogSidebarProps {
  objects: CatalogObject[];
  components: CatalogComponent[];
  /** IDs of objects currently placed on the board */
  placedObjectIds?: Set<number>;
  /** Called when user wants to exit board and return to normal sidebar */
  onExitBoard?: () => void;
}

/* ─────────────────────────────────────────────────
   Shared styles
   ───────────────────────────────────────────────── */

const sectionLabelStyle: CSSProperties = {
  fontFamily: 'var(--cp-font-mono)',
  fontSize: 9,
  fontWeight: 600,
  letterSpacing: '0.06em',
  color: 'var(--cp-chrome-dim)',
  padding: '8px 10px 6px',
};

const searchInputStyle: CSSProperties = {
  flex: 1,
  padding: '5px 8px',
  borderRadius: 4,
  border: '1px solid var(--cp-chrome-line)',
  backgroundColor: 'var(--cp-chrome-mid)',
  fontFamily: 'var(--cp-font-mono)',
  fontSize: 10,
  color: 'var(--cp-chrome-text)',
  outline: 'none',
};

/* ─────────────────────────────────────────────────
   Object row (draggable)
   ───────────────────────────────────────────────── */

function ObjectRow({ obj, isOnBoard }: { obj: CatalogObject; isOnBoard?: boolean }) {
  const identity = getObjectTypeIdentity(obj.type);
  return (
    <div
      draggable
      onDragStart={(e) => e.dataTransfer.setData('application/commonplace-catalog', String(obj.id))}
      style={{
        padding: '6px 8px',
        marginBottom: 3,
        borderRadius: 4,
        border: `1px solid color-mix(in srgb, ${identity.color} 7%, transparent)`,
        backgroundColor: `color-mix(in srgb, ${identity.color} 4%, transparent)`,
        cursor: 'grab',
        display: 'flex',
        alignItems: 'center',
        gap: 7,
        opacity: isOnBoard ? 0.45 : 1,
      }}
    >
      <div
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          backgroundColor: identity.color,
          flexShrink: 0,
        }}
      />
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <div
          style={{
            fontFamily: 'var(--cp-font-body)',
            fontSize: 11,
            fontWeight: 600,
            color: 'var(--cp-chrome-text)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {obj.title}
        </div>
        <div
          style={{
            fontFamily: 'var(--cp-font-mono)',
            fontSize: 8,
            color: 'var(--cp-chrome-dim)',
            marginTop: 1,
          }}
        >
          {obj.type} · {obj.connections} conn.
        </div>
      </div>
      {isOnBoard ? (
        <span
          style={{
            fontFamily: 'var(--cp-font-mono)',
            fontSize: 7,
            color: 'var(--cp-chrome-dim)',
            letterSpacing: '0.04em',
            flexShrink: 0,
          }}
        >
          ON BOARD
        </span>
      ) : (
        <span
          style={{
            fontFamily: 'var(--cp-font-mono)',
            fontSize: 11,
            color: 'var(--cp-chrome-dim)',
            opacity: 0.3,
            flexShrink: 0,
          }}
        >
          ⠿
        </span>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────
   Component row (draggable)
   ───────────────────────────────────────────────── */

function ComponentRow({ comp }: { comp: CatalogComponent }) {
  return (
    <div
      draggable
      onDragStart={(e) => e.dataTransfer.setData('application/commonplace-catalog', comp.id)}
      style={{
        padding: '5px 8px',
        marginBottom: 2,
        borderRadius: 3,
        border: '1px solid var(--cp-chrome-line)',
        backgroundColor: 'var(--cp-chrome-raise)',
        cursor: 'grab',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
      }}
    >
      <div
        style={{
          width: 4,
          height: 4,
          borderRadius: 1,
          backgroundColor: comp.color,
          flexShrink: 0,
        }}
      />
      <div
        style={{
          fontFamily: 'var(--cp-font-mono)',
          fontSize: 9.5,
          color: 'var(--cp-chrome-muted)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          flex: 1,
        }}
      >
        {comp.label}
      </div>
      <span
        style={{
          fontFamily: 'var(--cp-font-mono)',
          fontSize: 11,
          color: 'var(--cp-chrome-dim)',
          opacity: 0.3,
          flexShrink: 0,
        }}
      >
        ⠿
      </span>
    </div>
  );
}

/* ─────────────────────────────────────────────────
   Compose mode (split view)
   ───────────────────────────────────────────────── */

const MIN_COMPOSE = 200;
const MIN_CATALOG = 120;

function ComposeSplitView({
  objects,
  components,
  placedObjectIds,
  onExitCompose,
}: {
  objects: CatalogObject[];
  components: CatalogComponent[];
  placedObjectIds?: Set<number>;
  onExitCompose: () => void;
}) {
  const [ratio, setRatio] = useState(0.5);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleDividerMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const container = containerRef.current;
      if (!container) return;

      const handleMove = (ev: MouseEvent) => {
        if (!container) return;
        const bounds = container.getBoundingClientRect();
        const total = bounds.height;
        const y = ev.clientY - bounds.top;
        const minR = MIN_COMPOSE / total;
        const maxR = 1 - MIN_CATALOG / total;
        setRatio(Math.max(minR, Math.min(maxR, y / total)));
      };

      const handleUp = () => {
        document.removeEventListener('mousemove', handleMove);
        document.removeEventListener('mouseup', handleUp);
      };

      document.addEventListener('mousemove', handleMove);
      document.addEventListener('mouseup', handleUp);
    },
    [],
  );

  return (
    <div ref={containerRef} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      {/* Compose section */}
      <div style={{ height: `${ratio * 100}%`, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div
          style={{
            padding: '8px 10px',
            borderBottom: '1px solid var(--cp-chrome-line)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span
            style={{
              fontFamily: 'var(--cp-font-mono)',
              fontSize: 9,
              fontWeight: 600,
              letterSpacing: '0.06em',
              color: 'var(--cp-gold)',
            }}
          >
            FIELD NOTES
          </span>
          <button
            type="button"
            onClick={onExitCompose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--cp-chrome-dim)',
              cursor: 'pointer',
              fontFamily: 'var(--cp-font-mono)',
              fontSize: 8,
            }}
          >
            Back to full
          </button>
        </div>
        <div style={{ padding: '6px 10px 0' }}>
          <input
            placeholder="Title..."
            style={{
              width: '100%',
              padding: '4px 0',
              border: 'none',
              borderBottom: '1px solid var(--cp-chrome-line)',
              background: 'transparent',
              fontFamily: 'var(--cp-font-body)',
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--cp-chrome-text)',
              outline: 'none',
            }}
          />
        </div>
        <div style={{ flex: 1, padding: '6px 10px', overflow: 'auto' }}>
          <div
            contentEditable
            suppressContentEditableWarning
            style={{
              minHeight: 80,
              padding: 8,
              borderRadius: 4,
              border: '1px solid rgba(255, 255, 255, 0.06)',
              backgroundColor: 'rgba(255, 255, 255, 0.04)',
              fontFamily: 'var(--cp-font-body)',
              fontSize: 11.5,
              color: 'var(--cp-chrome-text)',
              lineHeight: 1.5,
              outline: 'none',
            }}
          />
          <button
            type="button"
            style={{
              marginTop: 6,
              padding: '5px 0',
              borderRadius: 4,
              width: '100%',
              backgroundColor: 'var(--cp-red-soft)',
              border: '1px solid var(--cp-red-line)',
              fontFamily: 'var(--cp-font-mono)',
              fontSize: 9,
              fontWeight: 600,
              color: 'var(--cp-red)',
              cursor: 'pointer',
            }}
          >
            Save as Object
          </button>
        </div>
      </div>

      {/* Split handle */}
      <div
        onMouseDown={handleDividerMouseDown}
        style={{
          height: 6,
          backgroundColor: 'var(--cp-chrome-line)',
          cursor: 'row-resize',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <div style={{ width: 20, height: 2, borderRadius: 1, backgroundColor: 'var(--cp-chrome-muted)', opacity: 0.4 }} />
      </div>

      {/* Compressed catalog */}
      <div style={{ height: `${(1 - ratio) * 100}%`, minHeight: MIN_CATALOG, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '6px 10px', borderBottom: '1px solid var(--cp-chrome-line)', display: 'flex', gap: 5 }}>
          <input placeholder="Search..." style={{ ...searchInputStyle, padding: '4px 6px', borderRadius: 3, fontSize: 10 }} />
          <button type="button" style={{ width: 24, height: 24, borderRadius: 3, border: '1px solid var(--cp-chrome-line)', backgroundColor: 'transparent', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            🌐
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 8px' }}>
          {objects.map((obj) => (
            <ObjectRow key={obj.id} obj={obj} isOnBoard={placedObjectIds?.has(obj.id)} />
          ))}
          {components.map((c) => (
            <ComponentRow key={c.id} comp={c} />
          ))}
        </div>

      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────
   Main component
   ───────────────────────────────────────────────── */

export default function BoardCatalogSidebar({
  objects,
  components,
  placedObjectIds,
  onExitBoard,
}: BoardCatalogSidebarProps) {
  const [composeActive, setComposeActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredObjects = searchQuery
    ? objects.filter((o) => o.title.toLowerCase().includes(searchQuery.toLowerCase()))
    : objects;

  if (composeActive) {
    return (
      <ComposeSplitView
        objects={filteredObjects}
        components={components}
        placedObjectIds={placedObjectIds}
        onExitCompose={() => setComposeActive(false)}
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      {/* Navigation header */}
      <div
        style={{
          padding: '10px 10px 6px',
          borderBottom: '1px solid var(--cp-chrome-line)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <button
          type="button"
          onClick={onExitBoard}
          style={{
            background: 'transparent',
            border: 'none',
            fontFamily: 'var(--cp-font-title)',
            fontSize: 13,
            color: 'var(--cp-chrome-text)',
            cursor: 'pointer',
            padding: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <span style={{ fontSize: 11, color: 'var(--cp-chrome-dim)' }}>&larr;</span>
          CommonPlace
        </button>
        <span
          style={{
            fontFamily: 'var(--font-metadata)',
            fontSize: 9,
            color: 'var(--cp-chrome-dim)',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
          }}
        >
          Board
        </span>
      </div>

      {/* Search bar */}
      <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--cp-chrome-line)', display: 'flex', gap: 5 }}>
        <input
          placeholder="Search..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={searchInputStyle}
        />
        <button type="button" style={{ width: 26, height: 26, borderRadius: 4, border: '1px solid var(--cp-chrome-line)', backgroundColor: 'transparent', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          🌐
        </button>
      </div>

      {/* Scrollable catalog */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '6px 8px' }}>
        <div style={sectionLabelStyle}>OBJECTS</div>
        {filteredObjects.map((obj) => (
          <ObjectRow key={obj.id} obj={obj} isOnBoard={placedObjectIds?.has(obj.id)} />
        ))}

        <div style={sectionLabelStyle}>COMPONENTS</div>
        {components.map((c) => (
          <ComponentRow key={c.id} comp={c} />
        ))}
      </div>

      {/* Compose button (muted, not dominant) */}
      <button
        type="button"
        onClick={() => setComposeActive(true)}
        style={{
          margin: '6px 8px',
          padding: '7px 0',
          borderRadius: 4,
          backgroundColor: 'var(--cp-chrome-raise)',
          border: '1px solid var(--cp-chrome-line)',
          fontFamily: 'var(--cp-font-mono)',
          fontSize: 10,
          fontWeight: 600,
          color: 'var(--cp-chrome-muted)',
          cursor: 'pointer',
        }}
      >
        ✎ Compose
      </button>
    </div>
  );
}
