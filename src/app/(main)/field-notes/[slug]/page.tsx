import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCollection, getEntry, renderMarkdown, estimateReadingTime } from '@/lib/content';
import type { FieldNote, Essay, ShelfEntry } from '@/lib/content';
import { computeFieldNoteConnections, generateNavigationSuggestions } from '@/lib/connectionEngine';
import type { AllContent } from '@/lib/connectionEngine';
import WhereToNext from '@/components/WhereToNext';
import ArticleBody from '@/components/ArticleBody';
import DateStamp from '@/components/DateStamp';
import TagList from '@/components/TagList';
import RoughLine from '@/components/rough/RoughLine';
import { CompactTracker, NOTE_STAGES } from '@/components/ProgressTracker';
import { ArticleJsonLd } from '@/components/JsonLd';
import ReadingSurface from '@/components/ReadingSurface';

interface Props {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  const notes = getCollection<FieldNote>('field-notes');
  return notes.map((n) => ({ slug: n.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const entry = getEntry<FieldNote>('field-notes', slug);
  if (!entry) return {};
  return {
    title: `${entry.data.title} | Field Notes`,
    description: entry.data.excerpt,
  };
}

export default async function FieldNoteDetailPage({ params }: Props) {
  const { slug } = await params;
  const entry = getEntry<FieldNote>('field-notes', slug);
  if (!entry) notFound();

  const html = await renderMarkdown(entry.body);
  const readingTime = estimateReadingTime(entry.body);

  // Prev/next navigation
  const allNotes = getCollection<FieldNote>('field-notes')
    .filter((n) => !n.data.draft)
    .sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());

  const currentIndex = allNotes.findIndex((n) => n.slug === slug);
  const prevNote =
    currentIndex < allNotes.length - 1 ? allNotes[currentIndex + 1] : null;
  const nextNote = currentIndex > 0 ? allNotes[currentIndex - 1] : null;

  // Connection engine: suggest related content
  const allContent: AllContent = {
    essays: getCollection<Essay>('essays').filter((e) => !e.data.draft),
    fieldNotes: allNotes,
    shelf: getCollection<ShelfEntry>('shelf'),
  };
  const fieldNoteConnections = computeFieldNoteConnections(entry, allContent);
  const suggestions = generateNavigationSuggestions(fieldNoteConnections, entry.data.tags, 2);

  return (
    <>
    <ArticleJsonLd
      title={entry.data.title}
      description={entry.data.excerpt ?? entry.data.title}
      slug={slug}
      datePublished={entry.data.date}
      section="field-notes"
      tags={entry.data.tags}
    />
    <article className="py-8" data-pagefind-body data-pagefind-filter="type:field-note">
      <header className="mb-8">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <DateStamp date={entry.data.date} />
            {readingTime > 1 && (
              <span className="font-mono text-[11px] uppercase tracking-widest text-ink-faint select-none">
                · {readingTime} min read
              </span>
            )}
          </div>
          {entry.data.status && (
            <CompactTracker
              stages={NOTE_STAGES}
              currentStage={entry.data.status}
              color="var(--color-teal)"
            />
          )}
        </div>
        <h1 className="font-title text-3xl md:text-4xl font-bold mt-4 mb-4">
          {entry.data.title}
        </h1>
        <TagList tags={entry.data.tags} />
        <div className="mt-4 flex items-center gap-3">
          {entry.data.connectedTo && (() => {
            const parentEssay = getEntry<Essay>('essays', entry.data.connectedTo);
            if (!parentEssay) return null;
            return (
              <span
                className="font-mono shrink-0"
                style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-teal)' }}
              >
                Connected to:{' '}
                <Link
                  href={`/essays/${parentEssay.slug}`}
                  className="font-mono no-underline hover:opacity-80 transition-opacity"
                  style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-terracotta)' }}
                >
                  {parentEssay.data.title}
                </Link>
              </span>
            );
          })()}
          <RoughLine className="!my-0 w-24 sm:w-32 shrink-0" />
        </div>
      </header>

      <ReadingSurface>
        <ArticleBody
          html={html}
          className="prose"
          contentType="field-notes"
          articleSlug={slug}
        />
      </ReadingSurface>

      <RoughLine />

      <WhereToNext suggestions={suggestions} />

      <nav className="flex justify-between items-start gap-4 py-4">
        <div>
          {prevNote && (
            <Link
              href={`/field-notes/${prevNote.slug}`}
              className="font-mono text-sm hover:text-terracotta-hover"
            >
              &larr; {prevNote.data.title}
            </Link>
          )}
        </div>
        <div className="text-right">
          {nextNote && (
            <Link
              href={`/field-notes/${nextNote.slug}`}
              className="font-mono text-sm hover:text-terracotta-hover"
            >
              {nextNote.data.title} &rarr;
            </Link>
          )}
        </div>
      </nav>
    </article>
    </>
  );
}
