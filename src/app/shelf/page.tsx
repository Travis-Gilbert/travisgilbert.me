import type { Metadata } from 'next';
import { BookOpen } from '@phosphor-icons/react/dist/ssr';
import { getCollection } from '@/lib/content';
import type { ShelfEntry } from '@/lib/content';
import ShelfFilter from '@/components/ShelfFilter';
import SectionLabel from '@/components/SectionLabel';

export const metadata: Metadata = {
  title: 'Shelf',
  description:
    'Books, videos, tools, and other things worth recommending.',
};

export default function ShelfPage() {
  const shelfItems = getCollection<ShelfEntry>('shelf')
    .sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf())
    .map((item) => ({
      title: item.data.title,
      creator: item.data.creator,
      type: item.data.type,
      annotation: item.data.annotation,
      url: item.data.url,
      tags: item.data.tags,
    }));

  return (
    <>
      <section className="py-8">
        <SectionLabel color="gold">Reference Shelf</SectionLabel>
        <h1 className="font-title text-3xl md:text-4xl font-bold mb-2 flex items-center gap-3">
          <BookOpen size={32} className="text-gold" />
          Shelf
        </h1>
        <p className="text-ink-secondary mb-8">
          Things I&apos;ve read, watched, used, and recommend.
        </p>
      </section>

      <ShelfFilter items={shelfItems} />
    </>
  );
}
