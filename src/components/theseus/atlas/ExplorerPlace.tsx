'use client';

import { useState } from 'react';
import SurfaceCheck from './SurfaceCheck';
import type { AtlasSurfaces } from './useAtlasFilters';

interface ExplorerPlaceProps {
  n: string;
  active: boolean;
  onOpen: () => void;
  surfaces: AtlasSurfaces;
  onToggleSurface: (key: keyof AtlasSurfaces) => void;
  scopeLabel: string;
}

/**
 * Sidebar "02 Explorer" place. Primary row opens the Explorer panel.
 * Chevron expands the three surface checkboxes:
 *   - Theseus:      pipeline-ingested corpus (scope axis)
 *   - Theorem Web:  your captures (scope axis)
 *   - Code Graph:   client-side code-kind overlay
 * The first two together derive the backend scope (combined / corpus /
 * personal) in useAtlasFilters. Row meta shows the derived scope label.
 */
export default function ExplorerPlace({
  n,
  active,
  onOpen,
  surfaces,
  onToggleSurface,
  scopeLabel,
}: ExplorerPlaceProps) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1, marginBottom: 2 }}>
      <div className={`atlas-place-row${active ? ' active' : ''}`}>
        <span className="n">{n}</span>
        <button className="label-btn" type="button" onClick={onOpen}>
          Explorer
        </button>
        <span className="meta" style={{ color: 'var(--ink-3)' }}>{scopeLabel}</span>
        <button
          className="chev"
          type="button"
          data-open={open ? 'true' : 'false'}
          onClick={() => setOpen((o) => !o)}
          title={open ? 'Collapse surfaces' : 'Surfaces'}
          aria-label={open ? 'Collapse surface overlays' : 'Expand surface overlays'}
        >
          ▸
        </button>
      </div>
      {open && (
        <div className="atlas-place-children">
          <SurfaceCheck
            on={surfaces.theseus}
            onChange={() => onToggleSurface('theseus')}
            dotColor="var(--rose)"
            label="Theseus"
            description="pipeline-ingested corpus"
          />
          <SurfaceCheck
            on={surfaces.theorem}
            onChange={() => onToggleSurface('theorem')}
            dotColor="var(--plum)"
            label="Theorem Web"
            description="your captures"
          />
          <SurfaceCheck
            on={surfaces.codeGraph}
            onChange={() => onToggleSurface('codeGraph')}
            dotColor="var(--mauve)"
            label="Code Graph"
            description="code symbols, commits, repositories"
          />
          <div className="atlas-place-note">{scopeLabel.toLowerCase()}</div>
        </div>
      )}
    </div>
  );
}
