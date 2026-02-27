import type { Metadata } from 'next';
import SectionLabel from '@/components/SectionLabel';
import DrawOnIcon from '@/components/rough/DrawOnIcon';
import VisualizationTabs from '@/components/research/VisualizationTabs';

export const metadata: Metadata = {
  title: 'Paper Trail',
  description:
    'An interactive graph of sources, essays, and field notes. See how research connects to writing.',
};

export default function ResearchPage() {
  return (
    <>
      <section className="py-8">
        <SectionLabel color="teal">Research Network</SectionLabel>
        <h1 className="font-title text-3xl md:text-4xl font-bold mb-2 flex items-center gap-3">
          <DrawOnIcon name="magnifying-glass" size={32} color="var(--color-teal)" />
          Paper Trail
        </h1>
        <p className="text-ink-secondary mb-6 max-w-prose">
          Five ways to explore how sources, essays, and field notes connect.
          Each visualization highlights a different dimension of the research.
        </p>
      </section>

      <VisualizationTabs />
    </>
  );
}
