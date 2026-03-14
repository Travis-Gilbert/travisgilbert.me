import type { Metadata } from 'next';
import { getCollection } from '@/lib/content';
import type { FieldNote } from '@/lib/content';
import FieldNoteEntry from '@/components/FieldNoteEntry';
import FeaturedFieldNote from '@/components/FeaturedFieldNote';
import SectionLabel from '@/components/SectionLabel';
import DrawOnIcon from '@/components/rough/DrawOnIcon';

export const metadata: Metadata = {
  title: 'Field Notes',
  description:
    'Observations, essays, and running notes on design, infrastructure, and the built environment.',
};

export default function FieldNotesPage() {
  const allNotes = getCollection<FieldNote>('field-notes')
    .filter((n) => !n.data.draft)
    .sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());

  const featuredNote = allNotes.find((n) => n.data.featured);
  const remainingNotes = allNotes.filter((n) => n !== featuredNote);

  return (
    <>
      <section className="py-4 sm:py-8">
        <SectionLabel color="teal">Field Observation</SectionLabel>
        <h1 className="font-title text-3xl md:text-4xl font-bold mb-2 flex items-center gap-3">
          <DrawOnIcon name="note-pencil" size={32} color="var(--color-teal)" />
          Field Notes
        </h1>
        <p className="text-ink-secondary mb-8">
          Observations, essays, and running notes.
        </p>
      </section>

      {featuredNote && (
        <div className="mb-4 sm:mb-6">
          <FeaturedFieldNote
            title={featuredNote.data.title}
            date={featuredNote.data.date}
            excerpt={featuredNote.data.excerpt}
            tags={featuredNote.data.tags}
            href={`/field-notes/${featuredNote.slug}`}
            status={featuredNote.data.status}
            callout={featuredNote.data.callouts?.[0] ?? featuredNote.data.callout}
          />
        </div>
      )}

      <div className="space-y-3 sm:space-y-6">
        {remainingNotes.map((note) => (
          <FieldNoteEntry
            key={note.slug}
            title={note.data.title}
            date={note.data.date}
            excerpt={note.data.excerpt}
            tags={note.data.tags}
            href={`/field-notes/${note.slug}`}
            status={note.data.status}
          />
        ))}
      </div>

      {allNotes.length === 0 && (
        <p className="text-ink-secondary py-12 text-center">
          No field notes yet. Check back soon.
        </p>
      )}
    </>
  );
}
