import type { Metadata } from 'next';
import NetworksShell from '@/components/networks/NetworksShell';
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
  return <NetworksShell>{children}</NetworksShell>;
}
