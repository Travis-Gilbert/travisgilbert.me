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
  /** Video production metrics (from linked VideoProject) */
  videoPhase?: string;
  videoSceneCount?: number;
  videoScriptWords?: number;
}

export default function ProcessNotes({
  researchStarted,
  revisionCount,
  sourceCount,
  researchNotes,
  videoPhase,
  videoSceneCount,
  videoScriptWords,
}: ProcessNotesProps) {
  const hasWrittenMeta = !!(researchStarted || revisionCount || sourceCount || (researchNotes && researchNotes.length > 0));
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
