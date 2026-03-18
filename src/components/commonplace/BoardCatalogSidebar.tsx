'use client';

/**
 * BoardCatalogSidebar: replaces the default CommonPlace sidebar when the
 * Board view is active. Shows search, objects catalog, components, compose
 * button, and zoom controls per the v2 wireframe spec.
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
  /** Objects not on the board (available to drag) */
  objects: CatalogObject[];
  /** Components extracted from board objects */
  components: CatalogComponent[];
  /** Current zoom level (0 to 1 scale, displayed as percentage) */
  zoom: number;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onFitToContent?: () => void;
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

const globeBtnStyle: CSSProperties = {
  width: 26,
  height: 26,
  borderRadius: 4,
  border: '1px solid var(--cp-chrome-line)',
  backgroundColor: 'transparent',
  fontSize: 12,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

/* ─────────────────────────────────────────────────
   Object row (draggable)
   ───────────────────────────────────────────────── */

function ObjectRow({ obj }: { obj: CatalogObject }) {
  const identity = getObjectTypeIdentity(obj.type);
  return (
    <div
      draggable
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
    </div>
  );
}

/* ─────────────────────────────────────────────────
   Zoom controls
   ───────────────────────────────────────────────── */

function ZoomControls({
  zoom,
  onZoomIn,
  onZoomOut,
  onFit,
}: {
  zoom: number;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onFit?: () => void;
}) {
  const btnStyle: CSSProperties = {
    padding: '3px 7px',
    borderRadius: 3,
    border: '1px solid var(--cp-chrome-line)',
    backgroundColor: 'transparent',
    fontFamily: 'var(--cp-font-mono)',
    fontSize: 10,
    color: 'var(--cp-chrome-muted)',
    cursor: 'pointer',
  };

  return (
    <div
      style={{
        padding: '5px 8px 8px',
        borderTop: '1px solid var(--cp-chrome-line)',
        display: 'flex',
        gap: 2,
        justifyContent: 'center',
      }}
    >
      <button type="button" style={btnStyle} onClick={onZoomOut}>
        &minus;
      </button>
      <button
        type="button"
        style={{ ...btnStyle, fontSize: 9, minWidth: 36, textAlign: 'center' }}
        disabled
      >
        {Math.round(zoom * 100)}%
      </button>
      <button type="button" style={btnStyle} onClick={onZoomIn}>
        +
      </button>
      <button type="button" style={btnStyle} onClick={onFit}>
        Fit
      </button>
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
  zoom,
  onExitCompose,
  onZoomIn,
  onZoomOut,
  onFitToContent,
}: {
  objects: CatalogObject[];
  components: CatalogComponent[];
  zoom: number;
  onExitCompose: () => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onFitToContent?: () => void;
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
              border: '1px solid var(--cp-chrome-line)',
              backgroundColor: 'var(--cp-chrome-mid)',
              fontFamily: 'var(--cp-font-body)',
              fontSize: 11.5,
              color: 'var(--cp-chrome-muted)',
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
        <div
          style={{
            width: 20,
            height: 2,
            borderRadius: 1,
            backgroundColor: 'var(--cp-chrome-muted)',
            opacity: 0.4,
          }}
        />
      </div>

      {/* Compressed catalog */}
      <div style={{ flex: 1 - ratio, minHeight: MIN_CATALOG, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '6px 10px', borderBottom: '1px solid var(--cp-chrome-line)', display: 'flex', gap: 5 }}>
          <input placeholder="Search..." style={{ ...searchInputStyle, padding: '4px 6px', borderRadius: 3, fontSize: 10 }} />
          <button type="button" style={{ ...globeBtnStyle, width: 24, height: 24, borderRadius: 3, fontSize: 11 }}>
            🌐
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 8px' }}>
          {objects.map((obj) => (
            <div
              key={obj.id}
              draggable
              style={{
                padding: '5px 7px',
                marginBottom: 2,
                borderRadius: 3,
                cursor: 'grab',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <div
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: '50%',
                  backgroundColor: getObjectTypeIdentity(obj.type).color,
                  flexShrink: 0,
                }}
              />
              <div
                style={{
                  fontFamily: 'var(--cp-font-body)',
                  fontSize: 10.5,
                  fontWeight: 600,
                  color: 'var(--cp-chrome-text)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  flex: 1,
                }}
              >
                {obj.title}
              </div>
              <span
                style={{
                  fontFamily: 'var(--cp-font-mono)',
                  fontSize: 10,
                  color: 'var(--cp-chrome-dim)',
                  opacity: 0.25,
                }}
              >
                ⠿
              </span>
            </div>
          ))}
          {components.map((c) => (
            <ComponentRow key={c.id} comp={c} />
          ))}
        </div>

        {/* Discovery dock */}
        <div style={{ borderTop: '1px solid var(--cp-chrome-line)', padding: '5px 10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: 'var(--cp-font-mono)', fontSize: 8, fontWeight: 600, color: 'var(--cp-teal-light)' }}>DISCOVERY</span>
            <span style={{ fontFamily: 'var(--cp-font-mono)', fontSize: 7, color: 'var(--cp-green)' }}>Live</span>
          </div>
          <div style={{ fontFamily: 'var(--cp-font-body)', fontSize: 10, color: 'var(--cp-chrome-text)', marginTop: 3 }}>
            No active suggestions
          </div>
        </div>
      </div>

      <ZoomControls zoom={zoom} onZoomIn={onZoomIn} onZoomOut={onZoomOut} onFit={onFitToContent} />
    </div>
  );
}

/* ─────────────────────────────────────────────────
   Main component
   ───────────────────────────────────────────────── */

export default function BoardCatalogSidebar({
  objects,
  components,
  zoom,
  onZoomIn,
  onZoomOut,
  onFitToContent,
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
        zoom={zoom}
        onExitCompose={() => setComposeActive(false)}
        onZoomIn={onZoomIn}
        onZoomOut={onZoomOut}
        onFitToContent={onFitToContent}
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      {/* Search bar */}
      <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--cp-chrome-line)', display: 'flex', gap: 5 }}>
        <input
          placeholder="Search..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={searchInputStyle}
        />
        <button type="button" style={globeBtnStyle}>
          🌐
        </button>
      </div>

      {/* Scrollable catalog */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '6px 8px' }}>
        <div style={sectionLabelStyle}>OBJECTS</div>
        {filteredObjects.map((obj) => (
          <ObjectRow key={obj.id} obj={obj} />
        ))}

        <div style={sectionLabelStyle}>COMPONENTS</div>
        {components.map((c) => (
          <ComponentRow key={c.id} comp={c} />
        ))}
      </div>

      {/* Compose button */}
      <button
        type="button"
        onClick={() => setComposeActive(true)}
        style={{
          margin: '6px 8px',
          padding: '7px 0',
          borderRadius: 4,
          backgroundColor: 'var(--cp-red-soft)',
          border: '1px solid var(--cp-red-line)',
          fontFamily: 'var(--cp-font-mono)',
          fontSize: 10,
          fontWeight: 600,
          color: 'var(--cp-red)',
          cursor: 'pointer',
        }}
      >
        ✎ Compose
      </button>

      {/* Zoom controls */}
      <ZoomControls zoom={zoom} onZoomIn={onZoomIn} onZoomOut={onZoomOut} onFit={onFitToContent} />
    </div>
  );
}
