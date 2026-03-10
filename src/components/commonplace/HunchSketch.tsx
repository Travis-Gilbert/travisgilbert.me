'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import rough from 'roughjs';
import type { ApiComponent } from '@/lib/commonplace';
import { apiFetch } from '@/lib/commonplace-api';

/**
 * HunchSketch: inline rough.js canvas drawing surface for Hunch objects.
 *
 * Tools: pencil, circle, rect, arrow, text
 * History: 5-step undo/redo via useRef stack
 * Save: POST or PATCH to /components/ with component_type_slug: 'sketch'
 *
 * Rendered in the Overview tab of ObjectDrawer for hunch-type objects.
 */

const CANVAS_W = 480;
const CANVAS_H = 280;
const THUMB_W = 120;
const THUMB_H = 70;
const MAX_HISTORY = 6;

const SKETCH_COLORS = ['#3A3632', '#B45A2D', '#2D5F6B', '#C49A4A', '#B06080'];

type Tool = 'pencil' | 'circle' | 'rect' | 'arrow' | 'text';

type PencilStroke = { type: 'pencil'; points: [number, number][]; color: string };
type ShapeStroke = {
  type: 'circle' | 'rect' | 'arrow';
  x1: number; y1: number; x2: number; y2: number;
  color: string;
};
type TextStroke = { type: 'text'; x: number; y: number; text: string; color: string };
type Stroke = PencilStroke | ShapeStroke | TextStroke;

interface HunchSketchProps {
  objectId: number;
  components: ApiComponent[];
  mode?: 'editor' | 'thumbnail';
}

/* Render all finalized strokes onto ctx/rc */
function renderStrokes(
  ctx: CanvasRenderingContext2D,
  rc: ReturnType<typeof rough.canvas>,
  strokes: Stroke[],
) {
  strokes.forEach((stroke) => {
    const base = { roughness: 1.2, strokeWidth: 1.5, stroke: stroke.color, fill: 'none' as const };
    switch (stroke.type) {
      case 'pencil': {
        const pts = stroke.points;
        for (let i = 1; i < pts.length; i++) {
          rc.line(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], {
            ...base, roughness: 0.35,
          });
        }
        break;
      }
      case 'circle': {
        const cx = (stroke.x1 + stroke.x2) / 2;
        const cy = (stroke.y1 + stroke.y2) / 2;
        rc.ellipse(cx, cy, Math.abs(stroke.x2 - stroke.x1), Math.abs(stroke.y2 - stroke.y1), base);
        break;
      }
      case 'rect': {
        rc.rectangle(
          Math.min(stroke.x1, stroke.x2), Math.min(stroke.y1, stroke.y2),
          Math.abs(stroke.x2 - stroke.x1), Math.abs(stroke.y2 - stroke.y1),
          base,
        );
        break;
      }
      case 'arrow': {
        rc.line(stroke.x1, stroke.y1, stroke.x2, stroke.y2, base);
        const angle = Math.atan2(stroke.y2 - stroke.y1, stroke.x2 - stroke.x1);
        const hl = 12;
        const thin = { ...base, roughness: 0.3 };
        rc.line(stroke.x2, stroke.y2,
          stroke.x2 - hl * Math.cos(angle - 0.4), stroke.y2 - hl * Math.sin(angle - 0.4), thin);
        rc.line(stroke.x2, stroke.y2,
          stroke.x2 - hl * Math.cos(angle + 0.4), stroke.y2 - hl * Math.sin(angle + 0.4), thin);
        break;
      }
      case 'text': {
        ctx.font = '14px "Courier Prime", monospace';
        ctx.fillStyle = stroke.color;
        ctx.fillText(stroke.text, stroke.x, stroke.y);
        break;
      }
    }
  });
}

