/**
 * PipelineCounter: async Server Component that displays content pipeline status.
 * Counts essays and field notes by stage, maps them to unified buckets,
 * and renders as colored monospace labels separated by middots.
 *
 * Also fetches active video projects from the Studio API to show
 * video production status alongside written content.
 *
 * Field note status mapping:
 *   observation -> researching, developing -> drafting, connected/undefined -> published
 */

import { getCollection } from '@/lib/content';
import type { Essay, FieldNote } from '@/lib/content';
import { fetchActiveVideos, PHASE_LABELS } from '@/lib/videos';
import type { VideoPhase } from '@/lib/videos';

interface Bucket {
  label: string;
  color: string;
  count: number;
}

export default async function PipelineCounter() {
  const essays = getCollection<Essay>('essays').filter((e) => !e.data.draft);
  const fieldNotes = getCollection<FieldNote>('field-notes').filter((n) => !n.data.draft);

  const buckets: Record<string, Bucket> = {
    researching: { label: 'RESEARCHING', color: 'var(--color-teal)', count: 0 },
    drafting: { label: 'DRAFTING', color: 'var(--color-terracotta)', count: 0 },
    production: { label: 'IN PRODUCTION', color: 'var(--color-gold)', count: 0 },
    published: { label: 'PUBLISHED', color: 'var(--color-green)', count: 0 },
  };

  for (const essay of essays) {
    const stage = essay.data.stage || 'published';
    if (stage === 'research') buckets.researching.count++;
    else if (stage === 'drafting') buckets.drafting.count++;
    else if (stage === 'production') buckets.production.count++;
    else buckets.published.count++;
  }

  for (const note of fieldNotes) {
    const status = note.data.status;
    if (status === 'observation') buckets.researching.count++;
    else if (status === 'developing') buckets.drafting.count++;
    else buckets.published.count++;
  }

  // Fetch active video projects (graceful: empty array on API failure)
  const activeVideos = await fetchActiveVideos();

  const active = Object.values(buckets).filter((b) => b.count > 0);

  // Build a video label like "1 VIDEO IN P4 FILMING"
  let videoLabel: { text: string; color: string } | null = null;
  if (activeVideos.length > 0) {
    const highest = activeVideos.reduce((a, b) =>
      a.phase_number > b.phase_number ? a : b
    );
    const phaseDisplay = PHASE_LABELS[highest.phase as VideoPhase] ?? highest.phase_display;
    videoLabel = {
      text: `${activeVideos.length} VIDEO${activeVideos.length > 1 ? 'S' : ''} IN P${highest.phase_number} ${phaseDisplay}`,
      color: 'var(--color-green)',
    };
  }

  return (
    <div
      className="flex flex-wrap items-center gap-x-1.5 gap-y-1 font-mono"
      style={{ fontSize: 11, textTransform: 'uppercase' as const, letterSpacing: '0.08em' }}
      aria-label="Content pipeline status"
    >
      {active.map((bucket, i) => (
        <span key={bucket.label} className="inline-flex items-center gap-1.5">
          {i > 0 && (
            <span style={{ color: 'var(--color-ink-muted)' }} aria-hidden="true">
              &middot;
            </span>
          )}
          <span style={{ color: bucket.color }}>
            {bucket.count} {bucket.label}
          </span>
        </span>
      ))}
      {videoLabel && (
        <span className="inline-flex items-center gap-1.5">
          {active.length > 0 && (
            <span style={{ color: 'var(--color-ink-muted)' }} aria-hidden="true">
              &middot;
            </span>
          )}
          <span style={{ color: videoLabel.color }}>
            {videoLabel.text}
          </span>
        </span>
      )}
    </div>
  );
}
