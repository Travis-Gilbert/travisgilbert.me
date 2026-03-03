import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import DrawOnIcon from '@/components/rough/DrawOnIcon';
import { getCollection } from '@/lib/content';
import type {
  Essay,
  FieldNote,
  ShelfEntry,
  Project,
} from '@/lib/content';
import { slugifyTag } from '@/lib/slugify';
import EssayCard from '@/components/EssayCard';
import FieldNoteEntry from '@/components/FieldNoteEntry';
import ShelfItem from '@/components/ShelfItem';
import ProjectCard from '@/components/ProjectCard';

interface Props {
  params: Promise<{ tag: string }>;
}

function getAllTagData() {
  const essays = getCollection<Essay>('essays').filter(
    (i) => !i.data.draft
  );
  const fieldNotes = getCollection<FieldNote>('field-notes').filter(
    (n) => !n.data.draft
  );
  const shelfItems = getCollection<ShelfEntry>('shelf');
  const projectItems = getCollection<Project>('projects').filter(
    (p) => !p.data.draft
  );

  const tagMap = new Map<
    string,
    {
      displayName: string;
      essays: typeof essays;
      fieldNotes: typeof fieldNotes;
      shelfItems: typeof shelfItems;
      projects: typeof projectItems;
    }
  >();

  function ensureTag(tag: string) {
    const slug = slugifyTag(tag);
    if (!tagMap.has(slug)) {
      tagMap.set(slug, {
        displayName: tag,
        essays: [],
        fieldNotes: [],
        shelfItems: [],
        projects: [],
      });
    }
    return tagMap.get(slug)!;
  }

  for (const item of essays) {
    for (const tag of item.data.tags) {
      ensureTag(tag).essays.push(item);
    }
  }

  for (const item of fieldNotes) {
    for (const tag of item.data.tags) {
      ensureTag(tag).fieldNotes.push(item);
    }
  }

  for (const item of shelfItems) {
    for (const tag of item.data.tags) {
      ensureTag(tag).shelfItems.push(item);
    }
  }

  for (const item of projectItems) {
    for (const tag of item.data.tags) {
      ensureTag(tag).projects.push(item);
    }
  }

  return tagMap;
}

export function generateStaticParams() {
  const tagMap = getAllTagData();
  return Array.from(tagMap.keys()).map((tag) => ({ tag }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { tag } = await params;
  const tagMap = getAllTagData();
  const data = tagMap.get(tag);
  if (!data) return {};
  const total =
    data.essays.length +
    data.fieldNotes.length +
    data.shelfItems.length +
    data.projects.length;
  return {
    title: `Tagged "${data.displayName}"`,
    description: `${total} item${total !== 1 ? 's' : ''} tagged "${data.displayName}" across essays, field notes, projects, and the reference shelf.`,
  };
}

export default async function TagDetailPage({ params }: Props) {
  const { tag } = await params;
  const tagMap = getAllTagData();
  const data = tagMap.get(tag);
  if (!data) notFound();

  const { displayName, essays, fieldNotes, shelfItems, projects } =
    data;
  const totalCount =
    essays.length +
    fieldNotes.length +
    shelfItems.length +
    projects.length;

  return (
    <>
      <section className="py-8">
        <p className="font-mono text-xs uppercase tracking-widest text-terracotta mb-2">
          Tag
        </p>
        <h1 className="font-title text-3xl md:text-4xl font-bold mb-2 flex items-center gap-3">
          <DrawOnIcon name="tag" size={32} color="var(--color-terracotta)" />
          {displayName}
        </h1>
        <p className="text-ink-secondary">
          {totalCount} item{totalCount !== 1 ? 's' : ''}
        </p>
      </section>

      {essays.length > 0 && (
        <section className="py-6">
          <h2 className="font-title text-xl font-bold mb-4">Essays</h2>
          <div className="space-y-6">
            {essays
              .sort(
                (a, b) => b.data.date.valueOf() - a.data.date.valueOf()
              )
              .map((item) => (
                <EssayCard
                  key={item.slug}
                  title={item.data.title}
                  summary={item.data.summary}
                  date={item.data.date}
                  youtubeId={item.data.youtubeId}
                  tags={item.data.tags}
                  href={`/essays/${item.slug}`}
                  stage={item.data.stage}
                  slug={item.slug}
                />
              ))}
          </div>
        </section>
      )}

      {fieldNotes.length > 0 && (
        <section className="py-6">
          <h2 className="font-title text-xl font-bold mb-4">Field Notes</h2>
          <div className="space-y-4">
            {fieldNotes
              .sort(
                (a, b) => b.data.date.valueOf() - a.data.date.valueOf()
              )
              .map((note) => (
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
        </section>
      )}

      {shelfItems.length > 0 && (
        <section className="py-6">
          <h2 className="font-title text-xl font-bold mb-4">Shelf</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {shelfItems.map((item) => (
              <ShelfItem
                key={item.slug}
                title={item.data.title}
                creator={item.data.creator}
                type={item.data.type}
                annotation={item.data.annotation}
                url={item.data.url}
                tags={item.data.tags}
              />
            ))}
          </div>
        </section>
      )}

      {projects.length > 0 && (
        <section className="py-6">
          <h2 className="font-title text-xl font-bold mb-4">Projects</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {projects.map((project) => (
              <ProjectCard
                key={project.slug}
                title={project.data.title}
                role={project.data.role}
                description={project.data.description}
                year={project.data.year}
                urls={project.data.urls}
                tags={project.data.tags}
              />
            ))}
          </div>
        </section>
      )}

      <nav className="py-4 border-t border-border mt-6">
        <Link
          href="/tags"
          className="font-mono text-sm hover:text-terracotta-hover"
        >
          &larr; All tags
        </Link>
      </nav>
    </>
  );
}
