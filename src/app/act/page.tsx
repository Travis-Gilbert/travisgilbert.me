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
 * /act surface. Top-level route, no main-site chrome — the page paints
 * its own breadcrumb topbar, masthead, and colophon.
 */
export default function ActPage() {
  return <AntiConspiracyPage />;
}
