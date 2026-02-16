import type { Metadata } from 'next';
import { Briefcase } from '@phosphor-icons/react/dist/ssr';
import { getCollection } from '@/lib/content';
import type { Project } from '@/lib/content';
import ProjectTimeline from '@/components/ProjectTimeline';
import SectionLabel from '@/components/SectionLabel';

export const metadata: Metadata = {
  title: 'Projects',
  description:
    'Professional work: compliance tools, housing development, community organizing, and more.',
};

export default function ProjectsPage() {
  const projects = getCollection<Project>('projects')
    .filter((p) => !p.data.draft)
    .sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());

  return (
    <>
      <section className="py-8">
        <SectionLabel color="gold">Project Archive</SectionLabel>
        <h1 className="font-title text-3xl md:text-4xl font-bold mb-2 flex items-center gap-3">
          <Briefcase size={32} className="text-gold" />
          Projects
        </h1>
        <p className="text-ink-secondary mb-8">
          Professional work and community projects.
        </p>
      </section>

      <ProjectTimeline
        projects={projects.map((p) => ({
          title: p.data.title,
          role: p.data.role,
          description: p.data.description,
          year: p.data.year,
          date: p.data.date,
          urls: p.data.urls,
          tags: p.data.tags,
        }))}
      />
    </>
  );
}
