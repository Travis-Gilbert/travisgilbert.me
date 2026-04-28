import type { Metadata, Viewport } from 'next';
import '../../styles/theseus.css';
import '../../styles/assistant-ui-theme.css';
// Studio CSS needed for TiptapEditor (slash popup, contain blocks, prose, word count)
import '../../styles/studio.css';
import TheseusShell from '@/components/theseus/TheseusShell';
import TheseusSidebar from '@/components/theseus/TheseusSidebar';
import TheseusMobileNav from '@/components/theseus/TheseusMobileNav';
import TheseusServiceWorker from '@/components/theseus/TheseusServiceWorker';

export const metadata: Metadata = {
  title: 'Theseus',
  description: 'Visual Intelligence Engine',
  applicationName: 'Theseus',
  manifest: '/theseus/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Theseus',
  },
};

export const viewport: Viewport = {
  themeColor: '#0a2a20',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

/**
 * Theseus Atlas shell: sidebar (220px, numbered Places) + main surface.
 *
 * TheseusShell provides the Atlas filter context, the command palette,
 * the global drop-target, and the `atlas-main` wrapper that hosts the
 * active panel from PanelManager.
 */
export default function TheseusLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="theseus-root">
      <TheseusShell>
        <TheseusSidebar />
        <main className="atlas-main">{children}</main>
      </TheseusShell>
      <TheseusMobileNav />
      <TheseusServiceWorker />
    </div>
  );
}
