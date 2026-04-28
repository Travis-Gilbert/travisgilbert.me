'use client';

import { useEffect, useMemo, useState } from 'react';
import type { PanelId } from '../PanelManager';

interface AtlasCommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onPick: (panel: PanelId) => void;
}

interface PaletteAction {
  panel: PanelId;
  label: string;
  kind: string;
}

const ACTIONS: PaletteAction[] = [
  { panel: 'ask', label: 'Open Threads', kind: 'go' },
  { panel: 'explorer', label: 'Open Explorer', kind: 'go' },
  { panel: 'plugins', label: 'Open Plugins', kind: 'go' },
  { panel: 'code', label: 'Open Code', kind: 'go' },
  { panel: 'notebook', label: 'Open Notebook', kind: 'go' },
];

export default function AtlasCommandPalette({
  open,
  onClose,
  onPick,
}: AtlasCommandPaletteProps) {
  const [q, setQ] = useState('');
  const [cursor, setCursor] = useState(0);

  const filtered = useMemo(() => {
    if (!q.trim()) return ACTIONS;
    const needle = q.trim().toLowerCase();
    return ACTIONS.filter((a) => a.label.toLowerCase().includes(needle));
  }, [q]);

  useEffect(() => {
    if (!open) {
      setQ('');
      setCursor(0);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handle(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setCursor((c) => Math.min(c + 1, Math.max(0, filtered.length - 1)));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setCursor((c) => Math.max(0, c - 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const pick = filtered[cursor];
        if (pick) {
          onPick(pick.panel);
          onClose();
        }
      }
    }
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, [open, filtered, cursor, onClose, onPick]);

  if (!open) return null;

  return (
    <div className="atlas-cmdk-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="atlas-cmdk" onClick={(e) => e.stopPropagation()}>
        <div className="atlas-cmdk-head">
          <span className="atlas-cmdk-eyebrow">Go to…</span>
          <input
            autoFocus
            className="atlas-cmdk-input"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setCursor(0);
            }}
            placeholder="type a destination…"
            aria-label="Command palette input"
          />
          <kbd>esc</kbd>
        </div>
        <div className="atlas-cmdk-list">
          {filtered.map((a, i) => (
            <button
              key={a.panel}
              type="button"
              className={`atlas-cmdk-item${i === cursor ? ' is-active' : ''}`}
              onMouseEnter={() => setCursor(i)}
              onClick={() => {
                onPick(a.panel);
                onClose();
              }}
            >
              <span>{a.label}</span>
              <span className="kind">{a.kind}</span>
            </button>
          ))}
          {filtered.length === 0 && (
            <div
              style={{
                padding: 12,
                fontFamily: 'var(--font-body)',
                fontSize: 13,
                color: 'var(--ink-3)',
              }}
            >
              No matches.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
