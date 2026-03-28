'use client';

import { useState, useEffect, useRef } from 'react';
import type { Editor } from '@tiptap/react';

const STORAGE_KEY = 'studio-highlight-colors-v1';

export type HighlightColor = {
  id: string;
  color: string;
  label: string;
};

const DEFAULT_COLORS: HighlightColor[] = [
  { id: '1', color: 'rgba(212, 170, 74, 0.25)', label: '' },
  { id: '2', color: 'rgba(45, 95, 107, 0.20)', label: '' },
  { id: '3', color: 'rgba(138, 106, 154, 0.22)', label: '' },
];

export function getHighlightColors(): HighlightColor[] {
  if (typeof window === 'undefined') return DEFAULT_COLORS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_COLORS;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_COLORS;
    return parsed.slice(0, 4);
  } catch {
    return DEFAULT_COLORS;
  }
}

export function saveHighlightColors(colors: HighlightColor[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(colors.slice(0, 4)));
}

export default function HighlightPicker({
  editor,
  onClose,
}: {
  editor: Editor;
  onClose: () => void;
}) {
  const [colors] = useState(getHighlightColors);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  const applyHighlight = (color: string) => {
    editor.chain().focus().toggleHighlight({ color }).run();
    onClose();
  };

  const removeHighlight = () => {
    editor.chain().focus().unsetHighlight().run();
    onClose();
  };

  return (
    <div
      ref={ref}
      className="studio-highlight-picker"
    >
      <div className="studio-highlight-picker-swatches">
        {colors.map((c) => (
          <button
            key={c.id}
            type="button"
            className="studio-highlight-swatch"
            style={{ backgroundColor: c.color }}
            onClick={() => applyHighlight(c.color)}
            title={c.label || `Highlight ${c.id}`}
            aria-label={c.label || `Apply highlight color ${c.id}`}
          >
            {c.label && (
              <span className="studio-highlight-swatch-label">{c.label}</span>
            )}
          </button>
        ))}
        <button
          type="button"
          className="studio-highlight-swatch studio-highlight-swatch--remove"
          onClick={removeHighlight}
          title="Remove highlight"
          aria-label="Remove highlight"
        >
          &times;
        </button>
      </div>
    </div>
  );
}
