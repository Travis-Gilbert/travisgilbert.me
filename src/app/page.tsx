import Link from 'next/link';
import { MagnifyingGlass, ArrowRight, BookOpen } from '@phosphor-icons/react/dist/ssr';
import { getCollection } from '@/lib/content';
import type { Investigation, FieldNote, Project, ShelfEntry } from '@/lib/content';
import SectionLabel from '@/components/SectionLabel';
import DateStamp from '@/components/DateStamp';
import TagList from '@/components/TagList';
import MarginNote from '@/components/MarginNote';
import RoughBox from '@/components/rough/RoughBox';
import RoughLine from '@/components/rough/RoughLine';
import RoughUnderline from '@/components/rough/RoughUnderline';
import RoughCallout from '@/components/rough/RoughCallout';
import ScrollReveal from '@/components/ScrollReveal';

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

  const shelfItems = getCollection<ShelfEntry>('shelf')
    .sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf())
    .slice(0, 2);

  const featured = investigations[0];

  // Content counts for margin annotation
  const totalInvestigations = investigations.length;
  const totalFieldNotes = getCollection<FieldNote>('field-notes').filter((n) => !n.data.draft).length;
  const totalProjects = getCollection<Project>('projects').filter((p) => !p.data.draft).length;

  return (
    <div>
      {/* ═══════════════════════════════════════════════
          Hero — "Case File: Open"
          ═══════════════════════════════════════════════ */}
      <section className="py-8 md:py-12">
        <ScrollReveal>
          <RoughBox padding={24} tint="neutral" grid elevated>
            <div className="relative">
              <SectionLabel color="terracotta">Case File — Open</SectionLabel>

              <h1
                className="text-4xl md:text-5xl mb-3 mt-2"
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

              <p className="text-ink-secondary text-lg md:text-xl max-w-2xl leading-relaxed mb-6">
                Investigating how design decisions shape human outcomes.
              </p>

              {/* Featured investigation — nested card */}
              {featured && (
                <Link
                  href={`/investigations/${featured.slug}`}
                  className="block no-underline text-ink hover:text-ink group"
                >
                  <RoughBox padding={16} tint="terracotta" grid={false} elevated={false} hover>
                    <div className="flex items-start gap-3">
                      <MagnifyingGlass
                        size={18}
                        weight="bold"
                        className="text-terracotta mt-0.5 flex-shrink-0"
                      />
                      <div>
                        <span className="block font-mono text-[10px] uppercase tracking-[0.1em] text-terracotta mb-1">
                          Current Inquiry
                        </span>
                        <span className="block font-title text-base font-bold group-hover:text-terracotta transition-colors">
                          {featured.data.title}
                        </span>
                        <span className="block text-sm text-ink-secondary mt-1">
                          {featured.data.summary}
                        </span>
                      </div>
                    </div>
                  </RoughBox>
                </Link>
              )}

              {/* Content counts — workbench inventory */}
              <div className="mt-4 text-right">
                <MarginNote>
                  {totalInvestigations} investigation{totalInvestigations !== 1 ? 's' : ''} · {totalFieldNotes} field note{totalFieldNotes !== 1 ? 's' : ''} · {totalProjects} project{totalProjects !== 1 ? 's' : ''}
                </MarginNote>
              </div>
            </div>
          </RoughBox>
        </ScrollReveal>
      </section>

      {/* ═══════════════════════════════════════════════
          Investigations — "Pinned to the wall"
          ═══════════════════════════════════════════════ */}
      {investigations.length > 0 && (
        <section className="py-6">
          <RoughLine label="Investigation File" labelColor="var(--color-terracotta)" />

          <ScrollReveal>
            <div className="md:rotate-[-0.3deg]">
              {investigations.slice(0, 1).map((investigation) => {
                const hasThumbnail = Boolean(investigation.data.youtubeId);
                const thumbnailUrl = hasThumbnail
                  ? `https://img.youtube.com/vi/${investigation.data.youtubeId}/maxresdefault.jpg`
                  : '';

                return (
                  <RoughBox
                    key={investigation.slug}
                    padding={0}
                    hover
                    tint="terracotta"
                  >
                    <div className="group">
                      {hasThumbnail && (
                        <div className="w-full h-48 md:h-64 overflow-hidden">
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
                );
              })}
            </div>
          </ScrollReveal>

          {investigations.length > 1 && (
            <p className="mt-4 text-right">
              <Link
                href="/investigations"
                className="inline-flex items-center gap-1 font-mono text-sm text-terracotta hover:text-terracotta-hover no-underline"
              >
                All investigations <ArrowRight size={14} weight="bold" />
              </Link>
            </p>
          )}
        </section>
      )}

      {/* ═══════════════════════════════════════════════
          Field Notes — "Scattered notes" (asymmetric grid)
          ═══════════════════════════════════════════════ */}
      {fieldNotes.length > 0 && (
        <section className="py-6">
          <RoughLine label="Field Observations" labelColor="var(--color-teal)" />

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

      {/* ═══════════════════════════════════════════════
          Projects — Grid with scroll-reveal stagger
          ═══════════════════════════════════════════════ */}
      {projects.length > 0 && (
        <section className="py-6">
          <RoughLine label="Project Archive" labelColor="var(--color-gold)" />

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
          Shelf Teaser — "Sticky note" aside
          ═══════════════════════════════════════════════ */}
      {shelfItems.length > 0 && (
        <section className="py-6">
          <ScrollReveal direction="right">
            <div className="md:max-w-sm md:ml-auto">
              <RoughBox padding={16} tint="gold" grid={false} elevated>
                <SectionLabel color="gold">Recently Shelved</SectionLabel>
                <div className="space-y-3 mt-2">
                  {shelfItems.map((item) => (
                    <div key={item.slug}>
                      <Link
                        href="/shelf"
                        className="block no-underline text-ink hover:text-gold transition-colors"
                      >
                        <span className="block font-title font-bold text-sm">
                          {item.data.title}
                        </span>
                        <span className="block font-mono text-[10px] uppercase tracking-widest text-ink-light">
                          {item.data.creator}
                        </span>
                      </Link>
                      <p className="text-xs text-ink-secondary mt-1 line-clamp-2 italic m-0">
                        &ldquo;{item.data.annotation.slice(0, 120)}
                        {item.data.annotation.length > 120 ? '...' : ''}&rdquo;
                      </p>
                    </div>
                  ))}
                </div>
                <p className="mt-3 mb-0">
                  <Link
                    href="/shelf"
                    className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest text-gold hover:text-gold/80 no-underline"
                  >
                    <BookOpen size={12} weight="bold" />
                    Full shelf <ArrowRight size={10} weight="bold" />
                  </Link>
                </p>
              </RoughBox>
            </div>
          </ScrollReveal>
        </section>
      )}
    </div>
  );
}
