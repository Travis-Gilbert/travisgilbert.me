import type { Metadata } from 'next';
import StudioLayout from '@/components/studio/StudioLayout';
import DotGrid from '@/components/DotGrid';
import { Toaster } from 'sonner';
import '@/styles/studio.css';

export const metadata: Metadata = {
  title: {
    default: 'Studio',
    template: '%s | Studio',
  },
  description:
    'Publishing workbench. Write, manage, and track content through the creative pipeline.',
  manifest: '/studio/manifest',
  icons: {
    icon: [
      { url: '/studio/icon.svg', type: 'image/svg+xml' },
      { url: '/studio/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/studio/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
    ],
    apple: [
      { url: '/studio/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
};

/**
 * Studio route group layout: themed creative workbench.
 *
 * Does NOT render html/body (root layout handles that).
 * Applies `.studio-theme` to scope all `--studio-*` tokens.
 * Light mode via `.studio-theme-light` (additive override).
 *
 * Flash prevention: inline script reads localStorage before React hydrates
 * to apply the light theme class immediately (no dark flash on load).
 */
export default function StudioGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className="studio-theme studio-canvas"
      style={{
        display: 'flex',
        minHeight: '100vh',
        backgroundColor: 'var(--studio-bg)',
        color: 'var(--studio-text-1)',
        margin: 0,
        isolation: 'isolate',
      }}
    >
      {/* Theme flash prevention: light is default; only remove if localStorage says dark */}
      <script
        dangerouslySetInnerHTML={{
          __html: `(function(){try{var t=localStorage.getItem('studio-theme-v1');if(t!=='dark'){document.querySelector('.studio-theme').classList.add('studio-theme-light')}}catch(e){document.querySelector('.studio-theme').classList.add('studio-theme-light')}})()`,
        }}
      />

      {/* Main site dot grid (single color, no hero gradient) */}
      <DotGrid noGradient dotColor={[180, 90, 45]} dotOpacity={0.3} />

      {/* Terracotta upper-left corner glow */}
      <div className="studio-corner-glow" aria-hidden="true" />

      <StudioLayout>{children}</StudioLayout>

      {/* Sonner toast notifications: styled via studio.css */}
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: 'var(--studio-surface-raised, #201D1A)',
            color: 'var(--studio-text-1, #F0EAE0)',
            border: '1px solid var(--studio-border, rgba(237, 231, 220, 0.09))',
            fontFamily: 'var(--studio-font-body)',
            fontSize: '13px',
          },
        }}
      />
    </div>
  );
}
