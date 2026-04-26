import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Spacetime',
  description:
    'A spatiotemporal research atlas: topics across time and space on a sketched rotating globe, powered by the Spacetime DyGFormer GNN.',
};

/**
 * Spacetime route group: full-bleed, no global chrome.
 *
 * Does NOT render html/body (root layout handles that). The page itself
 * fills the viewport with a fixed-position parchment surface and renders
 * over the root background. No TopNav, no Footer, no DotGrid: by design.
 */
export default function SpacetimeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
