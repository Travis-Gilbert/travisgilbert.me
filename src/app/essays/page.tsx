import type { Metadata } from 'next';
import Link from 'next/link';
import { getCollection } from '@/lib/content';
import type { Essay } from '@/lib/content';
import EssayCard from '@/components/EssayCard';
import SectionLabel from '@/components/SectionLabel';
import DrawOnIcon from '@/components/rough/DrawOnIcon';
import ProgressTracker, { ESSAY_STAGES } from '@/components/ProgressTracker';
import PatternImage from '@/components/PatternImage';
import RoughBox from '@/components/rough/RoughBox';
import DateStamp from '@/components/DateStamp';
import TagList from '@/components/TagList';

export const metadata: Metadata = {
  title: 'Essays on ...',
  description:
    'Video essays exploring how design decisions shape human outcomes.',
};

export default function EssaysPage() {
  const essays = getCollection<Essay>('essays')
    .filter((i) => !i.data.draft)
    .sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());

  return (
    <>
      <section className="py-8">
        <SectionLabel color="terracotta">Essays</SectionLabel>
        <h1 className="font-title text-3xl md:text-4xl font-bold mb-2 flex items-center gap-3">
          <DrawOnIcon name="file-text" size={32} color="var(--color-terracotta)" />
          Essays on ...
        </h1>
        <p className="text-ink-secondary mb-8">
          Long form examinations of how design decisions reshape cities, systems, and daily life.
        </p>
      </section>

      {/* Featured essay: full width */}
      {essays[0] && (() => {
        const featured = essays[0];
        const hasThumbnail = Boolean(featured.data.youtubeId);
        return (
          <RoughBox padding={0} hover tint="terracotta" elevated>
            <div className="group">
              {hasThumbnail ? (
                <div className="w-full h-40 sm:h-48 md:h-64 overflow-hidden">
                  <img
                    src={`https://img.youtube.com/vi/${featured.data.youtubeId}/maxresdefault.jpg`}
                    alt={`Thumbnail for ${featured.data.title}`}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
              ) : (
                <PatternImage seed={featured.slug} height={160} color="var(--color-terracotta)" />
              )}
              <div className="p-6 md:p-8">
                <ProgressTracker
                  stages={ESSAY_STAGES}
                  currentStage={featured.data.stage || 'published'}
                  color="var(--color-terracotta)"
                  annotationCount={featured.data.annotations?.length}
                />
                <div className="mt-3">
                  <DateStamp date={featured.data.date} />
                </div>
                <h2 className="font-title text-2xl md:text-3xl font-bold mt-2 mb-3 group-hover:text-terracotta transition-colors">
                  <Link
                    href={`/essays/${featured.slug}`}
                    className="no-underline text-ink hover:text-ink after:absolute after:inset-0 after:z-0"
                  >
                    {featured.data.title}
                  </Link>
                </h2>
                <p className="text-ink-secondary text-base md:text-lg mb-4 max-w-prose leading-relaxed">
                  {featured.data.summary}
                </p>
                <div className="relative z-10">
                  <TagList tags={featured.data.tags} tint="terracotta" />
                </div>
              </div>
            </div>
          </RoughBox>
        );
      })()}

      {/* Remaining essays: 2-column grid */}
      {essays.length > 1 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
          {essays.slice(1).map((essay) => (
            <EssayCard
              key={essay.slug}
              title={essay.data.title}
              summary={essay.data.summary}
              date={essay.data.date}
              youtubeId={essay.data.youtubeId}
              tags={essay.data.tags}
              href={`/essays/${essay.slug}`}
              stage={essay.data.stage}
              slug={essay.slug}
            />
          ))}
        </div>
      )}

      {essays.length === 0 && (
        <p className="text-ink-secondary py-12 text-center">
          No essays yet. Check back soon.
        </p>
      )}
    </>
  );
}
