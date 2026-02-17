import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from '@phosphor-icons/react/dist/ssr';
import { getCollection } from '@/lib/content';
import type { Essay, FieldNote, Project } from '@/lib/content';
import DateStamp from '@/components/DateStamp';
import TagList from '@/components/TagList';
import RoughBox from '@/components/rough/RoughBox';
import RoughLine from '@/components/rough/RoughLine';
import RoughCallout from '@/components/rough/RoughCallout';
import RoughPivotCallout from '@/components/rough/RoughPivotCallout';
import ScrollReveal from '@/components/ScrollReveal';
import CyclingTagline from '@/components/CyclingTagline';
import ProgressTracker, { CompactTracker, ESSAY_STAGES, NOTE_STAGES } from '@/components/ProgressTracker';
import PatternImage from '@/components/PatternImage';
import NowPreview from '@/components/NowPreview';

export const metadata: Metadata = {
  title: 'Travis Gilbert | Essays, Projects, and Field Notes',
  description:
    'A creative workbench exploring how design decisions shape human outcomes. Essays, field notes, and projects on infrastructure, policy, and the built environment.',
};

export default function HomePage() {
  const essays = getCollection<Essay>('essays')
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

  const featured = essays[0];

  // Callout texts: prefer the `callouts` array, fall back to single `callout`
  const featuredCallouts: string[] = featured
    ? featured.data.callouts ?? (featured.data.callout ? [featured.data.callout] : [])
    : [];

  // Content counts for hero counters
  const totalEssays = essays.length;
  const totalFieldNotes = getCollection<FieldNote>('field-notes').filter((n) => !n.data.draft).length;
  const totalProjects = getCollection<Project>('projects').filter((p) => !p.data.draft).length;

  return (
    <div>
      {/* ═══════════════════════════════════════════════
          Hero: Compact name + cycling tagline + inline counters
          ═══════════════════════════════════════════════ */}
      <section className="pt-8 md:pt-12 pb-2 md:pb-4 border-b border-border-light">
        <ScrollReveal>
          <h1
            className="text-[2rem] sm:text-[2.5rem] md:text-[2.75rem] m-0"
            style={{ fontFamily: 'var(--font-name)', fontWeight: 400, lineHeight: 1.0 }}
          >
            Travis Gilbert
          </h1>

          <div className="mt-1">
            <CyclingTagline />
          </div>

          {/* Counters: subtle inline text below tagline */}
          <p
            className="font-mono text-ink-light mt-3"
            style={{
              fontSize: 11,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}
          >
            {totalEssays} essay{totalEssays !== 1 ? 's' : ''} &middot;{' '}
            {totalProjects} project{totalProjects !== 1 ? 's' : ''} &middot;{' '}
            {totalFieldNotes} field note{totalFieldNotes !== 1 ? 's' : ''}
          </p>
        </ScrollReveal>
      </section>

      {/* ═══════════════════════════════════════════════
          Featured Essay: Primary visual anchor
          PatternImage or YouTube thumbnail, ProgressTracker, pivoted callouts
          ═══════════════════════════════════════════════ */}
      {featured && (
        <section className="py-6 md:py-12">
          <ScrollReveal>
            <RoughLine label="Essays on ..." labelColor="var(--color-terracotta)" />

            <div className="lg:-mx-4 xl:-mx-8 relative">
              <RoughBox
                padding={0}
                hover
                tint="terracotta"
                elevated
              >
                <div className="group">
                  {/* Image: YouTube thumbnail > generative fallback */}
                  {featured.data.youtubeId ? (
                    <div className="w-full h-40 sm:h-48 md:h-72 overflow-hidden">
                      <img
                        src={`https://img.youtube.com/vi/${featured.data.youtubeId}/maxresdefault.jpg`}
                        alt={`Thumbnail for ${featured.data.title}`}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    </div>
                  ) : (
                    <PatternImage seed={featured.slug} height={180} color="var(--color-terracotta)" />
                  )}

                  <div className="p-6 md:p-8 relative">
                    {/* Progress tracker */}
                    <ProgressTracker
                      stages={ESSAY_STAGES}
                      currentStage={featured.data.stage || 'published'}
                      color="var(--color-terracotta)"
                    />

                    <div className="mt-4">
                      <DateStamp date={featured.data.date} />
                    </div>

                    <h2 className="font-title text-2xl md:text-3xl font-bold mt-2 mb-3 group-hover:text-terracotta transition-colors">
                      <Link
                        href={`/essays/${featured.slug}`}
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

                  {/* Pivoted leader-line callouts: exactly 2, staggered on opposite sides */}
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
          Secondary essays: compact tracker + PatternImage fallback
          ═══════════════════════════════════════════════ */}
      {essays.length > 1 && (
        <section className="py-6">
          <div className="space-y-5">
            {essays.slice(1).map((essay) => {
              const hasVideo = Boolean(essay.data.youtubeId);
              const thumbnailUrl = hasVideo
                ? `https://img.youtube.com/vi/${essay.data.youtubeId}/maxresdefault.jpg`
                : '';

              return (
                <ScrollReveal key={essay.slug}>
                  <RoughBox
                    padding={0}
                    hover
                    tint="terracotta"
                  >
                    <div className="group">
                      {/* Image: YouTube > PatternImage fallback */}
                      {hasVideo ? (
                        <div className="w-full h-36 sm:h-48 md:h-64 overflow-hidden">
                          <img
                            src={thumbnailUrl}
                            alt={`Thumbnail for ${essay.data.title}`}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        </div>
                      ) : (
                        <PatternImage
                          seed={essay.slug}
                          height={100}
                          color="var(--color-terracotta)"
                        />
                      )}

                      <div className="p-5 md:p-6 relative">
                        <div className="flex justify-between items-center">
                          <DateStamp date={essay.data.date} />
                          <CompactTracker
                            stages={ESSAY_STAGES}
                            currentStage={essay.data.stage || 'published'}
                            color="var(--color-terracotta)"
                          />
                        </div>

                        <h2 className="font-title text-xl md:text-2xl font-bold mt-2 mb-2 group-hover:text-terracotta transition-colors">
                          <Link
                            href={`/essays/${essay.slug}`}
                            className="no-underline text-ink hover:text-ink after:absolute after:inset-0 after:z-0"
                          >
                            {essay.data.title}
                          </Link>
                        </h2>
                        <p className="text-ink-secondary mb-3 max-w-prose">
                          {essay.data.summary}
                        </p>
                        <div className="relative z-10">
                          <TagList tags={essay.data.tags} tint="terracotta" />
                        </div>
                        {essay.data.callout && (
                          <RoughCallout side="right" tint="terracotta" offsetY={8} seed={42}>
                            {essay.data.callout}
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
              href="/essays"
              className="inline-flex items-center gap-1 font-mono text-sm text-terracotta hover:text-terracotta-hover no-underline"
            >
              All essays <ArrowRight size={14} weight="bold" />
            </Link>
          </p>
        </section>
      )}

      {/* ═══════════════════════════════════════════════
          /now preview: what Travis is currently focused on
          ═══════════════════════════════════════════════ */}
      <section className="py-2 md:py-6">
        <ScrollReveal>
          <NowPreview />
        </ScrollReveal>
      </section>

      {/* ═══════════════════════════════════════════════
          Projects: Grid with role icons and scroll-reveal stagger
          ═══════════════════════════════════════════════ */}
      {projects.length > 0 && (
        <section className="py-6">
          <RoughLine label="Projects" labelColor="var(--color-gold)" />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {projects.map((project, i) => (
              <ScrollReveal key={project.slug} delay={i * 80}>
                <RoughBox padding={20} hover tint="gold">
                  <div className="flex gap-3 items-start">
                    {/* Role icon container */}
                    <div
                      className="flex-shrink-0 flex items-center justify-center rounded-md"
                      style={{
                        width: 36,
                        height: 36,
                        background: 'rgba(196, 154, 74, 0.08)',
                      }}
                    >
                      <RoleIcon role={project.data.role} />
                    </div>
                    <div className="flex-1 flex flex-col gap-2">
                      <div>
                        <span
                          className="font-mono"
                          style={{
                            fontSize: 10,
                            textTransform: 'uppercase',
                            letterSpacing: '0.08em',
                            color: 'var(--color-gold)',
                          }}
                        >
                          {project.data.role}
                          {project.data.organization && (
                            <> &middot; {project.data.organization}</>
                          )}
                        </span>
                        <h3 className="text-lg font-title font-bold m-0">{project.data.title}</h3>
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
                              {link.label} &rarr;
                            </a>
                          ))}
                        </div>
                      )}
                      <div className="pt-1">
                        <TagList tags={project.data.tags} tint="gold" />
                      </div>
                      {project.data.callout && (
                        <div
                          className="mt-1"
                          style={{
                            fontFamily: 'var(--font-annotation)',
                            fontSize: 14,
                            color: 'var(--color-gold)',
                            opacity: 0.8,
                          }}
                        >
                          {project.data.callout}
                        </div>
                      )}
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
          Field Notes: Asymmetric grid with compact tracker + callouts
          ═══════════════════════════════════════════════ */}
      {fieldNotes.length > 0 && (
        <section className="py-6">
          <RoughLine label="Field Notes" labelColor="var(--color-teal)" />

          <div className="grid grid-cols-1 md:grid-cols-[3fr_2fr] gap-5 items-start">
            {fieldNotes.map((note, i) => (
              <ScrollReveal
                key={note.slug}
                delay={i * 100}
                className={i % 2 === 1 ? 'md:mt-10' : ''}
              >
                <RoughBox padding={20} hover tint="teal">
                  <div className="group">
                    <Link
                      href={`/field-notes/${note.slug}`}
                      className="block no-underline text-ink hover:text-ink"
                    >
                      <div className="flex justify-between items-center">
                        <DateStamp date={note.data.date} />
                        {note.data.status && (
                          <CompactTracker
                            stages={NOTE_STAGES}
                            currentStage={note.data.status}
                            color="var(--color-teal)"
                          />
                        )}
                      </div>
                      <h3 className="text-lg font-title font-bold mt-2 mb-1 group-hover:text-teal transition-colors">
                        {note.data.title}
                      </h3>
                      {note.data.excerpt && (
                        <p className={`text-sm text-ink-secondary m-0 ${i === 0 ? 'line-clamp-3' : 'line-clamp-2'}`}>
                          {note.data.excerpt}
                        </p>
                      )}
                    </Link>
                    {/* Handwritten callout */}
                    {note.data.callout && (
                      <div
                        className="mt-2.5"
                        style={{
                          fontFamily: 'var(--font-annotation)',
                          fontSize: 14,
                          color: 'var(--color-teal)',
                          opacity: 0.8,
                        }}
                      >
                        {note.data.callout}
                      </div>
                    )}
                    {note.data.tags.length > 0 && (
                      <div className="pt-3 relative z-10">
                        <TagList tags={note.data.tags} tint="teal" />
                      </div>
                    )}
                  </div>
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

// ─── Role Icon (SVG for project cards) ───────────────

const ROLE_ICON_PATHS: Record<string, string> = {
  'built-&-designed': 'M4 28V4h18v6h-2V6H6v20h10v2H4zm5-18h8m-8 4h5m5 2v12l4-3h6V16H14z',
  'project-managed': 'M4 6h24v20H4V6zm0 7h24M11 6v7m-3 4h2m2 0h2m4 0h2m2 0h2m-16 3h2m2 0h2',
  'organized': 'M16 4l12 7v13l-12 7L4 24V11l12-7zm0 0v14m0 0l10.4-6m-10.4 6L5.6 18',
  'created': 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zm0 4v8l4 4',
};

function slugifyRole(role: string): string {
  return role.toLowerCase().replace(/\s+/g, '-');
}

function RoleIcon({ role }: { role: string }) {
  const slug = slugifyRole(role);
  const d = ROLE_ICON_PATHS[slug] || ROLE_ICON_PATHS['built-&-designed'];

  return (
    <svg
      width={20}
      height={20}
      viewBox="0 0 32 32"
      fill="none"
      style={{ flexShrink: 0 }}
    >
      <path
        d={d}
        stroke="var(--color-gold)"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
