import type { Metadata } from 'next';
import { NotePencil } from '@phosphor-icons/react/dist/ssr';
import { getCollection } from '@/lib/content';
import type { FieldNote } from '@/lib/content';
import FieldNoteEntry from '@/components/FieldNoteEntry';
import SectionLabel from '@/components/SectionLabel';

export const metadata: Metadata = {
  title: 'Field Notes',
  description:
    'Observations, essays, and running notes on design, infrastructure, and the built environment.',
};

export default function FieldNotesPage() {
  const allNotes = getCollection<FieldNote>('field-notes')
    .filter((n) => !n.data.draft)
    .sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());

  return (
    <>
      <section className="py-8">
        <SectionLabel color="teal">Field Observation</SectionLabel>
        <h1 className="font-title text-3xl md:text-4xl font-bold mb-2 flex items-center gap-3">
          <NotePencil size={32} className="text-teal" />
          Field Notes
        </h1>
        <p className="text-ink-secondary mb-8">
          Observations, essays, and running notes.
        </p>
      </section>

      <div className="space-y-6">
        {allNotes.map((note) => (
          <FieldNoteEntry
            key={note.slug}
            title={note.data.title}
            date={note.data.date}
            excerpt={note.data.excerpt}
            tags={note.data.tags}
            href={`/field-notes/${note.slug}`}
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
