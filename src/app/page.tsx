import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from '@phosphor-icons/react/dist/ssr';
import { getCollection } from '@/lib/content';
import type { Essay, FieldNote, Project } from '@/lib/content';
import DateStamp from '@/components/DateStamp';
import TagList from '@/components/TagList';
import RoughBox from '@/components/rough/RoughBox';
import RoughLine from '@/components/rough/RoughLine';
import CodeComment from '@/components/CodeComment';
import ScrollReveal from '@/components/ScrollReveal';
import PipelineCounter from '@/components/PipelineCounter';
import { CompactTracker, NOTE_STAGES } from '@/components/ProgressTracker';
import NowPreviewCompact from '@/components/NowPreviewCompact';
import CollageHero from '@/components/CollageHero';
import HeroArtifact from '@/components/HeroArtifact';
import ActiveThreads from '@/components/research/ActiveThreads';

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

  // Hero data from the featured essay's frontmatter
  const heroImage = featured?.data.heroImage;
  const heroAlt = featured ? `Visual artifact for ${featured.data.title}` : 'Hero artifact';

  return (
    <div>
      {/* ═══════════════════════════════════════════════
          Hero: Unified dark-ground editorial spread.
          Identity (name, PipelineCounter), featured essay (title, summary,
          tags, progress), and composed visual artifact.
          CollageHero breaks out of max-w-4xl to span full viewport width.
          DotGrid renders cream dots in top viewport zone via inversion gradient.
          ═══════════════════════════════════════════════ */}
      <CollageHero
        name="Travis Gilbert"
        pipelineStatus={<PipelineCounter />}
        nowPreview={<NowPreviewCompact inverted />}
        artifact={
          <HeroArtifact
            imageSrc={heroImage}
            imageAlt={heroAlt}
            tags={featured?.data.tags}
            category={featured?.data.tags[0]}
          />
        }
        featured={featured ? {
          slug: featured.slug,
          title: featured.data.title,
          summary: featured.data.summary,
          date: featured.data.date.toISOString(),
          tags: featured.data.tags,
          stage: featured.data.stage,
          lastAdvanced: featured.data.lastAdvanced?.toISOString(),
          callouts: featured.data.callouts,
        } : null}
      />

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
                    {/* Code-style margin annotation (outside Link, inside RoughBox) */}
                    {(() => {
                      const callouts = note.data.callouts ?? (note.data.callout ? [note.data.callout] : []);
                      return callouts[0] ? (
                        <CodeComment
                          side={i % 2 === 0 ? 'left' : 'right'}
                          tint="teal"
                          offsetY={12}
                        >
                          {callouts[0]}
                        </CodeComment>
                      ) : null;
                    })()}
                    {note.data.tags.length > 0 && (
                      <div className="pt-3 relative z-10">
                        <TagList tags={note.data.tags} tint="teal" />
                      </div>
                    )}
                    {note.data.connectedTo && (() => {
                      const parentEssay = getCollection<Essay>('essays').find(
                        (e) => e.slug === note.data.connectedTo && !e.data.draft
                      );
                      if (!parentEssay) return null;
                      return (
                        <span
                          className="block mt-1 font-mono text-teal opacity-70"
                          style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em' }}
                        >
                          Connected to: {parentEssay.data.title}
                        </span>
                      );
                    })()}
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

      {/* ═══════════════════════════════════════════════
          Currently Researching: Active research threads from the API.
          Renders nothing if the research API is unreachable or has no
          active threads, so the homepage degrades gracefully.
          ═══════════════════════════════════════════════ */}
      <section className="py-6">
        <RoughLine label="Currently Researching" labelColor="var(--color-green)" />
        <ActiveThreads />
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
                <div data-cursor="crosshair">
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
                </div>
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
