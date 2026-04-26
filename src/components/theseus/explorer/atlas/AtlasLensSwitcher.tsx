'use client';

import { useEffect } from 'react';
import type { LensId } from '@/lib/theseus-viz/SceneDirective';

interface AtlasLensSwitcherProps {
  lens: LensId;
  onChange: (lens: LensId) => void;
  /** Click handler for the close-read Lens tab. Receives no argument
   *  because the close-read view is a panel switch, not a canvas-mode
   *  change: the parent component reads the currently focused / selected
   *  node id and dispatches the panel switch itself. The button stays
   *  visible but inert when no node is focused; the parent disables it
   *  via the `lensReady` flag. */
  onOpenLens?: () => void;
  /** True when a node is focused or selected, so the close-read Lens
   *  tab is actionable. When false the tab is rendered disabled with
   *  a tooltip explaining how to focus a node first. */
  lensReady?: boolean;
}

interface CanvasLensOption {
  kind: 'canvas';
  id: LensId;
  label: string;
  key: string;
}

interface CloseReadLensOption {
  kind: 'close-read';
  id: 'lens';
  label: string;
  key: string;
}

type LensOption = CanvasLensOption | CloseReadLensOption;

const LENS_OPTIONS: LensOption[] = [
  { kind: 'canvas', id: 'flow', label: 'Flow', key: '1' },
  { kind: 'canvas', id: 'atlas', label: 'Atlas', key: '2' },
  { kind: 'canvas', id: 'clusters', label: 'Clusters', key: '3' },
  { kind: 'canvas', id: 'orbit', label: 'Orbit', key: '4' },
  // Close-read Lens is a panel switch rather than a canvas-mode change,
  // but it lives in this same row because users expect "Lens" to be a
  // peer of the other view modes (per design feedback 2026-04-26).
  // Keyboard `5` mirrors `L` (which the ExplorerShell handler also
  // accepts) for symmetry with 1/2/3/4.
  { kind: 'close-read', id: 'lens', label: 'Lens', key: '5' },
];

/**
 * Lens switcher row. Four canvas-mode tabs (Flow / Atlas / Clusters /
 * Orbit) plus one close-read panel switch (Lens). Active canvas mode
 * is underlined via CSS; the close-read tab is highlighted only while
 * the close-read panel is mounted. Keyboard 1/2/3/4 switch canvas
 * modes; keyboard 5 dispatches `onOpenLens` (the parent resolves the
 * focused node id and pushes the panel switch). When no node is
 * focused the close-read tab renders disabled with a hint.
 */
export default function AtlasLensSwitcher({
  lens,
  onChange,
  onOpenLens,
  lensReady = false,
}: AtlasLensSwitcherProps) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      const match = LENS_OPTIONS.find((o) => o.key === event.key);
      if (!match) return;
      if (match.kind === 'close-read') {
        if (!lensReady || !onOpenLens) return;
        event.preventDefault();
        onOpenLens();
        return;
      }
      event.preventDefault();
      onChange(match.id);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onChange, onOpenLens, lensReady]);

  return (
    <div
      className="atlas-lens-switcher"
      role="radiogroup"
      aria-label="Graph lens"
    >
      {LENS_OPTIONS.map((opt) => {
        if (opt.kind === 'close-read') {
          const disabled = !lensReady || !onOpenLens;
          return (
            <button
              key={opt.id}
              type="button"
              className={`atlas-lens-btn${disabled ? ' is-disabled' : ''}`}
              role="radio"
              aria-checked={false}
              aria-disabled={disabled || undefined}
              title={
                disabled
                  ? 'Focus a node (click it on the canvas) to open the Lens.'
                  : `Open the focused node in the Lens close-read view (${opt.key})`
              }
              onClick={() => {
                if (disabled || !onOpenLens) return;
                onOpenLens();
              }}
            >
              <span className="atlas-lens-btn-label">{opt.label}</span>
              <span className="atlas-lens-btn-key" aria-hidden="true">{opt.key}</span>
            </button>
          );
        }
        return (
          <button
            key={opt.id}
            type="button"
            className={`atlas-lens-btn${lens === opt.id ? ' is-active' : ''}`}
            role="radio"
            aria-checked={lens === opt.id}
            title={`Switch to ${opt.label} lens (${opt.key})`}
            onClick={() => onChange(opt.id)}
          >
            <span className="atlas-lens-btn-label">{opt.label}</span>
            <span className="atlas-lens-btn-key" aria-hidden="true">{opt.key}</span>
          </button>
        );
      })}
    </div>
  );
}
