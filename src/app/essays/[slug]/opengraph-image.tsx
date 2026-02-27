import { ImageResponse } from 'next/og';
import { getCollection, getEntry, estimateReadingTime } from '@/lib/content';
import type { Essay } from '@/lib/content';

export const runtime = 'nodejs';
export const alt = 'Essay on travisgilbert.me';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const RESEARCH_API = 'https://research.travisgilbert.me';

interface TrailStats {
  sourceCount: number;
  backlinkCount: number;
  threadStatus: string | null;
}

async function fetchTrailStats(slug: string): Promise<TrailStats> {
  try {
    const res = await fetch(`${RESEARCH_API}/api/v1/trail/${slug}/`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return { sourceCount: 0, backlinkCount: 0, threadStatus: null };
    const data = await res.json();
    return {
      sourceCount: data.sources?.length ?? 0,
      backlinkCount: data.backlinks?.length ?? 0,
      threadStatus: data.thread?.status ?? null,
    };
  } catch {
    return { sourceCount: 0, backlinkCount: 0, threadStatus: null };
  }
}

export function generateStaticParams() {
  const essays = getCollection<Essay>('essays');
  return essays.map((e) => ({ slug: e.slug }));
}

export default async function EssayOGImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const entry = getEntry<Essay>('essays', slug);
  if (!entry) {
    return new ImageResponse(
      (
        <div
          style={{
            background: '#F0EBE4',
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'Georgia, serif',
            fontSize: 32,
            color: '#2A2420',
          }}
        >
          Essay not found
        </div>
      ),
      { ...size },
    );
  }

  const readingTime = estimateReadingTime(entry.body);
  const stats = await fetchTrailStats(slug);
  const hasResearchData = stats.sourceCount > 0 || stats.backlinkCount > 0 || stats.threadStatus;

  return new ImageResponse(
    (
      <div
        style={{
          background: '#F0EBE4',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '64px 80px',
          fontFamily: 'Georgia, serif',
          position: 'relative',
        }}
      >
        {/* Border frame */}
        <div
          style={{
            position: 'absolute',
            top: 20,
            left: 20,
            right: 20,
            bottom: 20,
            border: '2px solid #D4CCC4',
            borderRadius: 8,
            display: 'flex',
          }}
        />

        {/* Terracotta accent line at top */}
        <div
          style={{
            position: 'absolute',
            top: 20,
            left: 80,
            right: 80,
            height: 3,
            background: '#B45A2D',
            display: 'flex',
          }}
        />

        {/* Top section: category + meta */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          {/* Category tag */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: '#B45A2D',
                display: 'flex',
              }}
            />
            <span
              style={{
                fontSize: 13,
                fontFamily: 'Courier New, monospace',
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
                color: '#B45A2D',
                display: 'flex',
              }}
            >
              {entry.data.tags[0] || 'Essay'}
            </span>
          </div>

          {/* Reading time */}
          <span
            style={{
              fontSize: 13,
              fontFamily: 'Courier New, monospace',
              color: '#9A8E82',
              display: 'flex',
            }}
          >
            {readingTime} min read
          </span>
        </div>

        {/* Middle: title + summary */}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center' }}>
          <div
            style={{
              fontSize: 48,
              fontWeight: 700,
              color: '#2A2420',
              lineHeight: 1.15,
              display: 'flex',
              maxWidth: 900,
            }}
          >
            {entry.data.title}
          </div>

          <div
            style={{
              fontSize: 22,
              color: '#6A5E52',
              lineHeight: 1.5,
              marginTop: 20,
              maxWidth: 800,
              display: 'flex',
            }}
          >
            {entry.data.summary}
          </div>
        </div>

        {/* Bottom: research stats + site URL */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          {/* Research stats (only if data exists) */}
          {hasResearchData ? (
            <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
              {stats.sourceCount > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: '#2D5F6B',
                      display: 'flex',
                    }}
                  />
                  <span
                    style={{
                      fontSize: 12,
                      fontFamily: 'Courier New, monospace',
                      color: '#6A5E52',
                      display: 'flex',
                    }}
                  >
                    {stats.sourceCount} source{stats.sourceCount !== 1 ? 's' : ''}
                  </span>
                </div>
              )}
              {stats.backlinkCount > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: '#C49A4A',
                      display: 'flex',
                    }}
                  />
                  <span
                    style={{
                      fontSize: 12,
                      fontFamily: 'Courier New, monospace',
                      color: '#6A5E52',
                      display: 'flex',
                    }}
                  >
                    {stats.backlinkCount} backlink{stats.backlinkCount !== 1 ? 's' : ''}
                  </span>
                </div>
              )}
              {stats.threadStatus && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: '#5A7A4A',
                      display: 'flex',
                    }}
                  />
                  <span
                    style={{
                      fontSize: 12,
                      fontFamily: 'Courier New, monospace',
                      color: '#6A5E52',
                      display: 'flex',
                    }}
                  >
                    thread: {stats.threadStatus}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex' }}>
              <span
                style={{
                  fontSize: 14,
                  fontFamily: 'Courier New, monospace',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  color: '#9A8E82',
                  display: 'flex',
                }}
              >
                Essays on ...
              </span>
            </div>
          )}

          {/* Site URL */}
          <span
            style={{
              fontSize: 14,
              fontFamily: 'Courier New, monospace',
              color: '#9A8E82',
              display: 'flex',
            }}
          >
            travisgilbert.me
          </span>
        </div>
      </div>
    ),
    { ...size },
  );
}
