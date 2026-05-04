import type { Metadata } from 'next';
import AntiConspiracyPage from '@/components/act/AntiConspiracyPage';

export const metadata: Metadata = {
  title: 'Anti-Conspiracy Theorem',
  description:
    'A working public lab for inspecting claims by evidence shape, source diversity, falsifiability, and rhetorical pressure. Drop a URL or document; the lab scores it and lays the reasoning bare.',
  openGraph: {
    title: 'Anti-Conspiracy Theorem · /javascript-pro',
    description:
      'Field lab for inspecting claims by evidence shape, source diversity, falsifiability, and rhetorical pressure.',
  },
};

/**
 * /javascript-pro mirror of /act. Same self-contained surface; lets
 * the page double as a reference under a separate URL without forking
 * the implementation.
 */
export default function JavascriptProPage() {
  return <AntiConspiracyPage />;
}
