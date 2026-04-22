'use client';

import { useState } from 'react';
import { ATLAS_SOURCES, ATLAS_KINDS, type AtlasKind } from './sources';

interface AtlasFilterBlockProps {
  activeSources: Set<string>;
  activeKinds: Set<AtlasKind>;
  onToggleSource: (id: string) => void;
  onToggleKind: (kind: AtlasKind) => void;
}

/**
 * Collapsible Filters block pinned to the bottom of the sidebar.
 * Writes to atlasFilters state in TheseusShell; Explorer reads the same
 * state to filter the cosmos.gl graph.
 */
export default function AtlasFilterBlock({
  activeSources,
  activeKinds,
  onToggleSource,
  onToggleKind,
}: AtlasFilterBlockProps) {
  const [open, setOpen] = useState(true);

  return (
    <div className="atlas-filter-block">
      <button
        type="button"
        className="atlas-filter-head"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span>Filters</span>
        <span className="caret">{open ? '–' : '+'}</span>
      </button>
      {open && (
        <>
          <div className="atlas-filter-pills">
            {ATLAS_SOURCES.map((s) => {
              const on = activeSources.has(s.id);
              const short = s.name.split(' ')[0];
              return (
                <button
                  key={s.id}
                  type="button"
                  className={`chip${on ? ' on' : ''}`}
                  onClick={() => onToggleSource(s.id)}
                  title={s.detail}
                >
                  <span className="sw" style={{ background: s.color }} />
                  {short}
                </button>
              );
            })}
          </div>
          <div className="atlas-filter-pills">
            {(Object.keys(ATLAS_KINDS) as AtlasKind[]).map((k) => {
              const on = activeKinds.has(k);
              return (
                <button
                  key={k}
                  type="button"
                  className={`chip${on ? ' on' : ''}`}
                  onClick={() => onToggleKind(k)}
                >
                  <span className="sw" style={{ background: ATLAS_KINDS[k].color }} />
                  {k}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
