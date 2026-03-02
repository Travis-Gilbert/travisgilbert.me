/**
 * ThreadTimeline: Vertical timeline of research thread entries.
 *
 * Thread header card with gold left border, followed by a vertical
 * timeline with color-coded dots for different entry types
 * (source, note, milestone, question, connection).
 */

import type { ResearchThread } from '@/lib/research';

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

interface ThreadTimelineProps {
  thread: ResearchThread;
}

/**
 * Entry type dot styles:
 *   source    = teal filled circle
 *   note      = hollow circle with border
 *   milestone = gold rotated square (diamond)
 *   question  = terracotta filled circle
 *   connection = small teal circle
 */
function EntryDot({ type }: { type: string }) {
  if (type === 'milestone') {
    return (
      <div className="absolute -left-5 top-1 w-[13px] h-[13px] rounded-[2px] bg-gold rotate-45" />
    );
  }

  if (type === 'source') {
    return (
      <div className="absolute -left-[19px] top-1 w-[11px] h-[11px] rounded-full bg-teal" />
    );
  }

  if (type === 'question') {
    return (
      <div className="absolute -left-[19px] top-1 w-[11px] h-[11px] rounded-full bg-terracotta" />
    );
  }

  if (type === 'connection') {
    return (
      <div className="absolute -left-[17px] top-1.5 w-[7px] h-[7px] rounded-full bg-teal" />
    );
  }

  // note: hollow circle
  return (
    <div className="absolute -left-[19px] top-1 w-[11px] h-[11px] rounded-full bg-bg-alt border-2 border-border" />
  );
}

export default function ThreadTimeline({ thread }: ThreadTimelineProps) {
  return (
    <div>
      {/* Thread header card */}
      <div className="bg-surface/85 backdrop-blur-[4px] border border-black/[0.06] border-l-[3px] border-l-gold rounded-[10px] p-4 px-5 mb-4">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="font-mono-alt text-[10px] uppercase tracking-[0.08em] text-surface bg-gold px-2 py-[2px] rounded-[3px]">
            {thread.status}
          </span>
          {thread.durationDays != null && (
            <span className="font-mono text-[10px] text-ink-light uppercase tracking-[0.06em]">
              {thread.durationDays} days
            </span>
          )}
        </div>
        <h4 className="font-title text-lg font-bold text-ink m-0 mb-1.5">
          {thread.title}
        </h4>
        <p className="font-body-alt text-sm leading-relaxed text-ink-muted m-0">
          {thread.description}
        </p>
      </div>

      {/* Vertical timeline */}
      <div className="relative pl-6">
        {/* Gold-to-border gradient line */}
        <div
          className="absolute left-[7px] top-1.5 bottom-1.5 w-px"
          style={{ background: 'linear-gradient(in srgb, to bottom, var(--color-gold), var(--color-border))' }}
        />

        {thread.entries.map((entry, i) => (
          <div
            key={i}
            className={`relative ${i < thread.entries.length - 1 ? 'pb-5' : ''}`}
          >
            <EntryDot type={entry.entryType} />
            <div>
              <span className="font-mono text-[10px] text-ink-light uppercase tracking-[0.06em]">
                {formatDate(entry.date)}
              </span>
              <p className="font-body-alt text-sm font-medium text-ink mt-0.5 mb-0 leading-snug">
                {entry.title}
              </p>
              {entry.description && (
                <p className="font-body-alt text-[13px] text-ink-muted mt-1 mb-0 leading-relaxed">
                  {entry.description}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
