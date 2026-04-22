'use client';

import { useState } from 'react';

export interface AtlasThread {
  id: string;
  label: string;
  meta: string;
}

interface ThreadsPlaceProps {
  n: string;
  active: boolean;
  onOpen: () => void;
  onNew: () => void;
  onPickThread: (thread: AtlasThread) => void;
  threads: AtlasThread[];
  metaShortcut?: string;
}

/**
 * Sidebar "01 Threads" place. Primary row opens the Ask/Threads panel;
 * chevron toggles the dropdown whose first item is `+ New` and whose rest
 * is previous threads.
 */
export default function ThreadsPlace({
  n,
  active,
  onOpen,
  onNew,
  onPickThread,
  threads,
  metaShortcut = '⌘1',
}: ThreadsPlaceProps) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1, marginBottom: 2 }}>
      <div className={`atlas-place-row${active ? ' active' : ''}`}>
        <span className="n">{n}</span>
        <button className="label-btn" type="button" onClick={onOpen}>
          Threads
        </button>
        <span className="meta">{metaShortcut}</span>
        <button
          className="chev"
          type="button"
          data-open={open ? 'true' : 'false'}
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? 'Collapse threads list' : 'Expand threads list'}
        >
          ▸
        </button>
      </div>

      {open && (
        <div className="atlas-place-children">
          <button
            type="button"
            className="atlas-nav-item"
            onClick={() => {
              onNew();
              setOpen(false);
            }}
          >
            <span className="n" style={{ color: 'var(--accent-color)', fontWeight: 500 }}>+</span>
            <span style={{ color: 'var(--ink-2)' }}>New</span>
            <span className="meta">blank thread</span>
          </button>
          {threads.length > 0 && <div className="atlas-place-children-sep">Previous</div>}
          {threads.map((t) => (
            <button
              key={t.id}
              type="button"
              className="atlas-nav-item"
              onClick={() => onPickThread(t)}
            >
              <span className="n">·</span>
              <span>{t.label}</span>
              <span className="meta">{t.meta}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
