import type { Metadata } from 'next';
import DotGrid from '@/components/DotGrid';
import { CommonPlaceProvider } from '@/lib/commonplace-context';
import CommonPlaceSidebar from '@/components/commonplace/CommonPlaceSidebar';
import SplitPaneContainer from '@/components/commonplace/SplitPaneContainer';
import CommandPalette from '@/components/commonplace/CommandPalette';
import ObjectDrawer from '@/components/commonplace/ObjectDrawer';
import ObjectContextMenu from '@/components/commonplace/ObjectContextMenu';
import { Toaster } from 'sonner';
import '@/styles/commonplace.css';

export const metadata: Metadata = {
  title: {
    default: 'CommonPlace',
    template: '%s | CommonPlace',
  },
  description:
    'Personal knowledge workbench. Objects exist. Nodes happen. Capture without obligation.',
  icons: {
    icon: [
      { url: '/commonplace/icon.svg', type: 'image/svg+xml' },
      { url: '/commonplace/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/commonplace/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
    ],
    apple: [
      { url: '/commonplace/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
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
 *   2. Vignette dots (24px grid, terracotta at 4% opacity, radial edge fade)
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
      className="commonplace-theme cp-shell-root"
      style={{
        display: 'flex',
        minHeight: '100vh',
        backgroundColor: 'var(--cp-bg)',
        color: 'var(--cp-text)',
        margin: 0,
      }}
    >
      <DotGrid
        dotRadius={0.7}
        spacing={20}
        dotColor={[80, 80, 92]}
        dotOpacity={0.12}
        binaryDensity={0.0}
        fadeStart={0.72}
        fadeEnd={0.96}
        noGradient
      />

      {/* Terracotta upper-right ambient glow */}
      <div className="cp-ambient-glow" aria-hidden="true" />

      {/* Provider: lets Sidebar notify Timeline of new captures */}
      <CommonPlaceProvider>
        {/* Sidebar: 240px fixed, warm dark with paper grain */}
        <CommonPlaceSidebar />

        {/* Main content area: vignette dots + paper grain + split panes */}
        <main
          className="cp-main-surface cp-grain"
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

        {/* Global overlays: object drawer, command palette, context menu, toast notifications */}
        <ObjectDrawer />
        <CommandPalette />
        <ObjectContextMenu />
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: '#FAF6F1',
              border: '1px solid rgba(58, 54, 50, 0.12)',
              color: '#3A3632',
              fontFamily: 'var(--font-metadata, "Courier Prime", monospace)',
              fontSize: '13px',
            },
          }}
        />
      </CommonPlaceProvider>
    </div>
  );
}
