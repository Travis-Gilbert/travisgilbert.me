import Link from 'next/link';
import { MagnifyingGlass, NotePencil, Briefcase } from '@phosphor-icons/react/dist/ssr';
import { getCollection } from '@/lib/content';
import type { Investigation, FieldNote, Project } from '@/lib/content';
import InvestigationCard from '@/components/InvestigationCard';
import FieldNoteEntry from '@/components/FieldNoteEntry';
import ProjectCard from '@/components/ProjectCard';
import SectionLabel from '@/components/SectionLabel';
import RoughLine from '@/components/rough/RoughLine';
import RoughUnderline from '@/components/rough/RoughUnderline';

export default function HomePage() {
  const investigations = getCollection<Investigation>('investigations')
    .filter((i) => !i.data.draft)
    .sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf())
    .slice(0, 3);

  const fieldNotes = getCollection<FieldNote>('field-notes')
    .filter((n) => !n.data.draft)
    .sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf())
    .slice(0, 5);

  const projects = getCollection<Project>('projects')
    .filter((p) => !p.data.draft && p.data.featured)
    .sort((a, b) => a.data.order - b.data.order)
    .slice(0, 3);

  return (
    <div>
      {/* Hero */}
      <section className="py-12 md:py-16">
        <h1
          className="text-4xl md:text-5xl mb-4"
          style={{ fontFamily: 'var(--font-name)', fontWeight: 400 }}
        >
          <RoughUnderline
            type="underline"
            color="var(--color-terracotta)"
            strokeWidth={2}
          >
            Travis Gilbert
          </RoughUnderline>
        </h1>
        <p className="text-ink-secondary text-lg md:text-xl max-w-2xl leading-relaxed">
          Investigating how design decisions shape human outcomes.
        </p>
      </section>

      {/* Latest Investigations */}
      {investigations.length > 0 && (
        <section className="py-8">
          <SectionLabel color="terracotta">Investigation File</SectionLabel>
          <h2 className="font-title text-2xl font-bold mb-6 flex items-center gap-2">
            <MagnifyingGlass size={24} className="text-terracotta" />
            Latest Investigations
          </h2>
          <div className="space-y-6">
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
          <p className="mt-6">
            <Link
              href="/investigations"
              className="font-mono text-sm hover:text-terracotta-hover"
            >
              All investigations &rarr;
            </Link>
          </p>
        </section>
      )}

      <RoughLine />

      {/* Recent Field Notes */}
      {fieldNotes.length > 0 && (
        <section className="py-8">
          <SectionLabel color="teal">Field Observation</SectionLabel>
          <h2 className="font-title text-2xl font-bold mb-6 flex items-center gap-2">
            <NotePencil size={24} className="text-teal" />
            Recent Field Notes
          </h2>
          <div className="space-y-4">
            {fieldNotes.map((note) => (
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
          <p className="mt-6">
            <Link
              href="/field-notes"
              className="font-mono text-sm text-teal hover:text-teal/80"
            >
              All field notes &rarr;
            </Link>
          </p>
        </section>
      )}

      {/* Projects */}
      {projects.length > 0 && (
        <>
          <RoughLine />
          <section className="py-8">
            <SectionLabel color="gold">Project Archive</SectionLabel>
            <h2 className="font-title text-2xl font-bold mb-6 flex items-center gap-2">
              <Briefcase size={24} className="text-gold" />
              Projects
            </h2>
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
            <p className="mt-6">
              <Link
                href="/projects"
                className="font-mono text-sm text-gold hover:text-gold/80"
              >
                All projects &rarr;
              </Link>
            </p>
          </section>
        </>
      )}
    </div>
  );
}
