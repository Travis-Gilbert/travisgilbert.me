/**
 * PublicationGraph: SVG cumulative step chart of publication output by month.
 *
 * Async Server Component that aggregates content publication dates at build time.
 * 12-month rolling window, grouped by month. Three stepped line series:
 *   terracotta: essays (cumulative)
 *   teal: field notes (cumulative)
 *   gold: published videos (cumulative)
 *
 * Renders inside a RoughBox on the /now page.
 * Accessible: <title>, role="img", month labels as <text> elements.
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

interface CumulativeBucket {
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

function buildStepPoints(
  cumulative: CumulativeBucket[],
  field: keyof Omit<CumulativeBucket, 'label'>,
  maxValue: number,
  chartWidth: number,
  chartHeight: number,
  paddingLeft: number,
  paddingTop: number,
): string {
  const colWidth = chartWidth / cumulative.length;
  const points: string[] = [];

  for (let i = 0; i < cumulative.length; i++) {
    const value = cumulative[i][field];
    const y = paddingTop + chartHeight - (value / maxValue) * chartHeight;
    const xLeft = paddingLeft + i * colWidth;
    const xRight = paddingLeft + (i + 1) * colWidth;
    points.push(`${xLeft},${y}`);
    points.push(`${xRight},${y}`);
  }

  return points.join(' ');
}

function buildAreaPoints(
  stepPoints: string,
  chartWidth: number,
  chartHeight: number,
  paddingLeft: number,
  paddingTop: number,
): string {
  const baseline = paddingTop + chartHeight;
  const rightEdge = paddingLeft + chartWidth;
  return `${paddingLeft},${baseline} ${stepPoints} ${rightEdge},${baseline}`;
}

export default async function PublicationGraph() {
  // Fetch published videos from Studio API (graceful: empty array on failure)
  const allVideos = await fetchAllVideos();
  const videoPublishDates = allVideos
    .filter((v) => v.phase === 'published' && v.published_at)
    .map((v) => new Date(v.published_at!));

  const buckets = buildMonthBuckets(videoPublishDates);

  // Compute cumulative totals per content type
  let essayCum = 0;
  let noteCum = 0;
  let videoCum = 0;
  const cumulative: CumulativeBucket[] = buckets.map((b) => {
    essayCum += b.essays;
    noteCum += b.notes;
    videoCum += b.videos;
    return { label: b.label, essays: essayCum, notes: noteCum, videos: videoCum };
  });

  const maxCumulative = Math.max(
    ...cumulative.map((c) => Math.max(c.essays, c.notes, c.videos)),
    1,
  );

  // Chart dimensions
  const width = 400;
  const height = 160;
  const padding = { top: 8, right: 8, bottom: 24, left: 8 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const colWidth = chartWidth / cumulative.length;

  // Summary stats (raw totals, same as cumulative endpoints)
  const totalEssays = buckets.reduce((sum, b) => sum + b.essays, 0);
  const totalNotes = buckets.reduce((sum, b) => sum + b.notes, 0);
  const totalVideos = buckets.reduce((sum, b) => sum + b.videos, 0);
  const activeMonths = buckets.filter((b) => b.essays + b.notes + b.videos > 0).length;

  // Build step polyline points for each series
  const essayPoints = buildStepPoints(
    cumulative, 'essays', maxCumulative, chartWidth, chartHeight, padding.left, padding.top,
  );
  const notePoints = buildStepPoints(
    cumulative, 'notes', maxCumulative, chartWidth, chartHeight, padding.left, padding.top,
  );
  const videoPoints = buildStepPoints(
    cumulative, 'videos', maxCumulative, chartWidth, chartHeight, padding.left, padding.top,
  );

  // Build closed polygon points for area fills
  const essayArea = buildAreaPoints(essayPoints, chartWidth, chartHeight, padding.left, padding.top);
  const noteArea = buildAreaPoints(notePoints, chartWidth, chartHeight, padding.left, padding.top);
  const videoArea = buildAreaPoints(videoPoints, chartWidth, chartHeight, padding.left, padding.top);

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
          aria-label={`Cumulative publication output: ${totalEssays} essays, ${totalNotes} field notes, and ${totalVideos} videos over 12 months`}
          style={{ maxWidth: width }}
        >
          <title>Cumulative publication output over 12 months</title>

          {/* Area fills (rendered first, behind the lines) */}
          <polygon points={essayArea} fill="var(--color-terracotta)" opacity={0.08} />
          <polygon points={noteArea} fill="var(--color-teal)" opacity={0.08} />
          <polygon points={videoArea} fill="var(--color-gold)" opacity={0.08} />

          {/* Step lines */}
          <polyline
            points={essayPoints}
            fill="none"
            stroke="var(--color-terracotta)"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={1.0}
          />
          <polyline
            points={notePoints}
            fill="none"
            stroke="var(--color-teal)"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={1.0}
          />
          <polyline
            points={videoPoints}
            fill="none"
            stroke="var(--color-gold)"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={1.0}
          />

          {/* Month labels */}
          {cumulative.map((bucket, i) => {
            const x = padding.left + i * colWidth + colWidth / 2;
            return (
              <text
                key={i}
                x={x}
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
