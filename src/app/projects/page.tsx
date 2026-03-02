import type { Metadata } from 'next';
import { getCollection } from '@/lib/content';
import type { Project } from '@/lib/content';
import ProjectColumns from '@/components/ProjectColumns';
import ParallaxStack from '@/components/ParallaxStack';
import SectionLabel from '@/components/SectionLabel';
import DrawOnIcon from '@/components/rough/DrawOnIcon';

export const metadata: Metadata = {
  title: 'Projects',
  description:
    'Professional work: compliance tools, housing development, community organizing, and more.',
};

export default function ProjectsPage() {
  const projects = getCollection<Project>('projects')
    .filter((p) => !p.data.draft);

  return (
    <>
      <section className="py-8">
        <SectionLabel color="gold">Project Archive</SectionLabel>
        <h1 className="font-title text-3xl md:text-4xl font-bold mb-2 flex items-center gap-3">
          <DrawOnIcon name="briefcase" size={32} color="var(--color-gold)" />
          Projects
        </h1>
        <p className="text-ink-secondary mb-5">
          Professional work and community projects.
        </p>
      </section>

      <ParallaxStack intensity={0.03}>
        {/* Layer 0: Blueprint grid background */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage:
              'linear-gradient(in srgb, var(--color-border) 1px, transparent 1px), linear-gradient(in srgb, 90deg, var(--color-border) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
            opacity: 0.06,
            pointerEvents: 'none',
          }}
        />

        {/* Layer 1: Project content */}
        <ProjectColumns
          projects={projects.map((p) => ({
            slug: p.slug,
            title: p.data.title,
            role: p.data.role,
            date: p.data.date.toISOString(),
            organization: p.data.organization,
            description: p.data.description,
            urls: p.data.urls,
            tags: p.data.tags,
          }))}
        />
      </ParallaxStack>
    </>
  );
}
