'use client';

/**
 * NotebookListView: physical notebook collection.
 *
 * Hero notebook renders as a rough.js composition notebook cover
 * (colored cover + white label). Remaining notebooks render as
 * solid-color spines on a shelf below.
 */

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import rough from 'roughjs';
import { fetchNotebooks, createNotebook, useApiData } from '@/lib/commonplace-api';
import type { ApiNotebookListItem } from '@/lib/commonplace';
import { useLayout } from '@/lib/providers/layout-provider';

export default function NotebookListView() {
  const { data: notebooks, loading, error, refetch } = useApiData(
    () => fetchNotebooks(),
    [],
  );
  const { launchView } = useLayout();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#8B6FA0');
  const [creating, setCreating] = useState(false);

  const handleCreate = useCallback(async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const nb = await createNotebook({ name: newName.trim(), color: newColor });
      setNewName('');
      setShowCreate(false);
      refetch();
      launchView('notebook', { slug: nb.slug });
    } catch {
      toast.error('Failed to create notebook');
    } finally {
      setCreating(false);
    }
  }, [newName, newColor, refetch, launchView]);

  const sorted = useMemo(() => {
    if (!notebooks) return [];
    return [...notebooks].sort((a, b) => b.object_count - a.object_count);
  }, [notebooks]);

  /* Loading */
  if (loading) {
    return (
      <div className="cp-list-view cp-scrollbar">
        <div style={{ padding: '0 20px' }}>
          <h2 className="cp-list-view-title">Notebooks</h2>
        </div>
        <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="cp-loading-skeleton" style={{ width: '100%', height: 180, borderRadius: 8 }} />
          <div style={{ display: 'flex', gap: 6 }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="cp-loading-skeleton" style={{ width: 60, height: 140, borderRadius: 3 }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  /* Error */
  if (error) {
    return (
      <div className="cp-list-view">
        <div style={{ padding: '0 20px' }}>
          <h2 className="cp-list-view-title">Notebooks</h2>
        </div>
        <div className="cp-error-banner" style={{ margin: 20 }}>
          <p>
            {error.isNetworkError
              ? 'Could not reach CommonPlace API.'
              : `Error: ${error.message}`}
          </p>
          <button type="button" onClick={refetch}>Retry</button>
        </div>
      </div>
    );
  }

  const createForm = (
    <div style={{ padding: '0 20px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
      <input
        type="text"
        value={newName}
        onChange={(e) => setNewName(e.target.value)}
        placeholder="Notebook name"
        autoFocus
        className="cp-input"
        style={{ fontSize: 13 }}
        onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setShowCreate(false); }}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <label style={{ fontFamily: 'var(--cp-font-mono)', fontSize: 10, color: 'var(--cp-text-faint)' }}>Color</label>
        <input type="color" value={newColor} onChange={(e) => setNewColor(e.target.value)} style={{ width: 24, height: 24, border: 'none', padding: 0, cursor: 'pointer' }} />
      </div>
      <div style={{ display: 'flex', gap: 4 }}>
        <button type="button" className="cp-btn-accent" style={{ flex: 1 }} onClick={handleCreate} disabled={creating || !newName.trim()}>
          {creating ? 'Creating...' : 'Create'}
        </button>
        <button type="button" className="cp-btn-ghost" onClick={() => setShowCreate(false)}>Cancel</button>
      </div>
    </div>
  );

  /* Empty */
  if (sorted.length === 0) {
    return (
      <div className="cp-list-view">
        <div style={{ padding: '0 20px' }}>
          <h2 className="cp-list-view-title">Notebooks</h2>
        </div>
        {showCreate ? createForm : (
          <div className="cp-empty-state">
            <p>No notebooks yet.</p>
            <button type="button" className="cp-btn-accent" onClick={() => setShowCreate(true)} style={{ marginTop: 8 }}>
              <span className="cp-btn-accent-dot" />
              Create your first notebook
            </button>
          </div>
        )}
      </div>
    );
  }

  const hero = sorted[0];
  const rest = sorted.slice(1);

  return (
    <div className="cp-list-view cp-scrollbar">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px 8px' }}>
        <h2 className="cp-list-view-title">Notebooks</h2>
      </div>
      {showCreate && createForm}

      {/* Hero cover: primary notebook */}
      <div style={{ padding: '0 20px 16px' }}>
        <NotebookCover
          nb={hero}
          onClick={() => launchView('notebook', { slug: hero.slug })}
        />
      </div>

      {/* Shelf: remaining notebook spines */}
      {(rest.length > 0 || !showCreate) && (
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: 6,
            padding: '0 20px 24px',
            flexWrap: 'wrap',
          }}
        >
          {rest.map((nb) => (
            <NotebookSpine
              key={nb.id}
              nb={nb}
              onClick={() => launchView('notebook', { slug: nb.slug })}
            />
          ))}
          {/* New notebook spine */}
          {!showCreate && (
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              style={{
                width: 48,
                height: 140,
                borderRadius: 3,
                border: '2px dashed var(--cp-text-ghost)',
                background: 'transparent',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'border-color 200ms ease, transform 200ms ease',
                flexShrink: 0,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--cp-text-faint)';
                e.currentTarget.style.transform = 'translateY(-4px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--cp-text-ghost)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
              aria-label="Create new notebook"
            >
              <span
                style={{
                  fontSize: 20,
                  color: 'var(--cp-text-ghost)',
                  lineHeight: 1,
                }}
              >
                +
              </span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Hero: Composition notebook cover with rough.js ── */

function NotebookCover({
  nb,
  onClick,
}: {
  nb: ApiNotebookListItem;
  onClick: () => void;
}) {
  const containerRef = useRef<HTMLButtonElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const color = nb.color || '#8B6FA0';
  const objectLabel = nb.object_count === 1 ? 'object' : 'objects';

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    function draw() {
      const rect = container!.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const w = rect.width;
      const h = rect.height;
      if (w < 1 || h < 1) return;

      canvas!.width = w * dpr;
      canvas!.height = h * dpr;
      canvas!.style.width = `${w}px`;
      canvas!.style.height = `${h}px`;

      const ctx = canvas!.getContext('2d');
      if (!ctx) return;
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, w, h);

      const rc = rough.canvas(canvas!);

      // 1. Cover fill: light tint of notebook color
      ctx.fillStyle = color + '25'; // ~15% opacity
      ctx.beginPath();
      ctx.roundRect(3, 3, w - 6, h - 6, 3);
      ctx.fill();

      // 2. Spine strip (solid color, left edge)
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, 8, h);

      // 3. Label rectangle (opaque cream for readability)
      const labelX = 28;
      const labelY = 20;
      const labelW = w - 56;
      const labelH = h - 40;

      ctx.fillStyle = 'rgba(250, 246, 238, 0.95)';
      ctx.beginPath();
      ctx.roundRect(labelX, labelY, labelW, labelH, 3);
      ctx.fill();

      // 4. Rough.js stroke around label
      rc.rectangle(labelX, labelY, labelW, labelH, {
        roughness: 0.8,
        strokeWidth: 0.7,
        stroke: color + '50',
        bowing: 0.5,
        seed: nb.id + 1,
      });

      // 5. Rough.js outer cover stroke (hand-drawn border)
      rc.rectangle(3, 3, w - 6, h - 6, {
        roughness: 1.2,
        strokeWidth: 1.5,
        stroke: color,
        bowing: 1,
        seed: nb.id,
      });
    }

    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(container);
    return () => observer.disconnect();
  }, [color, nb.id]);

  return (
    <button
      type="button"
      ref={containerRef}
      onClick={onClick}
      style={{
        position: 'relative',
        display: 'block',
        width: '100%',
        minHeight: 180,
        borderRadius: 4,
        border: 'none',
        background: 'transparent',
        cursor: 'pointer',
        textAlign: 'left',
        padding: 0,
        transition: 'transform 200ms ease, box-shadow 200ms ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = '0 6px 20px rgba(42, 37, 32, 0.12)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />
      {/* Label content (sits over the cream label area) */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          padding: '36px 48px',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
        }}
      >
        <h3
          style={{
            fontFamily: 'var(--font-title, Vollkorn, serif)',
            fontSize: 22,
            fontWeight: 800,
            color: '#2A2520',
            margin: 0,
            lineHeight: 1.2,
          }}
        >
          {nb.name}
        </h3>
        {nb.description && (
          <p
            style={{
              fontFamily: 'var(--font-body, IBM Plex Sans, sans-serif)',
              fontSize: 13,
              fontWeight: 400,
              color: '#5C554D',
              margin: '2px 0 0',
              lineHeight: 1.5,
            }}
          >
            {nb.description}
          </p>
        )}
        <p
          style={{
            fontFamily: 'var(--font-body, IBM Plex Sans, sans-serif)',
            fontSize: 13,
            fontWeight: 600,
            color: '#5C554D',
            margin: '4px 0 0',
            lineHeight: 1.4,
          }}
        >
          {nb.object_count} {objectLabel}.
        </p>
      </div>
    </button>
  );
}

/* ── Spine: secondary notebook on the shelf ── */

function NotebookSpine({
  nb,
  onClick,
}: {
  nb: ApiNotebookListItem;
  onClick: () => void;
}) {
  const color = nb.color || '#8B6FA0';

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: 60,
        height: 140,
        borderRadius: 3,
        background: color,
        border: 'none',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 4px 10px',
        boxShadow: 'inset 2px 0 4px rgba(0,0,0,0.15), 0 2px 4px rgba(42, 37, 32, 0.1)',
        transition: 'transform 200ms ease, box-shadow 200ms ease',
        flexShrink: 0,
        overflow: 'hidden',
        position: 'relative',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-6px)';
        e.currentTarget.style.boxShadow = 'inset 2px 0 4px rgba(0,0,0,0.15), 0 6px 12px rgba(42, 37, 32, 0.15)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'inset 2px 0 4px rgba(0,0,0,0.15), 0 2px 4px rgba(42, 37, 32, 0.1)';
      }}
    >
      {/* Title (vertical) */}
      <span
        style={{
          writingMode: 'vertical-rl',
          textOrientation: 'mixed',
          fontFamily: 'var(--font-title, Vollkorn, serif)',
          fontSize: 12,
          fontWeight: 600,
          color: '#F4F3F0',
          letterSpacing: '0.02em',
          lineHeight: 1.2,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          maxHeight: 100,
          whiteSpace: 'nowrap',
          flex: 1,
        }}
      >
        {nb.name}
      </span>
      {/* Object count (like a volume number) */}
      <span
        style={{
          fontFamily: 'var(--cp-font-mono)',
          fontSize: 9,
          fontWeight: 500,
          color: 'rgba(244, 243, 240, 0.6)',
          whiteSpace: 'nowrap',
        }}
      >
        {nb.object_count}
      </span>
    </button>
  );
}
