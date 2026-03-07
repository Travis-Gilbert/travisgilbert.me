import Link from 'next/link';
import type { NavigationSuggestion } from '@/lib/connectionEngine';

const TYPE_URL_PREFIX: Record<string, string> = {
  essay: '/essays',
  'field-note': '/field-notes',
  shelf: '/shelf',
};

const TYPE_LABEL: Record<string, string> = {
  essay: 'Essay',
  'field-note': 'Field Note',
  shelf: 'Shelf',
};

interface WhereToNextCardProps {
  suggestion: NavigationSuggestion;
}

export default function WhereToNextCard({ suggestion }: WhereToNextCardProps) {
  const { connection, rationale } = suggestion;
  const href = `${TYPE_URL_PREFIX[connection.type] ?? ''}/${connection.slug}`;
  const typeLabel = TYPE_LABEL[connection.type] ?? connection.type;

  return (
    <Link
      href={href}
      className="block no-underline p-3 border-l-[3px] transition-colors hover:bg-[rgba(180,90,45,0.04)]"
      style={{ borderLeftColor: connection.color }}
    >
      <span
        className="font-mono text-[10px] uppercase tracking-widest"
        style={{ color: connection.color }}
      >
        {typeLabel}
      </span>
      <span className="block font-title text-lg text-ink mt-0.5">
        {connection.title}
      </span>
      <span className="block text-sm text-ink-secondary italic mt-0.5" style={{ fontFamily: 'var(--font-body)' }}>
        {rationale}
      </span>
    </Link>
  );
}
