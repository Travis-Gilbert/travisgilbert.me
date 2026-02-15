import Link from 'next/link';
import DateStamp from './DateStamp';
import TagList from './TagList';
import RoughBox from './rough/RoughBox';

interface InvestigationCardProps {
  title: string;
  summary: string;
  date: Date;
  youtubeId: string;
  tags: string[];
  href: string;
}

export default function InvestigationCard({
  title,
  summary,
  date,
  youtubeId,
  tags,
  href,
}: InvestigationCardProps) {
  const thumbnailUrl = `https://img.youtube.com/vi/${youtubeId}/mqdefault.jpg`;

  return (
    <RoughBox padding={0}>
      <div className="overflow-hidden group">
        <Link href={href} className="block no-underline text-ink hover:text-ink">
          <div className="md:flex">
            {/* Thumbnail */}
            <div className="md:w-64 md:flex-shrink-0">
              <img
                src={thumbnailUrl}
                alt={`Thumbnail for ${title}`}
                className="w-full h-40 md:h-full object-cover"
                loading="lazy"
              />
            </div>
            {/* Content */}
            <div className="p-4 flex-1 flex flex-col gap-2">
              <DateStamp date={date} />
              <h3 className="text-lg font-title font-bold group-hover:text-terracotta transition-colors m-0">
                {title}
              </h3>
              <p className="text-sm text-ink-secondary m-0 line-clamp-2">
                {summary}
              </p>
            </div>
          </div>
        </Link>
        {tags.length > 0 && (
          <div className="px-4 pb-4 md:pl-[calc(16rem+1rem)]">
            <TagList tags={tags} />
          </div>
        )}
      </div>
    </RoughBox>
  );
}
