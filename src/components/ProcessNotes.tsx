/**
 * ProcessNotes: research metadata panel for essay detail pages.
 *
 * Displays research timeline, revision count, source count, and
 * research notes in a compact metadata grid. Returns null if all
 * fields are empty (graceful degradation for existing essays).
 *
 * Server Component: no browser APIs needed.
 */

import RoughBox from '@/components/rough/RoughBox';

interface ProcessNotesProps {
  researchStarted?: string;
  revisionCount?: number;
  sourceCount?: number;
  researchNotes?: string[];
  /** Human-readable summary of source types (e.g., "3 academic papers, 2 interviews") */
  sourceSummary?: string;
  /** Content types this essay connects to (e.g., ["field-note", "project"]) */
  connectedTypes?: string[];
  /** Video production metrics (from linked VideoProject) */
  videoPhase?: string;
  videoSceneCount?: number;
  videoScriptWords?: number;
}

function formatResearchDuration(startDate: string): string | null {
  const start = new Date(startDate);
  const now = new Date();
  const days = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

  if (days < 0) return null;
  if (days >= 60) {
    const months = Math.floor(days / 30);
    return `${months} month${months === 1 ? '' : 's'}`;
  }
  if (days >= 14) {
    const weeks = Math.floor(days / 7);
    return `${weeks} week${weeks === 1 ? '' : 's'}`;
  }
  return `${days} day${days === 1 ? '' : 's'}`;
}

export default function ProcessNotes({
  researchStarted,
  revisionCount,
  sourceCount,
  researchNotes,
  sourceSummary,
  connectedTypes,
  videoPhase,
  videoSceneCount,
  videoScriptWords,
}: ProcessNotesProps) {
  const hasConnectedTypes = connectedTypes != null && connectedTypes.length > 0;
  const hasWrittenMeta = !!(researchStarted || revisionCount || sourceCount || sourceSummary || hasConnectedTypes || (researchNotes && researchNotes.length > 0));
  const hasVideoMeta = !!(videoPhase || videoSceneCount || videoScriptWords);

  // Return null if all fields are empty
  if (!hasWrittenMeta && !hasVideoMeta) {
    return null;
  }

  const metadata: { label: string; value: string }[] = [];

  if (researchStarted) {
    const date = new Date(researchStarted);
    const formatted = date.toLocaleDateString('en-US', {
      month: 'short',
      year: 'numeric',
    });
    metadata.push({ label: 'Research started', value: formatted });
  }

  if (revisionCount != null && revisionCount > 0) {
    metadata.push({
      label: 'Revisions',
      value: String(revisionCount),
    });
  }

  if (sourceCount != null && sourceCount > 0) {
    metadata.push({
      label: 'Sources consulted',
      value: String(sourceCount),
    });
  }

  if (researchStarted) {
    const duration = formatResearchDuration(researchStarted);
    if (duration) {
      metadata.push({ label: 'Research period', value: duration });
    }
  }

  return (
    <section className="py-4">
      <RoughBox padding={20} tint="neutral">
        <span
          className="font-mono block mb-3"
          style={{
            fontSize: 11,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: 'var(--color-ink-muted)',
          }}
        >
          Process Notes
        </span>

        {metadata.length > 0 && (
          <div className="flex flex-wrap gap-x-6 gap-y-2 mb-3">
            {metadata.map((item) => (
              <div key={item.label} className="flex items-baseline gap-2">
                <span
                  className="font-mono"
                  style={{
                    fontSize: 9,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    color: 'var(--color-ink-faint)',
                  }}
                >
                  {item.label}
                </span>
                <span
                  className="font-title text-sm font-semibold"
                  style={{ color: 'var(--color-ink)' }}
                >
                  {item.value}
                </span>
              </div>
            ))}
          </div>
        )}

        {sourceSummary && (
          <p
            className="m-0 mb-3"
            style={{
              fontFamily: 'var(--font-metadata)',
              fontSize: 12,
              fontStyle: 'italic',
              color: 'var(--color-ink-muted)',
            }}
          >
            {sourceSummary}
          </p>
        )}

        {hasConnectedTypes && (
          <div className="flex items-baseline gap-2 mb-3">
            <span
              className="font-mono"
              style={{
                fontSize: 9,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'var(--color-ink-faint)',
              }}
            >
              Connected to
            </span>
            <div className="flex flex-wrap gap-1.5">
              {connectedTypes!.map((type) => (
                <span
                  key={type}
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    background: 'rgba(45, 95, 107, 0.08)',
                    padding: '2px 8px',
                    borderRadius: 9999,
                    color: 'var(--color-teal)',
                  }}
                >
                  {type}
                </span>
              ))}
            </div>
          </div>
        )}

        {researchNotes && researchNotes.length > 0 && (
          <ul className="list-none m-0 p-0 space-y-1">
            {researchNotes.map((note, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-sm"
                style={{ color: 'var(--color-ink-secondary)' }}
              >
                <span
                  className="font-mono flex-shrink-0 mt-0.5"
                  style={{
                    fontSize: 9,
                    color: 'var(--color-terracotta)',
                  }}
                >
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="font-body leading-relaxed">{note}</span>
              </li>
            ))}
          </ul>
        )}

        {hasVideoMeta && (
          <>
            {hasWrittenMeta && (
              <div
                className="my-3 border-t"
                style={{ borderColor: 'var(--color-border)' }}
              />
            )}
            <span
              className="font-mono block mb-2"
              style={{
                fontSize: 9,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'var(--color-green)',
              }}
            >
              Video Production
            </span>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              {videoPhase && (
                <div className="flex items-baseline gap-2">
                  <span
                    className="font-mono"
                    style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-ink-faint)' }}
                  >
                    Phase
                  </span>
                  <span className="font-title text-sm font-semibold" style={{ color: 'var(--color-ink)' }}>
                    {videoPhase}
                  </span>
                </div>
              )}
              {videoSceneCount != null && videoSceneCount > 0 && (
                <div className="flex items-baseline gap-2">
                  <span
                    className="font-mono"
                    style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-ink-faint)' }}
                  >
                    Scenes
                  </span>
                  <span className="font-title text-sm font-semibold" style={{ color: 'var(--color-ink)' }}>
                    {videoSceneCount}
                  </span>
                </div>
              )}
              {videoScriptWords != null && videoScriptWords > 0 && (
                <div className="flex items-baseline gap-2">
                  <span
                    className="font-mono"
                    style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-ink-faint)' }}
                  >
                    Script words
                  </span>
                  <span className="font-title text-sm font-semibold" style={{ color: 'var(--color-ink)' }}>
                    {videoScriptWords.toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          </>
        )}
      </RoughBox>
    </section>
  );
}
