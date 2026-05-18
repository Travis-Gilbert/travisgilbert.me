import type { Metadata } from 'next';
import AntiConspiracyPage from '@/components/act/AntiConspiracyPage';

export const metadata: Metadata = {
  title: 'Anti-Conspiracy Theorem | Travis Gilbert',
  description:
    'A working public lab for the Anti-Conspiracy Theorem browser extension and ACC claim scoring engine.',
  openGraph: {
    title: 'Anti-Conspiracy Theorem',
    description:
      'A working public lab for the Anti-Conspiracy Theorem browser extension and ACC claim scoring engine.',
  },
};

/**
 * /act surface.
 *
 * The `?bp=1` Blueprint flag has been retired. The Retro Lab port from
 * claude.ai/design is now the default page; the prior Blueprint
 * sibling component + every helper under `src/components/act/blueprint/`
 * was deleted in the same commit that introduced this page.
 *
 * Source of truth for the visual port:
 * `/tmp/retro-lab-extract/retro-lab-design-scheme/project/`.
 */
export default function ActPage() {
  return <AntiConspiracyPage />;
}
