'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Editor } from '@tiptap/react';

interface HeadingEntry {
  level: number;
  text: string;
  pos: number;       // ProseMirror position of the heading node
  endPos: number;    // end of this heading's "section" (start of next heading or doc end)
  wordCount: number; // words in the section under this heading
}

/**
 * Draggable heading cards in the outline tab. Reordering cards
 * restructures the actual Tiptap/ProseMirror document by moving
 * the heading node and all content between it and the next heading.
 *
 * Cards show heading text, word count badge, and depth indentation
 * (H1 flush, H2 +16px, H3 +32px).
 */
export default function OutlineDragWall({
  editor,
  stageColor,
}: {
  editor: Editor | null;
  stageColor?: string;
}) {
  const [headings, setHeadings] = useState<HeadingEntry[]>([]);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<number | null>(null);

  /* Extract headings with positions and word counts */
  const extractHeadings = useCallback(() => {
    if (!editor) {
      setHeadings([]);
      return;
    }

    const doc = editor.state.doc;
    const raw: { level: number; text: string; pos: number }[] = [];

    doc.descendants((node, pos) => {
      if (node.type.name === 'heading' && node.textContent.trim()) {
        raw.push({
          level: (node.attrs.level as number) ?? 1,
          text: node.textContent,
          pos,
        });
      }
      return true;
    });

    /* Compute section boundaries and word counts */
    const entries: HeadingEntry[] = raw.map((h, i) => {
      const nextStart = i + 1 < raw.length ? raw[i + 1].pos : doc.content.size;
      const sectionText = doc.textBetween(h.pos, nextStart, ' ', ' ');
      const words = sectionText.split(/\s+/).filter(Boolean).length;

      return {
        level: h.level,
        text: h.text,
        pos: h.pos,
        endPos: nextStart,
        wordCount: words,
      };
    });

    setHeadings(entries);
  }, [editor]);

  /* Re-extract on editor updates */
  useEffect(() => {
    if (!editor) return;
    extractHeadings();
    editor.on('update', extractHeadings);
    return () => {
      editor.off('update', extractHeadings);
    };
  }, [editor, extractHeadings]);

  /* Scroll to heading in editor */
  const scrollToHeading = useCallback(
    (pos: number) => {
      if (!editor) return;
      editor.commands.focus();
      editor.commands.setTextSelection(pos + 1);

      const domAtPos = editor.view.domAtPos(pos + 1);
      const el =
        domAtPos.node instanceof HTMLElement
          ? domAtPos.node
          : domAtPos.node.parentElement;
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    },
    [editor],
  );

  /* Drag handlers */
  const handleDragStart = useCallback((idx: number) => {
    setDragIdx(idx);
  }, []);

  const handleDragOver = useCallback(
    (e: React.DragEvent, idx: number) => {
      e.preventDefault();
      if (dragIdx !== null && dragIdx !== idx) {
        setDropTarget(idx);
      }
    },
    [dragIdx],
  );

  const handleDrop = useCallback(
    (targetIdx: number) => {
      if (dragIdx === null || dragIdx === targetIdx || !editor) return;

      const src = headings[dragIdx];
      const tgt = headings[targetIdx];
      if (!src || !tgt) return;

      /* Move the section in a single ProseMirror transaction */
      const { tr, doc } = editor.state;
      const srcFrom = src.pos;
      const srcTo = src.endPos;

      /* Extract the slice we want to move */
      const slice = doc.slice(srcFrom, srcTo);

      if (dragIdx < targetIdx) {
        /* Moving down: insert at target end, then delete source */
        const insertAt = tgt.endPos;
        tr.insert(insertAt, slice.content);
        tr.delete(srcFrom, srcTo);
      } else {
        /* Moving up: delete source first, then insert at target start */
        tr.delete(srcFrom, srcTo);
        /* After deletion, target pos shifts if target was before source */
        const adjustedTarget = tgt.pos;
        tr.insert(adjustedTarget, slice.content);
      }

      editor.view.dispatch(tr);

      setDragIdx(null);
      setDropTarget(null);
    },
    [dragIdx, headings, editor],
  );

  const handleDragEnd = useCallback(() => {
    setDragIdx(null);
    setDropTarget(null);
  }, []);

  const color = stageColor ?? '#B45A2D';

  if (!editor) return null;

  if (headings.length === 0) {
    return (
      <div style={{ marginTop: '6px' }}>
        <p
          style={{
            fontFamily: 'var(--studio-font-body)',
            fontSize: '12px',
            color: 'var(--studio-text-3)',
            fontStyle: 'italic',
          }}
        >
          No headings yet. Add headings to enable the drag wall.
        </p>
      </div>
    );
  }

  return (
    <div className="outline-drag-wall">
      {headings.map((h, idx) => {
        const isDragging = dragIdx === idx;
        const isDropTarget = dropTarget === idx;
        const indent = (h.level - 1) * 16;

        return (
          <div
            key={`${h.text}-${h.pos}`}
            className={`outline-drag-card ${isDragging ? 'outline-drag-card--dragging' : ''} ${isDropTarget ? 'outline-drag-card--drop-target' : ''}`}
            style={{ marginLeft: `${indent}px` }}
            draggable
            onDragStart={() => handleDragStart(idx)}
            onDragOver={(e) => handleDragOver(e, idx)}
            onDrop={() => handleDrop(idx)}
            onDragEnd={handleDragEnd}
          >
            {/* Connecting line (except first card) */}
            {idx > 0 && (
              <div className="outline-drag-connector" />
            )}

            {/* Card body */}
            <button
              type="button"
              className="outline-drag-card-inner"
              onClick={() => scrollToHeading(h.pos)}
              style={{
                borderLeftColor: h.level === 1 ? color : `color-mix(in srgb, ${color} 50%, transparent)`,
              }}
            >
              <span className="outline-drag-card-text">
                {h.text}
              </span>
              <span
                className="outline-drag-card-words"
                style={{
                  color: `color-mix(in srgb, ${color} 70%, var(--studio-text-3))`,
                }}
              >
                {h.wordCount}w
              </span>
            </button>

            {/* Drag grip dots */}
            <div className="outline-drag-grip" aria-hidden="true">
              <span />
              <span />
              <span />
              <span />
              <span />
              <span />
            </div>
          </div>
        );
      })}
    </div>
  );
}
