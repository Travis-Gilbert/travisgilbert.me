'use client';

import { useState } from 'react';
import { ArrowSquareOut, CaretDown } from '@phosphor-icons/react/dist/ssr';
import TagList from './TagList';

interface ProjectUrl {
  label: string;
  url: string;
}

interface ProjectEntry {
  title: string;
  role: string;
  description: string;
  year: number;
  date: Date;
  urls: ProjectUrl[];
  tags: string[];
}

interface ProjectTimelineProps {
  projects: ProjectEntry[];
}

function formatDateShort(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatDateFull(date: Date): string {
  return date
    .toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
    .toUpperCase();
}

/** Map roles to dot colors */
const roleDotColor: Record<string, string> = {
  builder: 'bg-teal',
  'project manager': 'bg-terracotta',
  organizer: 'bg-success',
};

function getDotColor(role: string): string {
  return roleDotColor[role.toLowerCase()] || 'bg-border';
}

function ProjectTimelineEntry({ project }: { project: ProjectEntry }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="ptl-entry">
      {/* Date header */}
      <div className="ptl-date-header">
        <span className="font-mono text-[11px] uppercase tracking-widest text-ink-faint">
          {formatDateFull(project.date)}
        </span>
      </div>

      <div className="ptl-row">
        {/* Left gutter: short date */}
        <div className="ptl-gutter">
          <span className="font-mono text-xs text-ink-faint">
            {formatDateShort(project.date)}
          </span>
        </div>

        {/* Dot */}
        <div className="ptl-dot-col">
          <span className={`ptl-dot ${getDotColor(project.role)}`} />
        </div>

        {/* Content column */}
        <div className="flex-1 min-w-0">
          <button
            onClick={() => setOpen(!open)}
            className="ptl-summary"
          >
            <div className="flex flex-col items-start gap-0.5 min-w-0 flex-1">
              {/* Category label + tag hints */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-[11px] uppercase tracking-widest text-ink-secondary font-bold">
                  {project.role}
                </span>
                {project.tags.slice(0, 2).map((tag) => (
                  <span
                    key={tag}
                    className="font-mono text-[10px] uppercase tracking-widest text-ink-faint"
                  >
                    {tag}
                  </span>
                ))}
              </div>
              {/* Title */}
              <span className="font-title text-base font-bold text-ink text-left">
                {project.title}
              </span>
            </div>

            {/* Chevron */}
            <CaretDown
              size={16}
              weight="thin"
              className={`ptl-chevron text-ink-faint flex-shrink-0 transition-transform duration-200 ${
                open ? 'rotate-180' : ''
              }`}
            />
          </button>

          {/* Expanded detail */}
          {open && (
            <div className="ptl-detail">
              <p className="text-sm text-ink-secondary m-0 mb-3">
                {project.description}
              </p>
              {project.urls.length > 0 && (
                <div className="mb-3">
                  <span className="font-mono text-[10px] uppercase tracking-widest text-ink-faint block mb-1.5">
                    Links
                  </span>
                  <div className="flex flex-wrap gap-3">
                    {project.urls.map((link) => (
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
                </div>
              )}
              <TagList tags={project.tags} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ProjectTimeline({ projects }: ProjectTimelineProps) {
  // Sort by date ascending (oldest first, like a timeline reading top-to-bottom)
  const sorted = [...projects].sort(
    (a, b) => new Date(a.date).valueOf() - new Date(b.date).valueOf()
  );

  return (
    <div className="ptl">
      {sorted.map((project) => (
        <ProjectTimelineEntry key={project.title} project={project} />
      ))}
    </div>
  );
}
