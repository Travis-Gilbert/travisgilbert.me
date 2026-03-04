import type { Metadata } from 'next';
import CommonPlaceSidebar from '@/components/commonplace/CommonPlaceSidebar';
import SplitPaneContainer from '@/components/commonplace/SplitPaneContainer';
import '@/styles/commonplace.css';

export const metadata: Metadata = {
  title: {
    default: 'CommonPlace',
    template: '%s | CommonPlace',
  },
  description:
    'Personal knowledge workbench. Objects exist. Nodes happen. Capture without obligation.',
};

/**
 * CommonPlace layout: warm studio shell with split pane system.
 *
 * Does NOT render html/body (the root layout handles that).
 * Applies the `commonplace-theme` class to scope all CSS
 * custom properties.
 *
 * Visual layers (back to front):
 *   1. Cream parchment background (#F2EDE5)
 *   2. Blueprint grid (40px terracotta lines at ~5.5% opacity)
 *   3. Terracotta upper-right ambient glow (radial-gradient, 4.5%)
 *   4. Paper grain (SVG noise at 3% on main, 5% on sidebar)
 *   5. Sidebar (warm near-black #1A1614) with its own glow
 *   6. Split pane system (recursive binary tree layout)
 */
export default function CommonPlaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className="commonplace-theme"
      style={{
        display: 'flex',
        minHeight: '100vh',
        backgroundColor: 'var(--cp-bg)',
        color: 'var(--cp-text)',
        margin: 0,
      }}
    >
      {/* Terracotta upper-right ambient glow */}
      <div className="cp-ambient-glow" aria-hidden="true" />

      {/* Sidebar: 240px fixed, warm dark with paper grain */}
      <CommonPlaceSidebar />

      {/* Main content area: blueprint grid + paper grain + split panes */}
      <main
        className="cp-blueprint-grid cp-grain"
        style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
        }}
      >
        <SplitPaneContainer />
      </main>
    </div>
  );
}
