import Link from 'next/link';
import { OpenNewWindow } from 'iconoir-react';
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
  slug?: string;
}

export default function ProjectCard({
  title,
  role,
  description,
  year,
  urls,
  tags,
  slug,
}: ProjectCardProps) {
  const primaryUrl = urls[0]?.url;

  return (
    <RoughBox padding={20} hover tint="gold">
      <div className="flex flex-col gap-2 card-link-stretch">
        {primaryUrl && (
          <a
            href={primaryUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="card-link-main"
            aria-label={title}
          >
            <span className="sr-only">{title}</span>
          </a>
        )}
        <div>
          <h3 className="text-lg font-title font-bold m-0">{title}</h3>
          <p className="text-sm text-ink-secondary m-0 font-mono">
            {role} &middot; {year}
          </p>
        </div>
        <p className="text-sm text-ink-secondary m-0">{description}</p>
        {urls.length > 0 && (
          <div className="card-tags flex flex-wrap gap-3 mt-1">
            {urls.map((link) => (
              <a
                key={link.url}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-mono text-xs text-terracotta hover:text-terracotta-hover no-underline min-h-[44px]"
              >
                {link.label}
                <OpenNewWindow width={12} height={12} strokeWidth={1} />
              </a>
            ))}
          </div>
        )}
        <div className="card-tags pt-1">
          <TagList tags={tags} tint="gold" />
        </div>
      </div>
    </RoughBox>
  );
}
