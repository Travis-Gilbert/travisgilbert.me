'use client';

import { useEffect } from 'react';
import type { LensId } from '@/lib/theseus-viz/SceneDirective';

interface AtlasLensSwitcherProps {
  lens: LensId;
  onChange: (lens: LensId) => void;
}

const LENS_OPTIONS: Array<{ id: LensId; label: string; key: string }> = [
  { id: 'flow', label: 'Flow', key: '1' },
  { id: 'atlas', label: 'Atlas', key: '2' },
  { id: 'clusters', label: 'Clusters', key: '3' },
  { id: 'orbit', label: 'Orbit', key: '4' },
];

/**
 * Three-position lens switcher. Active lens is underlined via CSS.
 * Keyboard: 1, 2, 3 switch directly (when the canvas surface has
 * focus, i.e. no input / textarea is active). Clusters is visible
 * but inert until Phase 3 lands; selecting it falls back to Atlas.
 */
export default function AtlasLensSwitcher({ lens, onChange }: AtlasLensSwitcherProps) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      const match = LENS_OPTIONS.find((o) => o.key === event.key);
      if (!match) return;
      event.preventDefault();
      onChange(match.id);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onChange]);

  return (
    <div
      className="atlas-lens-switcher"
      role="radiogroup"
      aria-label="Graph lens"
    >
      {LENS_OPTIONS.map((opt) => (
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
      ))}
    </div>
  );
}