/* Render a single in-progress shape stroke (preview) */
function renderPreview(
  rc: ReturnType<typeof rough.canvas>,
  stroke: ShapeStroke,
) {
  const opts = { roughness: 1.0, strokeWidth: 1.2, stroke: stroke.color, fill: 'none' as const };
  switch (stroke.type) {
    case 'circle': {
      const cx = (stroke.x1 + stroke.x2) / 2;
      const cy = (stroke.y1 + stroke.y2) / 2;
      rc.ellipse(cx, cy, Math.abs(stroke.x2 - stroke.x1), Math.abs(stroke.y2 - stroke.y1), opts);
      break;
    }
    case 'rect':
      rc.rectangle(
        Math.min(stroke.x1, stroke.x2), Math.min(stroke.y1, stroke.y2),
        Math.abs(stroke.x2 - stroke.x1), Math.abs(stroke.y2 - stroke.y1), opts,
      );
      break;
    case 'arrow': {
      rc.line(stroke.x1, stroke.y1, stroke.x2, stroke.y2, opts);
      const angle = Math.atan2(stroke.y2 - stroke.y1, stroke.x2 - stroke.x1);
      const hl = 12;
      rc.line(stroke.x2, stroke.y2,
        stroke.x2 - hl * Math.cos(angle - 0.4), stroke.y2 - hl * Math.sin(angle - 0.4), opts);
      rc.line(stroke.x2, stroke.y2,
        stroke.x2 - hl * Math.cos(angle + 0.4), stroke.y2 - hl * Math.sin(angle + 0.4), opts);
      break;
    }
  }
}

