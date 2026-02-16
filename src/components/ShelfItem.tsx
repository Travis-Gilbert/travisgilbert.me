import TagList from './TagList';
import RoughBox from './rough/RoughBox';

interface ShelfItemProps {
  title: string;
  creator: string;
  type: string;
  annotation: string;
  url?: string;
  tags: string[];
}

const typeColors: Record<string, string> = {
  book: 'bg-terracotta/10 text-terracotta',
  video: 'bg-gold/20 text-ink',
  podcast: 'bg-rough-light/20 text-ink',
  article: 'bg-code text-ink-secondary',
  tool: 'bg-ink/5 text-ink',
  album: 'bg-gold/10 text-ink',
  other: 'bg-code text-ink-secondary',
};

export default function ShelfItem({
  title,
  creator,
  type,
  annotation,
  url,
  tags,
}: ShelfItemProps) {
  return (
    <RoughBox padding={20} hover>
      <div className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-base font-title font-bold m-0">
              {url ? (
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-terracotta"
                >
                  {title} <span className="text-xs">&#8599;</span>
                </a>
              ) : (
                title
              )}
            </h3>
            <p className="text-sm text-ink-secondary m-0 font-mono">{creator}</p>
          </div>
          <span
            className={`inline-block text-xs font-mono px-2 py-0.5 rounded whitespace-nowrap ${
              typeColors[type] || typeColors.other
            }`}
          >
            {type}
          </span>
        </div>
        <p className="text-sm text-ink-secondary m-0">{annotation}</p>
        <TagList tags={tags} tint="gold" />
      </div>
    </RoughBox>
  );
}
