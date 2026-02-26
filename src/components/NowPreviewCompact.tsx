import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import Link from 'next/link';

interface NowData {
  updated: string;
  researching: string;
  researching_context?: string;
  reading: string;
  reading_context?: string;
  building: string;
  building_context?: string;
  listening: string;
  listening_context?: string;
  thinking?: string;
}

function getNowData(): NowData | null {
  const filePath = path.join(process.cwd(), 'src', 'content', 'now.md');
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, 'utf-8');
  const { data } = matter(raw);
  return data as NowData;
}

const QUADRANTS: {
  label: string;
  field: keyof Omit<NowData, 'updated' | 'researching_context' | 'reading_context' | 'building_context' | 'listening_context' | 'thinking'>;
  color: string;
  /** Lighter variant for inverted (dark background) mode */
  colorLight: string;
}[] = [
  { label: 'Researching', field: 'researching', color: 'var(--color-terracotta)', colorLight: 'var(--color-terracotta-light)' },
  { label: 'Reading', field: 'reading', color: 'var(--color-teal)', colorLight: 'var(--color-teal-light)' },
  { label: 'Building', field: 'building', color: 'var(--color-gold)', colorLight: 'var(--color-gold-light)' },
  { label: 'Listening to', field: 'listening', color: 'var(--color-success)', colorLight: 'var(--color-success-light)' },
];

interface NowPreviewCompactProps {
  /** When true, renders light text for dark backgrounds (hero zone) */
  inverted?: boolean;
}

/**
 * NowPreviewCompact: wide 2x2 grid /now snapshot for the homepage hero.
 * No RoughBox wrapper. Subtle left border. Server Component.
 * Horizontal rectangle layout keeps hero height close to the identity column.
 *
 * When `inverted` is true, text renders in cream/light tones for the dark hero ground.
 */
export default function NowPreviewCompact({ inverted = false }: NowPreviewCompactProps) {
  const data = getNowData();
  if (!data) return null;

  const borderColor = inverted
    ? 'color-mix(in srgb, var(--color-hero-text) 15%, transparent)'
    : undefined;

  const headerColor = inverted
    ? 'var(--color-hero-text-muted)'
    : undefined;

  const valueColor = inverted
    ? 'var(--color-hero-text)'
    : undefined;

  return (
    <div
      className={`pl-4 ${inverted ? '' : 'border-l-2 border-border-light'}`}
      style={inverted ? { borderLeft: `2px solid ${borderColor}` } : undefined}
    >
      <Link href="/now" className="no-underline group">
        <span
          className={`font-mono block mb-2 ${inverted ? '' : 'text-ink-muted'} group-hover:text-terracotta transition-colors`}
          style={{
            fontSize: 10,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: headerColor ?? undefined,
          }}
        >
          Right now &rarr;
        </span>
      </Link>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
        {QUADRANTS.map((q) => (
          <div key={q.field}>
            <span
              className="font-mono"
              style={{
                fontSize: 9,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: inverted ? q.colorLight : q.color,
              }}
            >
              {q.label}
            </span>
            <span
              className={`font-title text-[13px] font-semibold block leading-tight ${inverted ? '' : 'text-ink'}`}
              style={valueColor ? { color: valueColor } : undefined}
            >
              {data[q.field]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
