import type { Metadata } from 'next';
import NetworksSidebar from '@/components/networks/NetworksSidebar';
import DotGrid from '@/components/DotGrid';
import '@/styles/networks.css';

export const metadata: Metadata = {
  title: {
    default: 'Networks',
    template: '%s | Networks',
  },
  description: 'Knowledge graph and research notebook.',
};

/**
 * Networks layout: dark theme shell with sidebar.
 *
 * Does NOT render html/body (the root layout handles that).
 * Applies the `networks-theme` class to a wrapper div that scopes
 * all dark theme CSS custom properties.
 *
 * DotGrid renders the same interactive binary scatter pattern from
 * the main site, but tuned for the dark ground: cream dots at 12%
 * opacity, no hero zone inversion gradient.
 */
export default function NetworksLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className="networks-theme"
      style={{
        display: 'flex',
        minHeight: '100vh',
        backgroundColor: 'var(--nw-bg)',
        color: 'var(--nw-text)',
        /* Override root body styles that don't apply here */
        margin: 0,
      }}
    >
      {/* Shared materiality: binary scatter dots on dark ground */}
      <DotGrid
        dotColor={[245, 240, 232]}
        dotOpacity={0.12}
        noGradient
      />
      <NetworksSidebar />
      <main
        style={{
          flex: 1,
          minWidth: 0,
          overflowY: 'auto',
        }}
      >
        {children}
      </main>
    </div>
  );
}
