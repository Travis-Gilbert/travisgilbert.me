/**
 * PublicationGraph: SVG bar chart of publication activity by month.
 *
 * Async Server Component that aggregates content publication dates at build time.
 * 12-month rolling window, grouped by month. Three stacked series:
 *   terracotta (bottom): essays
 *   teal (middle): field notes
 *   gold (top): published videos
 *
 * Renders inside a RoughBox on the /now page.
 * Accessible: <title>, role="img", bar labels as <text> elements.
 */

import { getCollection } from '@/lib/content';
import type { Essay, FieldNote } from '@/lib/content';
import { fetchAllVideos } from '@/lib/videos';
import RoughBox from '@/components/rough/RoughBox';

interface MonthBucket {
  label: string;
  essays: number;
  notes: number;
  videos: number;
}

function buildMonthBuckets(videoPublishDates: Date[]): MonthBucket[] {
  const essays = getCollection<Essay>('essays').filter((e) => !e.data.draft);
  const fieldNotes = getCollection<FieldNote>('field-notes').filter((n) => !n.data.draft);

  const now = new Date();
  const buckets: MonthBucket[] = [];

  // Build 12 months rolling backwards
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = d.getFullYear();
    const month = d.getMonth();
    const label = d.toLocaleDateString('en-US', { month: 'short' });

    const essayCount = essays.filter((e) => {
      const ed = e.data.date;
      return ed.getFullYear() === year && ed.getMonth() === month;
    }).length;

    const noteCount = fieldNotes.filter((n) => {
      const nd = n.data.date;
      return nd.getFullYear() === year && nd.getMonth() === month;
    }).length;

    const videoCount = videoPublishDates.filter((vd) => {
      return vd.getFullYear() === year && vd.getMonth() === month;
    }).length;

    buckets.push({ label, essays: essayCount, notes: noteCount, videos: videoCount });
  }

  return buckets;
}

export default async function PublicationGraph() {
  // Fetch published videos from Studio API (graceful: empty array on failure)
  const allVideos = await fetchAllVideos();
  const videoPublishDates = allVideos
    .filter((v) => v.phase === 'published' && v.published_at)
    .map((v) => new Date(v.published_at!));

  const buckets = buildMonthBuckets(videoPublishDates);
  const maxTotal = Math.max(...buckets.map((b) => b.essays + b.notes + b.videos), 1);

  // Chart dimensions
  const width = 400;
  const height = 160;
  const padding = { top: 8, right: 8, bottom: 24, left: 8 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const barWidth = chartWidth / buckets.length;
  const barGap = 4;

  // Compute summary stats
  const totalEssays = buckets.reduce((sum, b) => sum + b.essays, 0);
  const totalNotes = buckets.reduce((sum, b) => sum + b.notes, 0);
  const totalVideos = buckets.reduce((sum, b) => sum + b.videos, 0);
  const activeMonths = buckets.filter((b) => b.essays + b.notes + b.videos > 0).length;

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
          Publication Activity
        </span>

        <svg
          width="100%"
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={`Publication activity: ${totalEssays} essays, ${totalNotes} field notes, and ${totalVideos} videos over 12 months`}
          style={{ maxWidth: width }}
        >
          <title>Publication activity over 12 months</title>

          {buckets.map((bucket, i) => {
            const x = padding.left + i * barWidth + barGap / 2;
            const bw = barWidth - barGap;

            // Essay bar (bottom)
            const essayHeight = (bucket.essays / maxTotal) * chartHeight;
            const essayY = padding.top + chartHeight - essayHeight;

            // Field note bar (stacked on top of essay)
            const noteHeight = (bucket.notes / maxTotal) * chartHeight;
            const noteY = essayY - noteHeight;

            // Video bar (stacked on top of field notes)
            const videoHeight = (bucket.videos / maxTotal) * chartHeight;
            const videoY = noteY - videoHeight;

            return (
              <g key={i}>
                {/* Essay bar */}
                {bucket.essays > 0 && (
                  <rect
                    x={x}
                    y={essayY}
                    width={bw}
                    height={essayHeight}
                    rx={2}
                    fill="var(--color-terracotta)"
                    opacity={0.7}
                  />
                )}

                {/* Field note bar */}
                {bucket.notes > 0 && (
                  <rect
                    x={x}
                    y={noteY}
                    width={bw}
                    height={noteHeight}
                    rx={2}
                    fill="var(--color-teal)"
                    opacity={0.7}
                  />
                )}

                {/* Video bar */}
                {bucket.videos > 0 && (
                  <rect
                    x={x}
                    y={videoY}
                    width={bw}
                    height={videoHeight}
                    rx={2}
                    fill="var(--color-gold)"
                    opacity={0.7}
                  />
                )}

                {/* Month label */}
                <text
                  x={x + bw / 2}
                  y={height - 4}
                  textAnchor="middle"
                  fill="var(--color-ink-faint)"
                  style={{
                    fontSize: 8,
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  {bucket.label}
                </text>
              </g>
            );
          })}

          {/* Baseline */}
          <line
            x1={padding.left}
            y1={padding.top + chartHeight}
            x2={width - padding.right}
            y2={padding.top + chartHeight}
            stroke="var(--color-border)"
            strokeWidth={0.5}
          />
        </svg>

        {/* Legend and stats */}
        <div className="flex flex-wrap items-center gap-4 mt-3">
          <div className="flex items-center gap-1.5">
            <span
              className="inline-block w-2 h-2 rounded-sm"
              style={{ backgroundColor: 'var(--color-terracotta)', opacity: 0.7 }}
            />
            <span
              className="font-mono"
              style={{
                fontSize: 9,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'var(--color-ink-faint)',
              }}
            >
              Essays ({totalEssays})
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span
              className="inline-block w-2 h-2 rounded-sm"
              style={{ backgroundColor: 'var(--color-teal)', opacity: 0.7 }}
            />
            <span
              className="font-mono"
              style={{
                fontSize: 9,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'var(--color-ink-faint)',
              }}
            >
              Field Notes ({totalNotes})
            </span>
          </div>
          {totalVideos > 0 && (
            <div className="flex items-center gap-1.5">
              <span
                className="inline-block w-2 h-2 rounded-sm"
                style={{ backgroundColor: 'var(--color-gold)', opacity: 0.7 }}
              />
              <span
                className="font-mono"
                style={{
                  fontSize: 9,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: 'var(--color-ink-faint)',
                }}
              >
                Videos ({totalVideos})
              </span>
            </div>
          )}
          <span
            className="font-mono ml-auto"
            style={{
              fontSize: 9,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'var(--color-ink-faint)',
            }}
          >
            {activeMonths} active {activeMonths === 1 ? 'month' : 'months'}
          </span>
        </div>
      </RoughBox>
    </section>
  );
}
