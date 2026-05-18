import type { Metadata } from 'next';
import TechnicalNotebook from '@/components/act/TechnicalNotebook';

export const metadata: Metadata = {
  title: 'Technical Notebook | Anti-Conspiracy Theorem',
  description:
    'Technical notebook for the Anti-Conspiracy Theorem evidence cockpit: Gemma 4 plus ACC v2 plus A2UI scene generation.',
  openGraph: {
    title: 'ACT Technical Notebook',
    description:
      'Technical notebook for the Anti-Conspiracy Theorem evidence cockpit: Gemma 4 plus ACC v2 plus A2UI scene generation.',
  },
};

/**
 * /act/notebook surface.
 *
 * Ports the Observable Notebook Kit draft delivered as
 * `act-technical-notebook (2).zip` into the Retro Lab visual register
 * used by /act. Content is a first-pass wiring; the user will swap it
 * out later via Claude Cowork. Page chrome (breadcrumb, title block,
 * hero, section frame, footer) is the stable surface.
 *
 * Source of truth for the visual port:
 * `src/components/act/AntiConspiracyPage.module.css` (token layer).
 * Notebook content lives entirely in
 * `src/components/act/TechnicalNotebook.tsx`.
 */
export default function ActNotebookPage() {
  return <TechnicalNotebook />;
}
