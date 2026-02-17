import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCollection, getEntry, renderMarkdown, estimateReadingTime } from '@/lib/content';
import type { FieldNote, Essay } from '@/lib/content';
import DateStamp from '@/components/DateStamp';
import TagList from '@/components/TagList';
import RoughLine from '@/components/rough/RoughLine';
import { CompactTracker, NOTE_STAGES } from '@/components/ProgressTracker';

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

  return (
    <article className="py-8">
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
        {entry.data.connectedTo && (() => {
          const parentEssay = getEntry<Essay>('essays', entry.data.connectedTo);
          if (!parentEssay) return null;
          return (
            <div className="mb-2">
              <span
                className="font-mono"
                style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-teal)' }}
              >
                Connected to:{' '}
              </span>
              <Link
                href={`/essays/${parentEssay.slug}`}
                className="font-mono no-underline"
                style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-terracotta)' }}
              >
                {parentEssay.data.title}
              </Link>
            </div>
          );
        })()}
        <h1 className="font-title text-3xl md:text-4xl font-bold mt-4 mb-4">
          {entry.data.title}
        </h1>
        <TagList tags={entry.data.tags} />
      </header>

      <div
        className="prose"
        dangerouslySetInnerHTML={{ __html: html }}
      />

      <RoughLine />

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
  );
}
