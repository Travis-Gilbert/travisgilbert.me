'use client';

import { useState } from 'react';
import SurfaceCheck from './SurfaceCheck';
import type { AtlasSurfaces } from './useAtlasFilters';

interface ExplorerPlaceProps {
  n: string;
  active: boolean;
  onOpen: () => void;
  surfaceLabel: string;
  surfaces: AtlasSurfaces;
  onToggleSurface: (key: keyof AtlasSurfaces) => void;
}

/**
 * Sidebar "02 Explorer" place. Primary row opens the Explorer panel;
 * chevron toggles the three surface overlays (Theseus, Theorem Web,
 * Code Graph). Clicking the label jumps to the Explorer panel.
 */
export default function ExplorerPlace({
  n,
  active,
  onOpen,
  surfaceLabel,
  surfaces,
  onToggleSurface,
}: ExplorerPlaceProps) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1, marginBottom: 2 }}>
      <div className={`atlas-place-row${active ? ' active' : ''}`}>
        <span className="n">{n}</span>
        <button className="label-btn" type="button" onClick={onOpen}>
          Explorer
        </button>
        <span className="meta" style={{ color: 'var(--ink-3)' }}>{surfaceLabel}</span>
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
            description="filtered knowledge base"
          />
          <SurfaceCheck
            on={surfaces.theorem}
            onChange={() => onToggleSurface('theorem')}
            dotColor="var(--plum)"
            label="Theorem Web"
            description="federated multi-user graph"
          />
          <SurfaceCheck
            on={surfaces.codeGraph}
            onChange={() => onToggleSurface('codeGraph')}
            dotColor="var(--mauve)"
            label="Code Graph"
            description="code symbols, commits, and repositories"
          />
          <div className="atlas-place-note">
            {!surfaces.theseus && !surfaces.theorem && !surfaces.codeGraph
              ? 'your personal graph'
              : 'overlaid on Argo'}
          </div>
        </div>
      )}
    </div>
  );
}
