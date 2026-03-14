import Link from 'next/link';
import DateStamp from './DateStamp';
import TagList from './TagList';
import RoughBox from './rough/RoughBox';
import { CompactTracker, ESSAY_STAGES } from './ProgressTracker';
import PatternImage from './PatternImage';

interface EssayCardProps {
  title: string;
  summary: string;
  date: Date;
  youtubeId: string;
  tags: string[];
  href: string;
  stage?: string;
  slug?: string;
}

export default function EssayCard({
  title,
  summary,
  date,
  youtubeId,
  tags,
  href,
  stage,
  slug,
}: EssayCardProps) {
  const hasThumbnail = Boolean(youtubeId);
  const thumbnailUrl = hasThumbnail
    ? `https://img.youtube.com/vi/${youtubeId}/mqdefault.jpg`
    : '';

  return (
    <RoughBox padding={0} hover tint="terracotta">
      <div className="overflow-hidden group card-link-stretch">
        <Link href={href} className="card-link-main block no-underline text-ink hover:text-ink min-h-[44px]">
          {hasThumbnail ? (
            <div className="md:flex">
              <div className="md:w-64 md:flex-shrink-0">
                <img
                  src={thumbnailUrl}
                  alt={`Thumbnail for ${title}`}
                  width={320}
                  height={180}
                  className="w-full h-40 md:h-full object-cover"
                  loading="lazy"
                />
              </div>
              <div className="p-4 flex-1 flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <DateStamp date={date} />
                  <CompactTracker
                    stages={ESSAY_STAGES}
                    currentStage={stage || 'published'}
                    color="var(--color-terracotta)"
                  />
                </div>
                <h3 className="text-lg font-title font-bold group-hover:text-terracotta transition-colors m-0">
                  {title}
                </h3>
                <p className="text-sm text-ink-secondary m-0 line-clamp-2">
                  {summary}
                </p>
              </div>
            </div>
          ) : (
            <>
              <PatternImage
                seed={slug || title}
                height={100}
                color="var(--color-terracotta)"
              />
              <div className="p-4 flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <DateStamp date={date} />
                  <CompactTracker
                    stages={ESSAY_STAGES}
                    currentStage={stage || 'published'}
                    color="var(--color-terracotta)"
                  />
                </div>
                <h3 className="text-lg font-title font-bold group-hover:text-terracotta transition-colors m-0">
                  {title}
                </h3>
                <p className="text-sm text-ink-secondary m-0 line-clamp-2">
                  {summary}
                </p>
              </div>
            </>
          )}
        </Link>
        {tags.length > 0 && (
          <div className={`card-tags px-4 pb-4 ${hasThumbnail ? 'md:pl-[calc(16rem+1rem)]' : ''}`}>
            <TagList tags={tags} tint="terracotta" />
          </div>
        )}
      </div>
    </RoughBox>
  );
}
