import type { Metadata } from 'next';
import DrawOnIcon from '@/components/rough/DrawOnIcon';
import ProjectGrid from '@/components/projects/ProjectGrid';

export const metadata: Metadata = {
  title: 'Projects',
  description:
    'Software, housing, documentaries, festivals, ML pipelines. Things I have built, organized, and investigated.',
};

export default function ProjectsPage() {
  return (
    <>
      <section className="py-4 sm:py-8" data-pagefind-ignore>
        <span className="block font-mono text-sm font-bold uppercase tracking-[0.1em] mb-2 select-none text-gold">
          Projects
        </span>
        <h1 className="font-title text-3xl md:text-4xl font-bold mb-2 flex items-center gap-3">
          <DrawOnIcon name="briefcase" size={44} color="var(--color-gold)" />
          Things I've built, organized, and investigated.
        </h1>
        <p className="text-ink-secondary mb-8 max-w-xl font-light leading-relaxed">
          Software systems, housing developments, documentaries, community festivals, ML pipelines.
          Each one is a lens on how design decisions shape human outcomes.
        </p>
      </section>

      <ProjectGrid />

      {/* Closing connective thread */}
      <section className="mt-16 pt-8 border-t border-border-light text-center">
        <p className="font-title text-lg italic text-ink-secondary max-w-lg mx-auto mb-6 leading-relaxed">
          The medium changes. The question doesn&apos;t.
          <br />
          How do design decisions shape human outcomes?
        </p>
        <div className="flex justify-center gap-6">
          {[
            { label: 'Essays', href: '/essays' },
            { label: 'Field Notes', href: '/field-notes' },
            { label: 'YouTube', href: '/projects/youtube' },
            { label: 'Connect', href: '/connect' },
          ].map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-muted no-underline hover:text-terracotta transition-colors"
            >
              {link.label}
            </a>
          ))}
        </div>
      </section>
    </>
  );
}
