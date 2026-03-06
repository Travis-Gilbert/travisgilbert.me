import type { Metadata } from 'next';
import TimelineModeTabs from '@/components/studio/TimelineModeTabs';
import TimelineView from '@/components/studio/TimelineView';
import type { TimelineItem } from '@/components/studio/TimelineView';
import { getCollection } from '@/lib/content';
import type { Essay, FieldNote, ShelfEntry } from '@/lib/content';
import { computeConnections, TYPE_COLOR } from '@/lib/connectionEngine';

export const metadata: Metadata = {
  title: 'Timeline',
};

export default function TimelinePage() {
  const essays = getCollection<Essay>('essays');
  const fieldNotes = getCollection<FieldNote>('field-notes');
  const shelf = getCollection<ShelfEntry>('shelf');
  const allContent = { essays, fieldNotes, shelf };

  /* slug-to-title index for resolving cross-references */
  const essayTitleBySlug = new Map(essays.map((e) => [e.slug, e.data.title]));

  const items: TimelineItem[] = [
    ...essays.map((essay) => ({
      id: `essay:${essay.slug}`,
      slug: essay.slug,
      title: essay.data.title,
      contentType: 'essay' as const,
      stage: essay.data.stage,
      date: essay.data.date.toISOString(),
      tags: essay.data.tags ?? [],
      summary: essay.data.summary,
      connections: computeConnections(essay, allContent),
    })),

    ...fieldNotes.map((note) => {
      const connectedSlug = note.data.connectedTo;
      return {
        id: `field-note:${note.slug}`,
        slug: note.slug,
        title: note.data.title,
        contentType: 'field-note' as const,
        stage: note.data.status,
        date: note.data.date.toISOString(),
        tags: note.data.tags ?? [],
        summary: note.data.excerpt,
        connections: connectedSlug
          ? [
              {
                id: `essay:${connectedSlug}`,
                type: 'essay' as const,
                slug: connectedSlug,
                title: essayTitleBySlug.get(connectedSlug) ?? connectedSlug,
                color: TYPE_COLOR.essay,
                weight: 'medium' as const,
                date: '',
              },
            ]
          : [],
      };
    }),

    ...shelf.map((entry) => {
      const connectedSlug = entry.data.connectedEssay;
      return {
        id: `shelf:${entry.slug}`,
        slug: entry.slug,
        title: entry.data.title,
        contentType: 'shelf' as const,
        stage: undefined,
        date: entry.data.date.toISOString(),
        tags: entry.data.tags ?? [],
        summary: entry.data.annotation,
        connections: connectedSlug
          ? [
              {
                id: `essay:${connectedSlug}`,
                type: 'essay' as const,
                slug: connectedSlug,
                title: essayTitleBySlug.get(connectedSlug) ?? connectedSlug,
                color: TYPE_COLOR.essay,
                weight: 'light' as const,
                date: '',
              },
            ]
          : [],
      };
    }),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <>
      <TimelineModeTabs mode="list" />
      <TimelineView items={items} />
    </>
  );
}
