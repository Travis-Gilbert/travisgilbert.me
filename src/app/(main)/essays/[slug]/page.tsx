import type { Metadata } from 'next';
import fs from 'node:fs';
import nodePath from 'node:path';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCollection, getEntry, renderMarkdown, injectAnnotations, injectConnectionCallouts, injectFootnoteMarkers, extractFootnoteSidenotes, estimateReadingTime } from '@/lib/content';
import type { Essay, FieldNote, ShelfEntry, ContentEntry } from '@/lib/content';
import AnnotatedArticle from '@/components/AnnotatedArticle';
import TagList from '@/components/TagList';
import YouTubeEmbed from '@/components/YouTubeEmbed';
import RoughLine from '@/components/rough/RoughLine';
import SourcesCollapsible from '@/components/SourcesCollapsible';
import type { ShelfAnnotation } from '@/components/SourcesCollapsible';
import ProgressTracker, { ESSAY_STAGES } from '@/components/ProgressTracker';
import ReadingProgress from '@/components/ReadingProgress';
import { ArticleJsonLd } from '@/components/JsonLd';
import EssayHero from '@/components/EssayHero';
import { computeConnections, positionConnections, generateNavigationSuggestions } from '@/lib/connectionEngine';
import type { AllContent } from '@/lib/connectionEngine';
import WhereToNext from '@/components/WhereToNext';
import ResearchTrail from '@/components/research/ResearchTrail';
import ReadingSurface from '@/components/ReadingSurface';
import ProcessNotes from '@/components/ProcessNotes';
import { fetchVideosForEssay, fetchVideoDetail } from '@/lib/videos';
import RoughBox from '@/components/rough/RoughBox';
import ConnectedReadingSidebar from '@/components/ConnectedReadingSidebar';

