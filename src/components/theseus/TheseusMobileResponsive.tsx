'use client';

import { useEffect } from 'react';

/**
 * Mobile responsive overrides for /theseus.
 *
 * Append-only stylesheet injected at the end of the cascade so it wins
 * over the 155KB theseus.css without modifying it. Targets the actual
 * mobile rendering bug: the 220px .atlas-sidebar renders on small
 * viewports because the existing mobile media queries only hide the
 * legacy 48px .theseus-sidebar.
 *
 * Three rules below 768px:
 *   1. Hide .atlas-sidebar entirely.
 *   2. Force .theseus-mobile-nav to display (CSS default is none).
 *   3. Make .atlas-main / main-area take full width with bottom padding
 *      to clear the fixed mobile tab bar.
 *
 * No HTML, no React tree changes, no existing-file edits. Mounted from
 * the existing theseus/layout.tsx via a one-line import.
 */
export default function TheseusMobileResponsive() {
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const styleId = 'theseus-mobile-responsive';
    if (document.getElementById(styleId)) return;

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      @media (max-width: 767px) {
        /* Collapse the 220px Atlas sidebar on phones. */
        .theseus-root .atlas-sidebar {
          display: none !important;
        }

        /* Show the mobile bottom-tab nav (CSS default is display:none). */
        .theseus-root .theseus-mobile-nav {
          display: flex !important;
          position: fixed;
          left: 0;
          right: 0;
          bottom: 0;
          z-index: 60;
          height: calc(56px + env(safe-area-inset-bottom));
          padding-bottom: env(safe-area-inset-bottom);
          background: rgba(15, 16, 18, 0.92);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border-top: 1px solid rgba(255, 255, 255, 0.06);
        }

        .theseus-root .theseus-mobile-nav-item {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 3px;
          background: transparent;
          border: 0;
          color: var(--ink-3, #847869);
          font-family: var(--font-mono, ui-monospace, monospace);
          font-size: 9px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          cursor: pointer;
          padding: 6px 4px;
        }

        .theseus-root .theseus-mobile-nav-item.is-active {
          color: var(--brass, #B09468);
        }

        .theseus-root .theseus-mobile-nav-label {
          line-height: 1;
        }

        /* Reclaim the viewport for content and clear the bottom nav. */
        .theseus-root,
        .theseus-root .theseus-content,
        .theseus-root .atlas-main {
          margin-left: 0 !important;
          width: 100vw !important;
          max-width: 100vw !important;
          grid-template-columns: 1fr !important;
        }

        .theseus-root .atlas-main,
        .theseus-root .theseus-content {
          padding-bottom: calc(56px + env(safe-area-inset-bottom)) !important;
        }

        /* Stop horizontal scroll when content is wider than viewport. */
        .theseus-root {
          overflow-x: hidden;
        }
      }
    `;
    document.head.appendChild(style);

    return () => {
      const existing = document.getElementById(styleId);
      if (existing) existing.remove();
    };
  }, []);

  return null;
}
