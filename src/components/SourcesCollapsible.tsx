'use client';

import { useState } from 'react';
import * as Collapsible from '@radix-ui/react-collapsible';
import { CaretDown } from '@phosphor-icons/react';
import Link from 'next/link';

interface Source {
  title: string;
  url: string;
}

export interface ShelfAnnotation {
  slug: string;
  title: string;
  creator: string;
  annotation: string;
  /** Whether this shelf entry was matched by URL (true) or only by connectedEssay (false) */
  matchedByUrl: boolean;
}

interface SourcesCollapsibleProps {
  sources: Source[];
  /** Shelf entries cross-referenced with this essay, keyed by source URL for inline display */
  shelfByUrl?: Record<string, ShelfAnnotation>;
  /** Shelf entries connected to this essay but not matching any source URL */
  shelfStandalone?: ShelfAnnotation[];
}

export default function SourcesCollapsible({
  sources,
  shelfByUrl = {},
  shelfStandalone = [],
}: SourcesCollapsibleProps) {
  const [open, setOpen] = useState(false);

  if (sources.length === 0 && shelfStandalone.length === 0) return null;

  const totalCount = sources.length + shelfStandalone.length;

  return (
    <Collapsible.Root open={open} onOpenChange={setOpen} className="py-6">
      <Collapsible.Trigger className="group flex w-full items-center gap-2 bg-transparent border-none cursor-pointer p-0 text-left font-title text-xl font-bold text-ink hover:text-terracotta transition-colors">
        <span>Sources &amp; Further Reading</span>
        <span className="font-mono text-xs text-ink-muted font-normal">({totalCount})</span>
        <CaretDown
          size={16}
          weight="bold"
          className="text-ink-muted flex-shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180"
        />
      </Collapsible.Trigger>
      <Collapsible.Content className="overflow-hidden data-[state=open]:animate-[slideDown_200ms_ease-out] data-[state=closed]:animate-[slideUp_200ms_ease-out]">
        <ul className="list-none p-0 space-y-3 mt-4">
          {sources.map((source) => {
            const shelf = shelfByUrl[source.url];
            return (
              <li key={source.url}>
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-sm hover:text-terracotta-hover"
                >
                  {source.title}{' '}
                  <span className="text-xs">&#8599;</span>
                </a>
                {shelf && (
                  <p className="mt-1 ml-0 text-xs text-ink-secondary font-annotation leading-relaxed">
                    <Link
                      href={`/shelf#${shelf.slug}`}
                      className="text-gold hover:text-gold/80 no-underline"
                    >
                      On the shelf
                    </Link>
                    {': '}
                    {shelf.annotation}
                  </p>
                )}
              </li>
            );
          })}
        </ul>

        {shelfStandalone.length > 0 && (
          <>
            <h3 className="font-mono text-[11px] uppercase tracking-[0.1em] text-gold mt-6 mb-3">
              From the Reference Shelf
            </h3>
            <ul className="list-none p-0 space-y-3">
              {shelfStandalone.map((shelf) => (
                <li key={shelf.slug}>
                  <Link
                    href={`/shelf#${shelf.slug}`}
                    className="font-mono text-sm hover:text-gold/80 text-ink"
                  >
                    {shelf.title}
                    <span className="text-ink-muted"> by {shelf.creator}</span>
                  </Link>
                  <p className="mt-1 text-xs text-ink-secondary font-annotation leading-relaxed">
                    {shelf.annotation}
                  </p>
                </li>
              ))}
            </ul>
          </>
        )}
      </Collapsible.Content>
    </Collapsible.Root>
  );
}
