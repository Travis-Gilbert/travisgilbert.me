'use client';

import { useState } from 'react';
import SurfaceCheck from './SurfaceCheck';
import type { AtlasSurfaces } from './useAtlasFilters';
import type { GraphScope } from '@/lib/theseus-api';

interface ExplorerPlaceProps {
  n: string;
  active: boolean;
  onOpen: () => void;
  surfaceLabel: string;
  surfaces: AtlasSurfaces;
  onToggleSurface: (key: keyof AtlasSurfaces) => void;
  scope: GraphScope;
  onChangeScope: (scope: GraphScope) => void;
  scopeLabel: string;
}

const SCOPE_OPTIONS: Array<{ value: GraphScope; label: string; description: string }> = [
  { value: 'combined', label: 'Combined', description: 'Theseus corpus + your captures' },
  { value: 'corpus', label: 'Corpus', description: 'pipeline-ingested corpus only' },
  { value: 'personal', label: 'Personal', description: 'only what you captured' },
];

/**
 * Sidebar "02 Explorer" place. Primary row opens the Explorer panel;
 * chevron expands scope radios (Combined / Corpus / Personal) and the
 * three surface overlays (Theseus, Theorem Web, Code Graph). Scope is
 * the baseline data filter; surfaces are additional overlays layered on
 * top. Clicking the label jumps to the Explorer panel.
 */
export default function ExplorerPlace({
  n,
  active,
  onOpen,
  surfaceLabel,
  surfaces,
  onToggleSurface,
  scope,
  onChangeScope,
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
          title={open ? 'Collapse explorer options' : 'Scope and surfaces'}
          aria-label={open ? 'Collapse explorer options' : 'Expand explorer options'}
        >
          ▸
        </button>
      </div>
      {open && (
        <div className="atlas-place-children">
          <div
            role="radiogroup"
            aria-label="Graph scope"
            style={{ display: 'flex', flexDirection: 'column', gap: 2 }}
          >
            {SCOPE_OPTIONS.map((opt) => {
              const checked = opt.value === scope;
              return (
                <label
                  key={opt.value}
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: 8,
                    padding: '4px 2px',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    letterSpacing: '0.04em',
                    cursor: 'pointer',
                    color: checked ? 'var(--ink)' : 'var(--ink-2)',
                  }}
                >
                  <input
                    type="radio"
                    name="explorer-scope"
                    value={opt.value}
                    checked={checked}
                    onChange={() => onChangeScope(opt.value)}
                    style={{ accentColor: 'var(--rose, currentColor)' }}
                  />
                  <span style={{ fontWeight: checked ? 500 : 400 }}>{opt.label}</span>
                  <span style={{ color: 'var(--ink-3)', fontSize: 10 }}>
                    {opt.description}
                  </span>
                </label>
              );
            })}
          </div>
          <div
            style={{
              borderTop: '1px solid var(--rule, rgba(255,255,255,0.06))',
              margin: '6px 0 4px',
            }}
            aria-hidden="true"
          />
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
            {surfaces.theseus || surfaces.theorem || surfaces.codeGraph
              ? `${surfaceLabel} over ${scopeLabel.toLowerCase()}`
              : scopeLabel.toLowerCase()}
          </div>
        </div>
      )}
    </div>
  );
}
