import type { Metadata } from 'next';
import DotGrid from '@/components/DotGrid';
import { CommonPlaceProviders } from '@/lib/providers/commonplace-providers';
import CommonPlaceShell from '@/components/commonplace/shell/CommonPlaceShell';
import CommandPalette from '@/components/commonplace/shell/CommandPalette';
import ObjectDrawer from '@/components/commonplace/shared/ObjectDrawer';
import ObjectContextMenu from '@/components/commonplace/shared/ObjectContextMenu';
import ConnectionComposer from '@/components/commonplace/compose/ConnectionComposer';
import EngineTerminal from '@/components/commonplace/engine/EngineTerminal';
import ReaderOverlay from '@/components/commonplace/reader/ReaderOverlay';
import { Toaster } from 'sonner';
import shellStyles from '@/components/commonplace/shell/CommonPlaceShell.module.css';
import '@/styles/commonplace-tokens.css';
import '@/styles/commonplace.css';
import '@/styles/object-cards.css';
import '@/styles/reading-pane.css';

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
 * CommonPlace layout: chrome shell with navigation and split pane system.
 *
 * Does NOT render html/body (the root layout handles that).
 * Applies the `commonplace-theme` class to scope all CSS
 * custom properties.
 *
 * Visual layers (back to front):
 *   1. Chrome shell background with construction grid
 *   2. Ambient red-pencil glow
 *   3. Navigation (top bar + rail or sidebar, via CommonPlaceShell)
 *   4. Split pane system
 *   5. Engine terminal (fixed bottom, portal to body)
 */
export default function CommonPlaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className={`commonplace-theme ${shellStyles.shellRoot}`}
      style={{
        display: 'flex',
        height: '100vh',
        overflow: 'hidden',
        color: 'var(--cp-text)',
        margin: 0,
      }}
    >
      {/* Site DotGrid: inverse vignette (clean center, dots fade in at edges) */}
      <DotGrid noGradient inverseVignette dotOpacity={0.12} />

      {/* Ambient red-pencil glow */}
      <div className={shellStyles.ambientGlow} aria-hidden="true" />

      {/* Provider: lets navigation notify Timeline of new captures */}
      <CommonPlaceProviders>
        {/* Shell: handles nav-mode toggle (topbar vs sidebar) */}
        <CommonPlaceShell />

        {/* Global overlays: object drawer, command palette, context menu, engine terminal, toast notifications */}
        <ObjectDrawer />
        <ReaderOverlay />
        <CommandPalette />
        <ObjectContextMenu />
        <ConnectionComposer />
        <EngineTerminal />
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: '#2A2A2E',
              border: '1px solid rgba(244, 243, 240, 0.12)',
              color: '#F4F3F0',
              fontFamily: 'var(--font-metadata, "Courier Prime", monospace)',
              fontSize: '13px',
            },
          }}
        />
      </CommonPlaceProviders>
    </div>
  );
}
