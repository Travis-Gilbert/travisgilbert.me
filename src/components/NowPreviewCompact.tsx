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
}[] = [
  { label: 'Researching', field: 'researching', color: 'var(--color-terracotta)' },
  { label: 'Reading', field: 'reading', color: 'var(--color-teal)' },
  { label: 'Building', field: 'building', color: 'var(--color-gold)' },
  { label: 'Listening to', field: 'listening', color: 'var(--color-success)' },
];

/**
 * NowPreviewCompact: slim single-column /now snapshot for the homepage hero.
 * No RoughBox wrapper. Subtle left border. Server Component.
 * Only shows the four main values (no context lines, no "thinking about").
 */
export default function NowPreviewCompact() {
  const data = getNowData();
  if (!data) return null;

  return (
    <div className="pl-4 border-l-2 border-border-light">
      <Link href="/now" className="no-underline group">
        <span
          className="font-mono block mb-2 text-ink-muted group-hover:text-terracotta transition-colors"
          style={{
            fontSize: 10,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
          }}
        >
          Right now &rarr;
        </span>
      </Link>
      <div className="flex flex-col gap-2">
        {QUADRANTS.map((q) => (
          <div key={q.field}>
            <span
              className="font-mono"
              style={{
                fontSize: 9,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: q.color,
              }}
            >
              {q.label}
            </span>
            <span className="font-title text-sm font-semibold text-ink block leading-snug">
              {data[q.field]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