export default function HunchSketch({ objectId, components, mode = 'editor' }: HunchSketchProps) {
  /* Find existing sketch component */
  const existingSketch = components.find(
    (c) => c.component_type_name.toLowerCase().includes('sketch'),
  );

  const parseStoredStrokes = useCallback((): Stroke[] => {
    if (!existingSketch?.value) return [];
    try { return JSON.parse(existingSketch.value) as Stroke[]; }
    catch { return []; }
  }, [existingSketch]);

  const [strokes, setStrokes] = useState<Stroke[]>(parseStoredStrokes);
  const [activeTool, setActiveTool] = useState<Tool>('pencil');
  const [activeColor, setActiveColor] = useState(SKETCH_COLORS[0]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [textPos, setTextPos] = useState<{ x: number; y: number } | null>(null);
  const [textValue, setTextValue] = useState('');

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const historyRef = useRef<Stroke[][]>([parseStoredStrokes()]);
  const historyIdxRef = useRef(0);
  const isDrawingRef = useRef(false);
  const currentStrokeRef = useRef<Stroke | null>(null);

  const W = mode === 'thumbnail' ? THUMB_W : CANVAS_W;
  const H = mode === 'thumbnail' ? THUMB_H : CANVAS_H;

  /* ── Draw to canvas ─────────────────────────── */
  const draw = useCallback((strokesToDraw: Stroke[], preview?: ShapeStroke) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);

    /* Subtle grid for editor mode */
    if (mode === 'editor') {
      ctx.strokeStyle = 'rgba(58, 54, 50, 0.06)';
      ctx.lineWidth = 0.5;
      for (let x = 0; x < W; x += 20) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
      }
      for (let y = 0; y < H; y += 20) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      }
    }

    const rc = rough.canvas(canvas);
    renderStrokes(ctx, rc, strokesToDraw);
    if (preview) renderPreview(rc, preview);
  }, [W, H, mode]);

  useEffect(() => { draw(strokes); }, [strokes, draw]);

  /* ── History helpers ─────────────────────────── */
  const syncHistory = useCallback(() => {
    setCanUndo(historyIdxRef.current > 0);
    setCanRedo(historyIdxRef.current < historyRef.current.length - 1);
  }, []);

  const pushHistory = useCallback((next: Stroke[]) => {
    const idx = historyIdxRef.current + 1;
    historyRef.current = [...historyRef.current.slice(0, idx), next].slice(-MAX_HISTORY);
    historyIdxRef.current = historyRef.current.length - 1;
    syncHistory();
  }, [syncHistory]);

  const handleUndo = useCallback(() => {
    if (historyIdxRef.current <= 0) return;
    historyIdxRef.current--;
    const prev = historyRef.current[historyIdxRef.current];
    setStrokes(prev);
    syncHistory();
  }, [syncHistory]);

  const handleRedo = useCallback(() => {
    if (historyIdxRef.current >= historyRef.current.length - 1) return;
    historyIdxRef.current++;
    const next = historyRef.current[historyIdxRef.current];
    setStrokes(next);
    syncHistory();
  }, [syncHistory]);

  /* ── Pointer coordinate helper ───────────────── */
  const getPos = (e: React.MouseEvent<HTMLCanvasElement>): [number, number] => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return [e.clientX - rect.left, e.clientY - rect.top];
  };

  /* ── Mouse events ────────────────────────────── */
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (mode === 'thumbnail') return;
    const [x, y] = getPos(e);

    if (activeTool === 'text') {
      setTextPos({ x, y });
      setTextValue('');
      return;
    }

    isDrawingRef.current = true;
    if (activeTool === 'pencil') {
      currentStrokeRef.current = { type: 'pencil', points: [[x, y]], color: activeColor };
    } else {
      currentStrokeRef.current = {
        type: activeTool as 'circle' | 'rect' | 'arrow',
        x1: x, y1: y, x2: x, y2: y, color: activeColor,
      };
    }
  }, [activeTool, activeColor, mode]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || !currentStrokeRef.current) return;
    const [x, y] = getPos(e);
    const stroke = currentStrokeRef.current;

    if (stroke.type === 'pencil') {
      stroke.points = [...stroke.points, [x, y]];
      draw(strokes, undefined);
      /* Draw pencil incrementally */
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const dpr = window.devicePixelRatio || 1;
      const rc = rough.canvas(canvas);
      ctx.save();
      ctx.scale(dpr, dpr);
      const pts = stroke.points;
      if (pts.length >= 2) {
        rc.line(pts[pts.length - 2][0], pts[pts.length - 2][1],
          pts[pts.length - 1][0], pts[pts.length - 1][1],
          { roughness: 0.35, strokeWidth: 1.5, stroke: stroke.color, fill: 'none' });
      }
      ctx.restore();
    } else {
      (stroke as ShapeStroke).x2 = x;
      (stroke as ShapeStroke).y2 = y;
      draw(strokes, stroke as ShapeStroke);
    }
  }, [strokes, draw]);

  const handleMouseUp = useCallback(() => {
    if (!isDrawingRef.current || !currentStrokeRef.current) return;
    isDrawingRef.current = false;
    const stroke = currentStrokeRef.current;
    currentStrokeRef.current = null;

    /* Skip tiny strokes */
    if (stroke.type === 'pencil' && stroke.points.length < 2) return;
    if (stroke.type === 'circle' || stroke.type === 'rect' || stroke.type === 'arrow') {
      if (Math.abs(stroke.x2 - stroke.x1) < 3 && Math.abs(stroke.y2 - stroke.y1) < 3) return;
    }

    const next = [...strokes, stroke];
    setStrokes(next);
    pushHistory(next);
  }, [strokes, pushHistory]);

  /* ── Text commit ─────────────────────────────── */
  const commitText = useCallback(() => {
    if (!textPos || !textValue.trim()) {
      setTextPos(null); setTextValue('');
      return;
    }
    const stroke: TextStroke = { type: 'text', x: textPos.x, y: textPos.y + 14, text: textValue.trim(), color: activeColor };
    const next = [...strokes, stroke];
    setStrokes(next);
    pushHistory(next);
    setTextPos(null);
    setTextValue('');
  }, [textPos, textValue, activeColor, strokes, pushHistory]);

  /* ── Save ────────────────────────────────────── */
  const handleSave = useCallback(async () => {
    setSaving(true);
    const payload = { value: JSON.stringify(strokes) };
    try {
      if (existingSketch) {
        await apiFetch(`/components/${existingSketch.id}/`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch('/components/', {
          method: 'POST',
          body: JSON.stringify({
            object: objectId,
            component_type_slug: 'sketch',
            ...payload,
          }),
        });
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      /* Silent fail: sketch is kept in local state */
    } finally {
      setSaving(false);
    }
  }, [strokes, existingSketch, objectId]);

  /* ── Thumbnail mode: read-only mini canvas ───── */
  if (mode === 'thumbnail') {
    return (
      <canvas
        ref={canvasRef}
        style={{ display: 'block', borderRadius: 2, background: 'var(--cp-card)' }}
        aria-label="Sketch thumbnail"
      />
    );
  }

  return (
    <div
      style={{
        marginBottom: 12,
        border: '1px solid var(--cp-border)',
        borderRadius: 4,
        overflow: 'hidden',
        background: 'var(--cp-card)',
      }}
    >
      {/* Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 10px',
          borderBottom: '1px solid var(--cp-border)',
          background: 'var(--cp-surface)',
        }}
      >
        {/* Tool buttons */}
        {(['pencil', 'circle', 'rect', 'arrow', 'text'] as Tool[]).map((tool) => (
          <button
            key={tool}
            type="button"
            onClick={() => setActiveTool(tool)}
            title={tool}
            style={{
              padding: '3px 7px',
              fontFamily: 'var(--cp-font-mono)',
              fontSize: 9,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              color: activeTool === tool ? 'var(--cp-bg)' : 'var(--cp-text-muted)',
              background: activeTool === tool ? activeColor : 'transparent',
              border: `1px solid ${activeTool === tool ? activeColor : 'var(--cp-border)'}`,
              borderRadius: 3,
              cursor: 'pointer',
            }}
          >
            {tool === 'pencil' ? '/' : tool === 'circle' ? 'O' : tool === 'rect' ? '[]' : tool === 'arrow' ? '->' : 'T'}
          </button>
        ))}

        <div style={{ width: 1, height: 16, background: 'var(--cp-border)', margin: '0 2px' }} />

        {/* Color dots */}
        {SKETCH_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setActiveColor(c)}
            style={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              background: c,
              border: activeColor === c ? `2px solid var(--cp-text)` : '2px solid transparent',
              cursor: 'pointer',
              padding: 0,
            }}
            aria-label={c}
          />
        ))}

        <div style={{ flex: 1 }} />

        {/* Undo / Redo */}
        <button type="button" onClick={handleUndo} disabled={!canUndo} style={ghostBtnStyle(!canUndo)}>
          UNDO
        </button>
        <button type="button" onClick={handleRedo} disabled={!canRedo} style={ghostBtnStyle(!canRedo)}>
          REDO
        </button>

        <div style={{ width: 1, height: 16, background: 'var(--cp-border)', margin: '0 2px' }} />

        {/* Save */}
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || strokes.length === 0}
          style={{
            padding: '3px 10px',
            fontFamily: 'var(--cp-font-mono)',
            fontSize: 9,
            letterSpacing: '0.05em',
            color: saved ? '#2D5F6B' : 'var(--cp-text-muted)',
            background: 'transparent',
            border: `1px solid ${saved ? '#2D5F6B' : 'var(--cp-border)'}`,
            borderRadius: 3,
            cursor: saving || strokes.length === 0 ? 'default' : 'pointer',
            opacity: saving || strokes.length === 0 ? 0.45 : 1,
          }}
        >
          {saved ? 'SAVED' : saving ? '...' : 'SAVE'}
        </button>
      </div>

      {/* Canvas area */}
      <div style={{ position: 'relative' }}>
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{
            display: 'block',
            cursor: activeTool === 'text' ? 'text' : 'crosshair',
          }}
          aria-label="Sketch canvas"
        />

        {/* Text input overlay */}
        {textPos && (
          <input
            autoFocus
            value={textValue}
            onChange={(e) => setTextValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitText();
              if (e.key === 'Escape') { setTextPos(null); setTextValue(''); }
            }}
            onBlur={commitText}
            style={{
              position: 'absolute',
              top: textPos.y,
              left: textPos.x,
              fontFamily: '"Courier Prime", monospace',
              fontSize: 14,
              color: activeColor,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              minWidth: 80,
              padding: 0,
              lineHeight: 1,
            }}
          />
        )}
      </div>
    </div>
  );
}

function ghostBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    padding: '3px 7px',
    fontFamily: 'var(--cp-font-mono)',
    fontSize: 9,
    letterSpacing: '0.05em',
    color: 'var(--cp-text-muted)',
    background: 'transparent',
    border: '1px solid var(--cp-border)',
    borderRadius: 3,
    cursor: disabled ? 'default' : 'pointer',
    opacity: disabled ? 0.35 : 1,
  };
}
