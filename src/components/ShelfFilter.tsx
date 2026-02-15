import { useState } from 'preact/hooks';
import { slugifyTag } from '../lib/slugify';

interface ShelfEntry {
  title: string;
  creator: string;
  type: string;
  annotation: string;
  url?: string;
  tags: string[];
}

interface Props {
  items: ShelfEntry[];
}

const typeColors: Record<string, string> = {
  book: 'bg-terracotta/10 text-terracotta border-terracotta/30',
  video: 'bg-gold/20 text-ink border-gold/30',
  podcast: 'bg-rough-light/20 text-ink border-rough-light/30',
  article: 'bg-code text-ink-secondary border-border',
  tool: 'bg-ink/5 text-ink border-ink/10',
  album: 'bg-gold/10 text-ink border-gold/20',
  other: 'bg-code text-ink-secondary border-border',
};

export default function ShelfFilter({ items }: Props) {
  const [activeFilter, setActiveFilter] = useState<string>('all');

  const types = ['all', ...new Set(items.map((item) => item.type))];

  const filtered = activeFilter === 'all'
    ? items
    : items.filter((item) => item.type === activeFilter);

  return (
    <div>
      {/* Filter buttons */}
      <div class="flex flex-wrap gap-2 mb-8">
        {types.map((type) => (
          <button
            key={type}
            onClick={() => setActiveFilter(type)}
            class={`font-mono text-xs uppercase tracking-wider px-3 py-1.5 rounded-lg border cursor-pointer transition-colors ${
              activeFilter === type
                ? 'bg-terracotta text-paper border-terracotta'
                : 'bg-transparent text-ink-secondary border-border hover:border-terracotta hover:text-terracotta'
            }`}
          >
            {type === 'all' ? 'All' : type}
          </button>
        ))}
      </div>

      {/* Items */}
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filtered.map((item) => (
          <div key={item.title} class="border border-border rounded-xl p-5 bg-surface transition-shadow hover:shadow-md">
            <div class="flex items-start justify-between gap-2 mb-2">
              <div>
                <h3 class="text-base font-bold m-0" style="font-family: var(--font-title)">
                  {item.url ? (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      class="text-ink hover:text-terracotta"
                    >
                      {item.title} <span class="text-xs">&#8599;</span>
                    </a>
                  ) : (
                    item.title
                  )}
                </h3>
                <p class="text-sm text-ink-secondary m-0 font-mono">{item.creator}</p>
              </div>
              <span
                class={`inline-block text-xs font-mono uppercase tracking-wider px-2 py-0.5 rounded border whitespace-nowrap ${
                  typeColors[item.type] || typeColors.other
                }`}
              >
                {item.type}
              </span>
            </div>
            <p class="text-sm text-ink-secondary m-0 mb-2">{item.annotation}</p>
            {item.tags.length > 0 && (
              <div class="flex flex-wrap gap-1">
                {item.tags.map((tag) => (
                  <a
                    key={tag}
                    href={`/tags/${slugifyTag(tag)}`}
                    class="inline-flex items-center font-mono text-[10px] uppercase tracking-widest px-1.5 py-0.5 border border-border text-ink-faint rounded hover:border-terracotta hover:text-terracotta transition-colors no-underline"
                  >
                    {tag}
                  </a>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <p class="text-ink-secondary text-center py-8">No items in this category yet.</p>
      )}
    </div>
  );
}
