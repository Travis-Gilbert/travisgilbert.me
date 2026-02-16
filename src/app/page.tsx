import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from '@phosphor-icons/react/dist/ssr';
import { getCollection } from '@/lib/content';

export const metadata: Metadata = {
  title: 'Travis Gilbert | Investigations, Projects, and Field Notes',
  description:
    'A creative workbench exploring how design decisions shape human outcomes. Research, field notes, and projects on infrastructure, policy, and the built environment.',
};
import type { Investigation, FieldNote, Project } from '@/lib/content';
import DateStamp from '@/components/DateStamp';
import TagList from '@/components/TagList';
import RoughBox from '@/components/rough/RoughBox';
import RoughLine from '@/components/rough/RoughLine';
import RoughCallout from '@/components/rough/RoughCallout';
import RoughPivotCallout from '@/components/rough/RoughPivotCallout';
import ScrollReveal from '@/components/ScrollReveal';
import CyclingTagline from '@/components/CyclingTagline';

export default function HomePage() {
  const investigations = getCollection<Investigation>('investigations')
    .filter((i) => !i.data.draft)
    .sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());

  const fieldNotes = getCollection<FieldNote>('field-notes')
    .filter((n) => !n.data.draft)
    .sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf())
    .slice(0, 4);

  const projects = getCollection<Project>('projects')
    .filter((p) => !p.data.draft && p.data.featured)
    .sort((a, b) => a.data.order - b.data.order)
    .slice(0, 3);

  const featured = investigations[0];

  // Callout texts: prefer the `callouts` array, fall back to single `callout`
  const featuredCallouts: string[] = featured
    ? featured.data.callouts ?? (featured.data.callout ? [featured.data.callout] : [])
    : [];

  // Content counts for hero counters
  const totalInvestigations = investigations.length;
  const totalFieldNotes = getCollection<FieldNote>('field-notes').filter((n) => !n.data.draft).length;
  const totalProjects = getCollection<Project>('projects').filter((p) => !p.data.draft).length;

  return (
    <div>
      {/* ═══════════════════════════════════════════════
          Hero: Compact name + cycling tagline
          ~15% viewport height, content starts immediately below
          ═══════════════════════════════════════════════ */}
      <section className="pt-8 md:pt-12 pb-2 md:pb-4 border-b border-border-light">
        <ScrollReveal>
          {/* Row 1: Name (left) + Content counters (right) */}
          <div className="flex items-baseline justify-between">
            <h1
              className="text-[2rem] sm:text-[2.5rem] md:text-[2.75rem] m-0"
              style={{ fontFamily: 'var(--font-name)', fontWeight: 400, lineHeight: 1.0 }}
            >
              Travis Gilbert
            </h1>

            <div className="hidden md:flex items-baseline gap-6">
              <div className="flex flex-col items-center">
                <span className="font-title text-lg font-semibold text-ink">{totalInvestigations}</span>
                <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-ink-light">On</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="font-title text-lg font-semibold text-ink">{totalProjects}</span>
                <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-ink-light">Projects</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="font-title text-lg font-semibold text-ink">{totalFieldNotes}</span>
                <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-ink-light">Notes</span>
              </div>
            </div>
          </div>

          {/* Row 2: Cycling tagline */}
          <div className="mt-1">
            <CyclingTagline />
          </div>
        </ScrollReveal>
      </section>

      {/* ═══════════════════════════════════════════════
          Featured Investigation: Primary visual anchor
          Wider card, generous margins, pivoted callouts
          ═══════════════════════════════════════════════ */}
      {featured && (
        <section className="py-6 md:py-12">
          <ScrollReveal>
            <div className="lg:-mx-4 xl:-mx-8 relative">
              <RoughBox
                padding={0}
                hover
                tint="terracotta"
                elevated
              >
                <div className="group">
                  {Boolean(featured.data.youtubeId) && (
                    <div className="w-full h-40 sm:h-48 md:h-72 overflow-hidden">
                      <img
                        src={`https://img.youtube.com/vi/${featured.data.youtubeId}/maxresdefault.jpg`}
                        alt={`Thumbnail for ${featured.data.title}`}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    </div>
                  )}
                  <div className="p-6 md:p-8 relative">
                    <div className="mb-3">
                      <span className="font-mono text-[9.5px] uppercase tracking-[0.08em] text-paper bg-terracotta px-2 py-0.5 rounded-sm font-bold">
                        Work in Progress
                      </span>
                    </div>
                    <DateStamp date={featured.data.date} />
                    <h2 className="font-title text-2xl md:text-3xl font-bold mt-2 mb-3 group-hover:text-terracotta transition-colors">
                      <Link
                        href={`/investigations/${featured.slug}`}
                        className="no-underline text-ink hover:text-ink after:absolute after:inset-0 after:z-0"
                      >
                        {featured.data.title}
                      </Link>
                    </h2>
                    <p className="text-ink-secondary text-base md:text-lg mb-4 max-w-prose leading-relaxed">
                      {featured.data.summary}
                    </p>
                    <div className="relative z-10">
                      <TagList tags={featured.data.tags} tint="terracotta" />
                    </div>
                  </div>

                  {/* Pivoted leader-line callouts: exactly 2 for featured,
                      staggered on opposite sides for visual balance */}
                  {featuredCallouts[0] && (
                    <RoughPivotCallout
                      side="right"
                      tint="terracotta"
                      offsetY={20}
                      totalLength={196}
                      seed={42}
                      pivotDown
                    >
                      {featuredCallouts[0]}
                    </RoughPivotCallout>
                  )}
                  {featuredCallouts[1] && (
                    <RoughPivotCallout
                      side="left"
                      tint="terracotta"
                      offsetY={100}
                      totalLength={170}
                      seed={88}
                      pivotDown
                    >
                      {featuredCallouts[1]}
                    </RoughPivotCallout>
                  )}
                </div>
              </RoughBox>
            </div>
          </ScrollReveal>
        </section>
      )}

      {/* ═══════════════════════════════════════════════
          On ...: Investigations (skip featured)
          ═══════════════════════════════════════════════ */}
      {investigations.length > 1 && (
        <section className="py-6">
          <RoughLine label="On ..." labelColor="var(--color-terracotta)" />

          <div className="space-y-5">
            {investigations.slice(1).map((investigation) => {
              const hasThumbnail = Boolean(investigation.data.youtubeId);
              const thumbnailUrl = hasThumbnail
                ? `https://img.youtube.com/vi/${investigation.data.youtubeId}/maxresdefault.jpg`
                : '';

              return (
                <ScrollReveal key={investigation.slug}>
                  <RoughBox
                    padding={0}
                    hover
                    tint="terracotta"
                  >
                    <div className="group">
                      {hasThumbnail && (
                        <div className="w-full h-36 sm:h-48 md:h-64 overflow-hidden">
                          <img
                            src={thumbnailUrl}
                            alt={`Thumbnail for ${investigation.data.title}`}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        </div>
                      )}
                      <div className="p-5 md:p-6 relative">
                        <DateStamp date={investigation.data.date} />
                        <h2 className="font-title text-xl md:text-2xl font-bold mt-2 mb-2 group-hover:text-terracotta transition-colors">
                          <Link
                            href={`/investigations/${investigation.slug}`}
                            className="no-underline text-ink hover:text-ink after:absolute after:inset-0 after:z-0"
                          >
                            {investigation.data.title}
                          </Link>
                        </h2>
                        <p className="text-ink-secondary mb-3 max-w-prose">
                          {investigation.data.summary}
                        </p>
                        <div className="relative z-10">
                          <TagList tags={investigation.data.tags} tint="terracotta" />
                        </div>
                        {investigation.data.callout && (
                          <RoughCallout side="right" tint="terracotta" offsetY={8} seed={42}>
                            {investigation.data.callout}
                          </RoughCallout>
                        )}
                      </div>
                    </div>
                  </RoughBox>
                </ScrollReveal>
              );
            })}
          </div>

          <p className="mt-4 text-right">
            <Link
              href="/investigations"
              className="inline-flex items-center gap-1 font-mono text-sm text-terracotta hover:text-terracotta-hover no-underline"
            >
              All entries <ArrowRight size={14} weight="bold" />
            </Link>
          </p>
        </section>
      )}

      {/* ═══════════════════════════════════════════════
          Projects: Grid with scroll-reveal stagger
          (moved UP from below Field Notes)
          ═══════════════════════════════════════════════ */}
      {projects.length > 0 && (
        <section className="py-6">
          <RoughLine label="Projects" labelColor="var(--color-gold)" />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {projects.map((project, i) => (
              <ScrollReveal key={project.slug} delay={i * 80}>
                <RoughBox padding={20} hover tint="gold">
                  <div className="flex flex-col gap-2">
                    <div>
                      <h3 className="text-lg font-title font-bold m-0">{project.data.title}</h3>
                      <p className="text-sm text-ink-secondary m-0 font-mono">
                        {project.data.role} &middot; {project.data.year}
                      </p>
                    </div>
                    <p className="text-sm text-ink-secondary m-0">{project.data.description}</p>
                    {project.data.urls.length > 0 && (
                      <div className="flex flex-wrap gap-3 mt-1">
                        {project.data.urls.map((link) => (
                          <a
                            key={link.url}
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 font-mono text-xs text-terracotta hover:text-terracotta-hover no-underline"
                          >
                            {link.label}
                          </a>
                        ))}
                      </div>
                    )}
                    <div className="pt-1">
                      <TagList tags={project.data.tags} tint="gold" />
                    </div>
                  </div>
                </RoughBox>
              </ScrollReveal>
            ))}
          </div>

          <p className="mt-4 text-right">
            <Link
              href="/projects"
              className="inline-flex items-center gap-1 font-mono text-sm text-gold hover:text-gold/80 no-underline"
            >
              All projects <ArrowRight size={14} weight="bold" />
            </Link>
          </p>
        </section>
      )}

      {/* ═══════════════════════════════════════════════
          Field Notes: Asymmetric grid
          (moved DOWN from above Projects)
          ═══════════════════════════════════════════════ */}
      {fieldNotes.length > 0 && (
        <section className="py-6">
          <RoughLine label="Field Notes" labelColor="var(--color-teal)" />

          <div className="grid grid-cols-1 md:grid-cols-[3fr_2fr] gap-5 items-start">
            {fieldNotes.map((note, i) => (
              <ScrollReveal
                key={note.slug}
                delay={i * 100}
                className={i === 1 ? 'md:mt-10' : ''}
              >
                <RoughBox padding={20} hover tint="teal">
                  <Link
                    href={`/field-notes/${note.slug}`}
                    className="block no-underline text-ink hover:text-ink group"
                  >
                    <DateStamp date={note.data.date} />
                    <h3 className="text-lg font-title font-bold mt-2 mb-1 group-hover:text-teal transition-colors">
                      {note.data.title}
                    </h3>
                    {note.data.excerpt && (
                      <p className={`text-sm text-ink-secondary m-0 ${i === 0 ? 'line-clamp-3' : 'line-clamp-2'}`}>
                        {note.data.excerpt}
                      </p>
                    )}
                  </Link>
                  {note.data.tags.length > 0 && (
                    <div className="pt-3 relative z-10">
                      <TagList tags={note.data.tags} tint="teal" />
                    </div>
                  )}
                  {note.data.callout && (
                    <RoughCallout
                      side={i % 2 === 0 ? 'left' : 'right'}
                      tint="teal"
                      offsetY={12}
                      seed={100 + i}
                    >
                      {note.data.callout}
                    </RoughCallout>
                  )}
                </RoughBox>
              </ScrollReveal>
            ))}
          </div>

          <p className="mt-4 text-right">
            <Link
              href="/field-notes"
              className="inline-flex items-center gap-1 font-mono text-sm text-teal hover:text-teal/80 no-underline"
            >
              All field notes <ArrowRight size={14} weight="bold" />
            </Link>
          </p>
        </section>
      )}
    </div>
  );
}
