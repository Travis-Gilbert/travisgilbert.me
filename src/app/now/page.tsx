import type { Metadata } from 'next';
import Link from 'next/link';
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import DrawOnIcon from '@/components/rough/DrawOnIcon';
import RoughBox from '@/components/rough/RoughBox';
import PublicationGraph from '@/components/PublicationGraph';
import { fetchActiveVideos, PHASE_LABELS, VIDEO_PHASES } from '@/lib/videos';
import type { VideoSummary, VideoPhase } from '@/lib/videos';

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
  description: string;
}[] = [
  {
    label: 'Researching',
    field: 'researching',
    color: 'var(--color-terracotta)',
    description: 'The questions I keep returning to.',
  },
  {
    label: 'Reading',
    field: 'reading',
    color: 'var(--color-teal)',
    description: 'What is on the nightstand right now.',
  },
  {
    label: 'Building',
    field: 'building',
    color: 'var(--color-gold)',
    description: 'Active projects and experiments.',
  },
  {
    label: 'Listening to',
    field: 'listening',
    color: 'var(--color-success)',
    description: 'Podcasts, albums, and conversations.',
  },
];

function VideoProductionCard({ video }: { video: VideoSummary }) {
  const phase = video.phase as VideoPhase;
  const phaseIndex = VIDEO_PHASES.indexOf(phase);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-title text-sm font-semibold text-ink">
          {video.short_title || video.title}
        </span>
        <span
          className="font-mono flex-shrink-0"
          style={{
            fontSize: 9,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: 'var(--color-green)',
          }}
        >
          P{video.phase_number} {video.phase_display}
        </span>
      </div>

      {/* Phase pipeline indicator */}
      <div className="flex gap-0.5">
        {VIDEO_PHASES.slice(0, -1).map((p, i) => (
          <div
            key={p}
            className="h-1 flex-1 rounded-full"
            style={{
              backgroundColor:
                i < phaseIndex
                  ? 'var(--color-green)'
                  : i === phaseIndex
                    ? 'var(--color-gold)'
                    : 'var(--color-border)',
              opacity: i <= phaseIndex ? 0.8 : 0.3,
            }}
            title={PHASE_LABELS[p]}
          />
        ))}
      </div>

      {/* Linked essay */}
      {video.linked_essay_slugs.length > 0 && (
        <span className="text-xs text-ink-faint">
          Linked to{' '}
          <Link
            href={`/essays/${video.linked_essay_slugs[0]}`}
            className="underline hover:text-terracotta"
          >
            essay
          </Link>
        </span>
      )}
    </div>
  );
}

export const metadata: Metadata = {
  title: 'Now',
  description: 'What I am currently researching, reading, building, and listening to.',
};

export default async function NowPage() {
  const data = getNowData();
  if (!data) return null;

  const activeVideos = await fetchActiveVideos();

  const updatedDate = new Date(data.updated);
  const formattedDate = updatedDate.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <>
      <section className="py-8">
        <h1 className="font-title text-3xl md:text-4xl font-bold mb-2 flex items-center gap-3">
          <DrawOnIcon name="note-pencil" size={32} color="var(--color-terracotta)" />
          Now
        </h1>
        <p className="text-ink-secondary mb-2">
          A snapshot of where my attention is right now.
        </p>
        <p className="font-mono text-[11px] uppercase tracking-widest text-ink-faint">
          Updated {formattedDate}
        </p>
      </section>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl">
        {QUADRANTS.map((q) => (
          <RoughBox key={q.field} padding={20} tint="neutral" elevated>
            <span
              className="font-mono block mb-1"
              style={{
                fontSize: 11,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                color: q.color,
              }}
            >
              {q.label}
            </span>
            <span className="font-title text-lg font-semibold text-ink block mb-2">
              {data[q.field]}
            </span>
            {data[`${q.field}_context` as keyof NowData] && (
              <span className="block text-xs text-ink-secondary mt-0.5 leading-relaxed mb-2">
                {data[`${q.field}_context` as keyof NowData]}
              </span>
            )}
            <span className="text-xs text-ink-secondary">
              {q.description}
            </span>
          </RoughBox>
        ))}
      </div>

      {/* Currently Producing: active video projects from Studio API */}
      {activeVideos.length > 0 && (
        <div className="mt-8 max-w-2xl">
          <RoughBox padding={20} tint="neutral">
            <span
              className="font-mono block mb-3"
              style={{
                fontSize: 11,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                color: 'var(--color-green)',
              }}
            >
              Currently Producing
            </span>
            <div className="space-y-4">
              {activeVideos.map((video) => (
                <VideoProductionCard key={video.slug} video={video} />
              ))}
            </div>
          </RoughBox>
        </div>
      )}

      {/* Publication activity scorecard */}
      <div className="mt-8 max-w-2xl">
        <PublicationGraph />
      </div>

      {data.thinking && (
        <div className="mt-8 max-w-2xl">
          <RoughBox padding={20} tint="terracotta">
            <span
              className="font-mono block mb-1"
              style={{
                fontSize: 11,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                color: 'var(--color-terracotta)',
              }}
            >
              Thinking about
            </span>
            <span className="font-title text-base font-semibold text-ink">
              {data.thinking}
            </span>
          </RoughBox>
        </div>
      )}

      <p className="text-sm text-ink-faint mt-8 max-w-2xl">
        Inspired by <a href="https://nownownow.com/about" className="underline hover:text-terracotta">the /now page movement</a>.
        This page is updated manually whenever something shifts.
      </p>

      <nav className="py-4 border-t border-border mt-6">
        <Link
          href="/"
          className="font-mono text-sm hover:text-terracotta-hover"
        >
          &larr; Home
        </Link>
      </nav>
    </>
  );
}