interface Props {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  const essays = getCollection<Essay>('essays');
  return essays.map((i) => ({ slug: i.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const entry = getEntry<Essay>('essays', slug);
  if (!entry) return {};
  return {
    title: `${entry.data.title} | Essays on ...`,
    description: entry.data.summary,
  };
}

export default async function EssayDetailPage({ params }: Props) {
  const { slug } = await params;
  const entry = getEntry<Essay>('essays', slug);
  if (!entry) notFound();

  const rawHtml = await renderMarkdown(entry.body);
  const { html: sidenotedHtml, sidenotes } = extractFootnoteSidenotes(rawHtml);
  const annotatedHtml = injectAnnotations(sidenotedHtml, entry.data.annotations ?? []);
  const readingTime = estimateReadingTime(entry.body);

  // Fetch linked video projects from Studio API (graceful: empty array on failure)
  const linkedVideos = await fetchVideosForEssay(slug);

  // Fetch detail for first linked video (for ProcessNotes metrics)
  const primaryVideoDetail = linkedVideos.length > 0
    ? await fetchVideoDetail(linkedVideos[0].slug)
    : null;

  // Prev/next navigation
  const allEssays = getCollection<Essay>('essays')
    .filter((e) => !e.data.draft)
    .sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());

  const currentIndex = allEssays.findIndex((e) => e.slug === slug);
  const prevEssay = currentIndex < allEssays.length - 1 ? allEssays[currentIndex + 1] : null;
  const nextEssay = currentIndex > 0 ? allEssays[currentIndex - 1] : null;

  // Resolve related field notes
  const allFieldNotes = getCollection<FieldNote>('field-notes')
    .filter((n) => !n.data.draft);

  let relatedNotes: ContentEntry<FieldNote>[] = [];

  // Prefer explicit curation via the related field
  if (entry.data.related.length > 0) {
    relatedNotes = entry.data.related
      .map((relSlug) => allFieldNotes.find((n) => n.slug === relSlug))
      .filter(Boolean) as ContentEntry<FieldNote>[];
  }

  // Fallback: find field notes sharing at least one tag
  if (relatedNotes.length === 0 && entry.data.tags.length > 0) {
    const essayTags = new Set(entry.data.tags);
    relatedNotes = allFieldNotes
      .filter((n) => n.data.tags.some((t) => essayTags.has(t)))
      .sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf())
      .slice(0, 4);
  }

  // Cross-reference shelf entries with essay sources
  const allShelf = getCollection<ShelfEntry>('shelf');
  const sourceUrls = new Set(entry.data.sources.map((s) => s.url));
  const shelfByUrl: Record<string, ShelfAnnotation> = {};
  const shelfStandalone: ShelfAnnotation[] = [];

  for (const item of allShelf) {
    const toAnnotation = (matchedByUrl: boolean): ShelfAnnotation => ({
      slug: item.slug,
      title: item.data.title,
      creator: item.data.creator,
      annotation: item.data.annotation,
      matchedByUrl,
    });

    const urlMatch = item.data.url && sourceUrls.has(item.data.url);
    const essayMatch = item.data.connectedEssay === slug;

    if (urlMatch && item.data.url) {
      shelfByUrl[item.data.url] = toAnnotation(true);
    } else if (essayMatch) {
      shelfStandalone.push(toAnnotation(false));
    }
  }

  // Detect pre-composited collage image from the Python engine
  const collagePath = nodePath.join(process.cwd(), 'public', 'collage', `${slug}.jpg`);
  const collageImage = fs.existsSync(collagePath) ? `/collage/${slug}.jpg` : undefined;

  // Connection engine: compute relationships at build time
  const allContent: AllContent = {
    essays: getCollection<Essay>('essays').filter((e) => !e.data.draft),
    fieldNotes: allFieldNotes,
    shelf: allShelf,
  };
  const engineConnections = computeConnections(entry, allContent);
  const positionedConnections = positionConnections(engineConnections, annotatedHtml, entry.data.connectionNotes);
  const suggestions = generateNavigationSuggestions(engineConnections, entry.data.tags, 4);

  // Inject inline callouts for connections with text mentions
  const calloutHtml = injectConnectionCallouts(annotatedHtml, positionedConnections);

  // Final pipeline step: footnote markers (hidden on screen, shown in print)
  const html = injectFootnoteMarkers(calloutHtml);

  return (
    <>
    <ArticleJsonLd
      title={entry.data.title}
      description={entry.data.summary}
      slug={slug}
      datePublished={entry.data.date}
      section="essays"
      tags={entry.data.tags}
    />
    <ReadingProgress />
    <article data-pagefind-body data-pagefind-filter="type:essay">
      {/* Full-bleed editorial hero header */}
      <EssayHero
        title={entry.data.title}
        date={entry.data.date}
        readingTime={readingTime}
        slug={slug}
        youtubeId={entry.data.youtubeId}
        category={entry.data.tags[0]}
        summary={entry.data.summary}
        collageImage={collageImage}
        thesis={entry.data.thesis}
        sourceCount={entry.data.sourceCount}
        tags={
          <TagList tags={entry.data.tags} tint="terracotta" inverted />
        }
        progressTracker={
          <ProgressTracker
            stages={ESSAY_STAGES}
            currentStage={entry.data.stage || 'published'}
            color="var(--color-terracotta-light)"
            annotationCount={entry.data.annotations?.length}
            lastAdvanced={entry.data.lastAdvanced?.toISOString()}
            inverted
          />
        }
      />

      {/* YouTube embed below hero if video exists */}
      {entry.data.youtubeId && (
        <div className="mt-6">
          <YouTubeEmbed
            videoId={entry.data.youtubeId}
            title={entry.data.title}
          />
        </div>
      )}

      <ReadingSurface className="reading-surface--hero-overlap">
        {/* All header metadata on the reading surface */}
        <header className="mb-8">
          {/* Top row: category + date/reading time/sources */}
          <div className="flex justify-between items-start mb-2">
            {entry.data.tags[0] && (
              <div className="flex items-center gap-3">
                <span
                  className="font-mono"
                  style={{
                    fontSize: 11,
                    textTransform: 'uppercase',
                    letterSpacing: '0.12em',
                    color: 'var(--color-terracotta)',
                  }}
                >
                  {entry.data.tags[0]}
                </span>
                <div
                  style={{
                    width: 32,
                    height: 1,
                    backgroundColor: 'var(--color-terracotta)',
                    opacity: 0.4,
                  }}
                />
              </div>
            )}
            <div className="text-right">
              <span className="font-mono block text-[10px] uppercase tracking-[0.08em] text-ink-faint">
                {entry.data.date.toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </span>
              <span className="font-mono block text-[10px] uppercase tracking-[0.08em] text-ink-faint">
                {readingTime} min read
              </span>
              {entry.data.sourceCount != null && entry.data.sourceCount > 0 && (
                <span className="font-mono block text-[10px] uppercase tracking-[0.08em] text-ink-faint">
                  Based on {entry.data.sourceCount} {entry.data.sourceCount === 1 ? 'source' : 'sources'}
                </span>
              )}
            </div>
          </div>

          {/* Title */}
          <h1 className="font-title text-3xl sm:text-4xl md:text-[2.75rem] font-bold leading-[1.15] mb-3">
            {entry.data.title}
          </h1>

          {/* Thesis */}
          {entry.data.thesis && (
            <p
              className="text-base leading-relaxed mb-4 line-clamp-2"
              style={{
                fontFamily: 'var(--font-body-alt)',
                fontStyle: 'italic',
                color: 'var(--color-ink-muted)',
                borderLeft: '2px solid var(--color-terracotta)',
                paddingLeft: '0.75rem',
                maxWidth: '55ch',
              }}
            >
              {entry.data.thesis}
            </p>
          )}

          {/* Summary */}
          {entry.data.summary && (
            <p className="text-base max-w-prose leading-relaxed mb-4 text-ink-muted">
              {entry.data.summary}
            </p>
          )}

          {/* Tags + progress tracker */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <TagList tags={entry.data.tags} tint="terracotta" />
            <ProgressTracker
              stages={ESSAY_STAGES}
              currentStage={entry.data.stage || 'published'}
              color="var(--color-terracotta)"
              annotationCount={entry.data.annotations?.length}
              lastAdvanced={entry.data.lastAdvanced?.toISOString()}
            />
          </div>
        </header>

        {/* Separator between header metadata and prose body */}
        <div
          style={{
            height: 1,
            background: 'var(--color-teal)',
            opacity: 0.15,
            marginBottom: '2rem',
          }}
        />

        <AnnotatedArticle
          html={html}
          className="prose prose-essays"
          contentType="essays"
          articleSlug={slug}
          essayTitle={entry.data.title}
          positionedConnections={positionedConnections}
          annotations={entry.data.annotations ?? []}
          sidenotes={sidenotes}
        />
      </ReadingSurface>

      {(entry.data.sources.length > 0 || shelfStandalone.length > 0) && (
        <>
          <RoughLine />
          <SourcesCollapsible
            sources={entry.data.sources}
            shelfByUrl={shelfByUrl}
            shelfStandalone={shelfStandalone}
          />
        </>
      )}

      {/* Linked video projects from Studio */}
      {linkedVideos.filter((v) => v.youtube_id).length > 0 && (
        <>
          <RoughLine />
          <section className="py-4">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.1em] text-terracotta mb-3">
              Watch the Video
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {linkedVideos
                .filter((v) => v.youtube_id)
                .map((video) => (
                  <RoughBox key={video.slug} padding={16} tint="terracotta">
                    <a
                      href={`https://www.youtube.com/watch?v=${video.youtube_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block no-underline text-ink hover:text-terracotta transition-colors"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`https://img.youtube.com/vi/${video.youtube_id}/mqdefault.jpg`}
                        alt={video.title}
                        className="w-full rounded mb-2"
                        loading="lazy"
                      />
                      <span className="block font-title text-sm font-semibold">
                        {video.short_title || video.title}
                      </span>
                      <span className="block font-mono text-[10px] uppercase tracking-[0.08em] text-ink-faint mt-1">
                        Watch on YouTube
                      </span>
                    </a>
                  </RoughBox>
                ))}
            </div>
          </section>
        </>
      )}

      {/* Process Notes: research metadata (returns null if all fields empty) */}
      <ProcessNotes
        researchStarted={entry.data.researchStarted}
        essayDate={entry.data.date.toISOString()}
        revisionCount={entry.data.revisionCount}
        sourceCount={entry.data.sourceCount}
        researchNotes={entry.data.researchNotes}
        sourceSummary={entry.data.sourceSummary}
        connectedTypes={entry.data.connectedTypes}
        videoPhase={primaryVideoDetail?.phase_display}
        videoSceneCount={primaryVideoDetail?.scenes.length}
        videoScriptWords={primaryVideoDetail?.script_word_count}
      />

      {/* Research Trail: fetches from research API, renders nothing if empty */}
      <RoughLine />
      <ResearchTrail slug={slug} />

      {(() => {
        const connectedNotes = allFieldNotes.filter(
          (n) => n.data.connectedTo === slug
        );
        const connectedSlugs = new Set(connectedNotes.map((n) => n.slug));
        const topicNotes = relatedNotes.filter((n) => !connectedSlugs.has(n.slug));

        if (connectedNotes.length === 0 && topicNotes.length === 0) return null;

        return (
          <>
            <RoughLine />
            <section className="py-4">
              {connectedNotes.length > 0 && (
                <>
                  <h2 className="font-mono text-[11px] uppercase tracking-[0.1em] text-teal mb-3">
                    Field notes that led to this essay
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {connectedNotes.map((note) => (
                      <Link
                        key={note.slug}
                        href={`/field-notes/${note.slug}`}
                        className="block no-underline text-ink hover:text-teal p-3 rounded border border-teal/10 bg-teal/[0.03] transition-colors hover:border-teal/25 hover:bg-teal/[0.06]"
                      >
                        <span className="block font-title text-sm font-semibold">
                          {note.data.title}
                        </span>
                        {note.data.excerpt && (
                          <span className="block text-xs text-ink-secondary mt-1 line-clamp-2">
                            {note.data.excerpt}
                          </span>
                        )}
                      </Link>
                    ))}
                  </div>
                </>
              )}

              {topicNotes.length > 0 && (
                <>
                  <h2 className={`font-mono text-[11px] uppercase tracking-[0.1em] text-teal mb-3 ${connectedNotes.length > 0 ? 'mt-6' : ''}`}>
                    {connectedNotes.length > 0 ? 'Related by topic' : 'Related Field Notes'}
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {topicNotes.map((note) => (
                      <Link
                        key={note.slug}
                        href={`/field-notes/${note.slug}`}
                        className="block no-underline text-ink hover:text-teal p-3 rounded border border-teal/10 bg-teal/[0.03] transition-colors hover:border-teal/25 hover:bg-teal/[0.06]"
                      >
                        <span className="block font-title text-sm font-semibold">
                          {note.data.title}
                        </span>
                        {note.data.excerpt && (
                          <span className="block text-xs text-ink-secondary mt-1 line-clamp-2">
                            {note.data.excerpt}
                          </span>
                        )}
                      </Link>
                    ))}
                  </div>
                </>
              )}
            </section>
          </>
        );
      })()}

      <WhereToNext suggestions={suggestions} />

      <nav className="flex justify-between items-start gap-4 py-4 border-t border-border mt-6">
        <div>
          {prevEssay && (
            <Link
              href={`/essays/${prevEssay.slug}`}
              className="font-mono text-sm hover:text-terracotta-hover"
            >
              &larr; {prevEssay.data.title}
            </Link>
          )}
        </div>
        <div className="text-right">
          {nextEssay && (
            <Link
              href={`/essays/${nextEssay.slug}`}
              className="font-mono text-sm hover:text-terracotta-hover"
            >
              {nextEssay.data.title} &rarr;
            </Link>
          )}
        </div>
      </nav>

      {/* Dynamic colophon for print (hidden on screen, replaces CSS ::after fallback) */}
      <div className="print-colophon hidden">
        travisgilbert.me/essays/{slug} | Travis Gilbert
      </div>
    </article>
    <ConnectedReadingSidebar
      connections={engineConnections}
      currentSlug={slug}
      currentTitle={entry.data.title}
    />
    </>
  );
}
