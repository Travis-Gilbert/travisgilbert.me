'use client';

/**
 * ActiveThreads: Homepage section showing active research threads.
 *
 * Fetches from GET /api/v1/threads/?status=active and renders
 * compact cards with thread title, description, entry count, and date.
 * Renders nothing if the API is unreachable or returns no threads.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from '@phosphor-icons/react/dist/ssr';
import RoughLine from '@/components/rough/RoughLine';
import type { ThreadListItem } from '@/lib/research';
import { fetchActiveThreads } from '@/lib/research';

interface ActiveThreadsProps {
  /** When true, the component renders its own section wrapper + RoughLine label */
  showLabel?: boolean;
}

export default function ActiveThreads({ showLabel = false }: ActiveThreadsProps) {
  const [threads, setThreads] = useState<ThreadListItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchActiveThreads().then((data) => {
      if (cancelled) return;
      setThreads(data);
      setLoaded(true);
    });
    return () => { cancelled = true; };
  }, []);

  // Render nothing if API returned empty or hasn't loaded
  if (!loaded || threads.length === 0) return null;

  const content = (
    <div className="space-y-4">
      {threads.map((thread) => (
        <Link
          key={thread.slug}
          href="/research"
          className="block no-underline text-ink hover:text-ink group"
        >
          <div
            className="rounded-lg border border-border p-4 transition-all duration-200
              group-hover:border-[var(--color-green)] group-hover:shadow-warm"
            style={{ backgroundColor: 'rgba(45, 95, 107, 0.035)' }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <h3 className="font-title text-base font-bold leading-snug group-hover:text-[var(--color-green)] transition-colors">
                  {thread.title}
                </h3>
                {thread.description && (
                  <p className="text-sm text-ink-secondary mt-1 line-clamp-2">
                    {thread.description}
                  </p>
                )}
              </div>
              <div className="flex-shrink-0 text-right">
                <span
                  className="inline-block font-mono text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded"
                  style={{
                    backgroundColor: 'rgba(90, 122, 74, 0.12)',
                    color: 'var(--color-green)',
                  }}
                >
                  {thread.entry_count} {thread.entry_count === 1 ? 'entry' : 'entries'}
                </span>
                {thread.started_date && (
                  <p className="text-[10px] font-mono text-ink-light mt-1">
                    since {new Date(thread.started_date).toLocaleDateString('en-US', {
                      month: 'short',
                      year: 'numeric',
                    })}
                  </p>
                )}
              </div>
            </div>
            {thread.tags && thread.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {thread.tags.map((tag) => (
                  <span
                    key={tag}
                    className="font-mono text-[10px] text-ink-light px-1.5 py-0.5 rounded"
                    style={{ backgroundColor: 'rgba(90, 122, 74, 0.08)' }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </Link>
      ))}

      <p className="text-right">
        <Link
          href="/research"
          className="inline-flex items-center gap-1 font-mono text-sm no-underline"
          style={{ color: 'var(--color-green)' }}
        >
          Paper Trail <ArrowRight size={14} weight="bold" />
        </Link>
      </p>
    </div>
  );

  if (!showLabel) return content;

  return (
    <section className="py-3 sm:py-6">
      <RoughLine label="Currently Researching" labelColor="var(--color-green)" />
      {content}
    </section>
  );
}
