import type { Metadata } from 'next';
import { getCollection } from '@/lib/content';
import type { Essay, FieldNote, ShelfEntry } from '@/lib/content';
import { computeWritingStats } from '@/lib/analytics';
import SectionLabel from '@/components/SectionLabel';
import RoughLine from '@/components/rough/RoughLine';
import DrawOnIcon from '@/components/rough/DrawOnIcon';
import WordCountGauge from '@/components/analytics/WordCountGauge';
import WritingTimeline from '@/components/analytics/WritingTimeline';
import TopicDistribution from '@/components/analytics/TopicDistribution';

export const metadata: Metadata = {
  title: 'Writing Analytics | Travis Gilbert',
  description: 'The numbers behind the research and writing.',
};

export default function StatsPage() {
  const essays = getCollection<Essay>('essays').filter((e) => !e.data.draft);
  const fieldNotes = getCollection<FieldNote>('field-notes').filter((n) => !n.data.draft);
  const shelf = getCollection<ShelfEntry>('shelf');

  const stats = computeWritingStats(essays, fieldNotes, shelf);

  return (
    <>
      <header className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <DrawOnIcon name="gears" size={32} />
          <SectionLabel color="terracotta">WRITING ANALYTICS</SectionLabel>
        </div>
        <h1 className="font-title text-3xl mb-2">Writing Analytics</h1>
        <p className="text-sm text-ink-secondary">
          The numbers behind the research and writing.
        </p>
      </header>

      <section className="mb-8">
        <SectionLabel color="terracotta">OUTPUT</SectionLabel>
        <RoughLine className="my-3" />
        <WordCountGauge
          totalWords={stats.totalWords}
          averagePerEssay={stats.averageWordsPerEssay}
          totalEssays={stats.totalEssays}
          totalFieldNotes={stats.totalFieldNotes}
          totalShelfItems={stats.totalShelfItems}
        />

        <div className="mt-6">
          <h3 className="font-mono text-xs uppercase tracking-widest text-ink-light mb-3">
            Essays Over Time
          </h3>
          <WritingTimeline data={stats.essaysByMonth} />
        </div>

        <div className="mt-6">
          <h3 className="font-mono text-xs uppercase tracking-widest text-ink-light mb-3">
            Topic Distribution
          </h3>
          <TopicDistribution data={stats.topTags} />
        </div>
      </section>

      {stats.longestEssay && (
        <section className="mb-8">
          <SectionLabel color="teal">HIGHLIGHTS</SectionLabel>
          <RoughLine className="my-3" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-ink-light m-0">
                Longest Essay
              </p>
              <p className="font-title text-lg text-ink m-0 mt-1">
                {stats.longestEssay.title}
              </p>
              <p className="font-mono text-xs text-ink-light m-0">
                {stats.longestEssay.wordCount.toLocaleString()} words
              </p>
            </div>
            {stats.oldestEssay && (
              <div>
                <p className="font-mono text-[10px] uppercase tracking-widest text-ink-light m-0">
                  First Published
                </p>
                <p className="font-title text-lg text-ink m-0 mt-1">
                  {stats.oldestEssay.title}
                </p>
              </div>
            )}
          </div>
        </section>
      )}

      <footer className="mt-12 text-center">
        <p className="font-mono text-xs text-ink-light">
          Data computed from {stats.totalEssays} essays, {stats.totalFieldNotes} field notes,
          and {stats.totalShelfItems} shelf items.
        </p>
      </footer>
    </>
  );
}
