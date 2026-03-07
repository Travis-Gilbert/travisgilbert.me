import type { Metadata } from 'next';
import SectionLabel from '@/components/SectionLabel';
import RoughLine from '@/components/rough/RoughLine';
import ChangelogEntry from '@/components/ChangelogEntry';
import DrawOnIcon from '@/components/rough/DrawOnIcon';

export const metadata: Metadata = {
  title: 'Changelog | Travis Gilbert',
  description: 'How this site evolves. Every meaningful change, tracked.',
};

interface RawEntry {
  sha: string;
  message: string;
  category: string;
  label: string;
  color: string;
  date: string;
  url: string;
  scope?: string;
}

function loadChangelog(): RawEntry[] {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('@/data/changelog.json') as RawEntry[];
  } catch {
    return [];
  }
}

function groupByMonth(entries: RawEntry[]): Map<string, RawEntry[]> {
  const groups = new Map<string, RawEntry[]>();
  for (const entry of entries) {
    const d = new Date(entry.date);
    const label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const existing = groups.get(label);
    if (existing) existing.push(entry);
    else groups.set(label, [entry]);
  }
  return groups;
}

export default function ChangelogPage() {
  const entries = loadChangelog();
  const grouped = groupByMonth(entries);

  return (
    <>
      <header className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <DrawOnIcon name="file-text" size={32} />
          <SectionLabel color="terracotta">CHANGELOG</SectionLabel>
        </div>
        <h1 className="font-title text-3xl mb-2">Changelog</h1>
        <p className="text-sm text-ink-secondary">
          How this site evolves. Every meaningful change, tracked.
        </p>
      </header>

      {entries.length === 0 && (
        <p className="text-ink-light font-mono text-sm">
          No changelog entries yet. They appear after the next build.
        </p>
      )}

      {Array.from(grouped.entries()).map(([month, monthEntries], i) => (
        <section key={month} className="mb-8">
          {i > 0 && <RoughLine className="my-6" />}
          <h2
            className="font-mono text-xs uppercase tracking-widest mb-4"
            style={{ color: '#B45A2D' }}
          >
            {month}
          </h2>
          <div className="flex flex-col gap-1 border-l border-border pl-4 ml-1">
            {monthEntries.map((entry) => (
              <ChangelogEntry key={entry.sha} {...entry} />
            ))}
          </div>
        </section>
      ))}
    </>
  );
}
