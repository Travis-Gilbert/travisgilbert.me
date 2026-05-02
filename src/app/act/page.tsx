import type { Metadata } from 'next';
import ActLab from './ActLab';

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

export default function ActPage() {
  return <ActLab />;
}
