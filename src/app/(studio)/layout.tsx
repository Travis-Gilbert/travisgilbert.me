import type { Metadata } from 'next';
import StudioLayout from '@/components/studio/StudioLayout';
import '@/styles/studio.css';

export const metadata: Metadata = {
  title: {
    default: 'Studio',
    template: '%s | Studio',
  },
  description:
    'Publishing workbench. Write, manage, and track content through the creative pipeline.',
};

/**
 * Studio route group layout: dark creative workbench.
 *
 * Does NOT render html/body (root layout handles that).
 * Applies `.studio-theme` to scope all `--studio-*` tokens.
 *
 * Three-column flex layout:
 *   Left:   232px sidebar (navigation, wordmark, quick capture)
 *   Center: fluid main area (dashboard, content lists, editor)
 *   Right:  300px collapsible workbench (pipeline stats, activity)
 *
 * Visual layers (back to front):
 *   1. Near-black background (#0F1012)
 *   2. Dot field (28px terracotta dots at 13%)
 *   3. Grid lines (40px terracotta at 2.5%)
 *   4. Upper-left corner glow (radial terracotta at 6%)
 *   5. Paper grain (SVG noise at 5.5%, overlay blend)
 *   6. Sidebar (#111210) with terracotta glow, grid lines, grain
 *   7. Workbench panel (#111210) with bottom-right glow, grid, grain
 *   8. Main content area with intelligence dashboard and glow cards
 */
export default function StudioGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className="studio-theme"
      style={{
        display: 'flex',
        minHeight: '100vh',
        backgroundColor: 'var(--studio-bg)',
        color: 'var(--studio-text-1)',
        margin: 0,
      }}
    >
      {/* Terracotta upper-left corner glow */}
      <div className="studio-corner-glow" aria-hidden="true" />

      <StudioLayout>{children}</StudioLayout>
    </div>
  );
}
