import Link from 'next/link';
import { slugifyTag } from '@/lib/slugify';

type TagTint = 'terracotta' | 'teal' | 'gold' | 'neutral';

interface TagListProps {
  tags: string[];
  /** Content-type color tint for tags */
  tint?: TagTint;
}

const tintStyles: Record<TagTint, string> = {
  neutral: 'border-border text-ink-faint hover:border-terracotta hover:text-terracotta',
  terracotta:
    'border-terracotta/15 text-ink-faint bg-terracotta/[0.04] hover:border-terracotta hover:text-terracotta',
  teal:
    'border-teal/15 text-ink-faint bg-teal/[0.04] hover:border-teal hover:text-teal',
  gold:
    'border-gold/15 text-ink-faint bg-gold/[0.04] hover:border-gold hover:text-gold',
};

export default function TagList({ tags, tint = 'neutral' }: TagListProps) {
  if (tags.length === 0) return null;

  return (
    <ul className="flex flex-wrap gap-2 list-none m-0 p-0">
      {tags.map((tag) => (
        <li key={tag}>
          <Link
            href={`/tags/${slugifyTag(tag)}`}
            className={`inline-flex items-center font-mono text-[10px] uppercase tracking-widest px-2 py-0.5 border rounded transition-colors no-underline ${tintStyles[tint]}`}
          >
            {tag}
          </Link>
        </li>
      ))}
    </ul>
  );
}
