import { ArrowSquareOut } from '@phosphor-icons/react/dist/ssr';
import TagList from './TagList';
import RoughBox from './rough/RoughBox';

interface ProjectUrl {
  label: string;
  url: string;
}

interface ProjectCardProps {
  title: string;
  role: string;
  description: string;
  year: number;
  urls: ProjectUrl[];
  tags: string[];
}

export default function ProjectCard({
  title,
  role,
  description,
  year,
  urls,
  tags,
}: ProjectCardProps) {
  return (
    <RoughBox padding={20} hover>
      <div className="flex flex-col gap-2">
        <div>
          <h3 className="text-lg font-title font-bold m-0">{title}</h3>
          <p className="text-sm text-ink-secondary m-0 font-mono">
            {role} &middot; {year}
          </p>
        </div>
        <p className="text-sm text-ink-secondary m-0">{description}</p>
        {urls.length > 0 && (
          <div className="flex flex-wrap gap-3 mt-1">
            {urls.map((link) => (
              <a
                key={link.url}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-mono text-xs text-terracotta hover:text-terracotta-hover no-underline"
              >
                {link.label}
                <ArrowSquareOut size={12} weight="thin" />
              </a>
            ))}
          </div>
        )}
        <div className="pt-1">
          <TagList tags={tags} tint="gold" />
        </div>
      </div>
    </RoughBox>
  );
}
