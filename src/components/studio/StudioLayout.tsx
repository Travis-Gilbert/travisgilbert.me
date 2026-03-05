'use client';

import { useState } from 'react';
import StudioSidebar from './StudioSidebar';

/**
 * Studio shell: two-column layout.
 *
 * Left:   232px sidebar (navigation, wordmark, quick capture)
 * Center: fluid main area (dashboard, content lists, editor)
 *
 * Handles mobile sidebar drawer toggle. Desktop: side-by-side flex.
 * Mobile (<768px): sidebar slides in as overlay with backdrop.
 *
 * Background layers (applied via CSS classes in studio.css):
 *   dot field, grid lines, paper grain, corner glow.
 * The layout.tsx wrapper provides the outermost .studio-theme scope.
 */
export default function StudioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Desktop sidebar (visible lg+) */}
      <StudioSidebar />

      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="studio-mobile-backdrop"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Mobile sidebar drawer */}
      <div
        className="studio-sidebar-mobile"
        data-open={mobileOpen ? 'true' : undefined}
      >
        <StudioSidebar />
      </div>

      {/* Main content area */}
      <main
        className="studio-main studio-scrollbar"
        style={{
          flex: 1,
          minWidth: 0,
          overflowY: 'auto',
          position: 'relative',
        }}
      >
        {/* Mobile header bar */}
        <div className="studio-mobile-header">
          <button
            type="button"
            className="studio-mobile-menu-btn"
            onClick={() => setMobileOpen(true)}
            aria-label="Open sidebar"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            >
              <line x1="3" y1="5" x2="17" y2="5" />
              <line x1="3" y1="10" x2="17" y2="10" />
              <line x1="3" y1="15" x2="17" y2="15" />
            </svg>
          </button>
          <span
            style={{
              fontFamily: 'var(--studio-font-title)',
              fontWeight: 700,
              fontSize: '18px',
              color: 'var(--studio-text-bright)',
            }}
          >
            Studio
            <span style={{ color: 'var(--studio-tc)' }}>.</span>
          </span>
        </div>

        {/* Page content */}
        <div style={{ position: 'relative', zIndex: 1 }}>{children}</div>
      </main>
    </>
  );
}
