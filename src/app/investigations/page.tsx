import type { Metadata } from 'next';
import { MagnifyingGlass } from '@phosphor-icons/react/dist/ssr';
import { getCollection } from '@/lib/content';
import type { Investigation } from '@/lib/content';
import InvestigationCard from '@/components/InvestigationCard';
import SectionLabel from '@/components/SectionLabel';

export const metadata: Metadata = {
  title: 'Investigations',
  description:
    'Video case files exploring how design decisions shape human outcomes.',
};

export default function InvestigationsPage() {
  const investigations = getCollection<Investigation>('investigations')
    .filter((i) => !i.data.draft)
    .sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());

  return (
    <>
      <section className="py-8">
        <SectionLabel color="terracotta">Investigation File</SectionLabel>
        <h1 className="font-title text-3xl md:text-4xl font-bold mb-2 flex items-center gap-3">
          <MagnifyingGlass size={32} className="text-terracotta" />
          Investigations
        </h1>
        <p className="text-ink-secondary mb-8">
          Video case files exploring design decisions and their consequences.
        </p>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {investigations.map((investigation) => (
          <InvestigationCard
            key={investigation.slug}
            title={investigation.data.title}
            summary={investigation.data.summary}
            date={investigation.data.date}
            youtubeId={investigation.data.youtubeId}
            tags={investigation.data.tags}
            href={`/investigations/${investigation.slug}`}
          />
        ))}
      </div>

      {investigations.length === 0 && (
        <p className="text-ink-secondary py-12 text-center">
          No investigations yet. Check back soon.
        </p>
      )}
    </>
  );
}
