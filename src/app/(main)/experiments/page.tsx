import type { Metadata } from 'next';
import Link from 'next/link';
import RoughBox from '@/components/rough/RoughBox';
import SectionLabel from '@/components/SectionLabel';
import DrawOnIcon from '@/components/rough/DrawOnIcon';
import { ArrowRight } from 'iconoir-react';

export const metadata: Metadata = {
  title: 'Experiments',
  description:
    'Working sketches and exploratory pieces: visualizations, prototypes, and ideas mid-thought.',
};

interface ExperimentEntry {
  slug: string;
  href: string;
  title: string;
  status: 'live' | 'wip' | 'archived';
  blurb: string;
  /** Stack / techniques tags — show as small monospace pills. */
  tags: string[];
  /** Calendar month + year, e.g. "Apr 2026". */
  date: string;
  tint: 'terracotta' | 'teal' | 'gold' | 'neutral';
}

/**
 * Experiments are not articles. They are working sketches: things I'm
 * building or exploring whose form is the writing. The list is curated
 * by hand; new experiments get pushed onto the top of the array.
 */
const EXPERIMENTS: ExperimentEntry[] = [
  {
    slug: 'spacetime',
    href: '/spacetime?mock=1',
    title: 'Spacetime Atlas',
    status: 'wip',
    blurb:
      'A spatiotemporal research atlas. Topics drift across a sketched rotating globe; clusters appear where the literature concentrates. Powered by a DyGFormer GNN learning how research moves through time and space.',
    tags: ['DyGFormer', 'd3-geo', 'rough.js', 'Next.js'],
    date: 'Apr 2026',
    tint: 'terracotta',
  },
];

const STATUS_COPY: Record<ExperimentEntry['status'], { label: string; color: string }> = {
  live: { label: 'Live', color: 'var(--color-success)' },
  wip: { label: 'WIP', color: 'var(--color-terracotta)' },
  archived: { label: 'Archived', color: 'var(--color-ink-light)' },
};

export default function ExperimentsPage() {
  return (
    <>
      <section className="py-4 sm:py-8" data-pagefind-ignore>
        <SectionLabel color="terracotta">Open Workbench</SectionLabel>
        <h1 className="font-title text-3xl md:text-4xl font-bold mb-2 flex items-center gap-3">
          <DrawOnIcon name="gears" size={32} color="var(--color-terracotta)" />
          Experiments
        </h1>
        <p className="text-ink-secondary mb-2 max-w-2xl">
          Working sketches and exploratory pieces. Some are real prototypes
          driving real backends; others are visual studies that may never
          ship. Either way, they are how I think.
        </p>
      </section>

      <div className="space-y-6">
        {EXPERIMENTS.map((exp) => {
          const status = STATUS_COPY[exp.status];
          return (
            <RoughBox key={exp.slug} tint={exp.tint} padding={24} hover>
              <Link
                href={exp.href}
                className="block group no-underline"
                aria-label={`${exp.title} (${status.label})`}
              >
                <div className="flex items-baseline justify-between gap-4 mb-2">
                  <div className="flex items-baseline gap-3 flex-wrap">
                    <span
                      className="font-mono text-[11px] uppercase tracking-widest"
                      style={{ color: status.color }}
                    >
                      ● {status.label}
                    </span>
                    <span className="font-mono text-[11px] uppercase tracking-widest text-ink-secondary">
                      {exp.date}
                    </span>
                  </div>
                  <span className="text-terracotta opacity-0 group-hover:opacity-100 transition-opacity">
                    <ArrowRight width={18} height={18} />
                  </span>
                </div>

                <h2 className="font-title text-2xl font-bold mb-2 leading-tight">
                  {exp.title}
                </h2>
                <p className="text-ink-secondary mb-4 leading-relaxed">
                  {exp.blurb}
                </p>

                <ul className="flex flex-wrap gap-2 list-none p-0 m-0">
                  {exp.tags.map((tag) => (
                    <li
                      key={tag}
                      className="font-mono text-[10px] uppercase tracking-wider px-2 py-1 rounded-sm"
                      style={{
                        background: 'var(--color-bg-alt)',
                        color: 'var(--color-ink-muted)',
                        border: '1px solid var(--color-border)',
                      }}
                    >
                      {tag}
                    </li>
                  ))}
                </ul>
              </Link>
            </RoughBox>
          );
        })}
      </div>
    </>
  );
}
