'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useLayout } from '@/lib/providers/layout-provider';
import { apiFetch } from '@/lib/commonplace-api';
import { fetchGraphWeather } from '@/lib/ask-theseus';

interface AnalyzeCardData {
  title: string;
  detail: string;
}

interface ScreenAnalysis {
  onScreen: AnalyzeCardData[];
  patterns: AnalyzeCardData[];
  actions: AnalyzeCardData[];
}

interface HomeActivityItem {
  text: string;
  time: string;
  type: string;
}

interface HomeThreadItem {
  title: string;
  object_type: string;
}

interface HomePayload {
  activity: HomeActivityItem[];
  threads: HomeThreadItem[];
  pending_reviews: number;
}

export default function EngineAnalyzeTab() {
  const { activeScreen } = useLayout();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [weatherHeadline, setWeatherHeadline] = useState<string>('');
  const [weatherDetail, setWeatherDetail] = useState<string>('');
  const [homeData, setHomeData] = useState<HomePayload | null>(null);

  useEffect(() => {
    let mounted = true;

    Promise.all([
      fetchGraphWeather(),
      apiFetch<HomePayload>('/home/'),
    ])
      .then(([weather, home]) => {
        if (!mounted) return;
        setWeatherHeadline(weather.headline || '');
        setWeatherDetail(weather.detail || '');
        setHomeData(home);
      })
      .catch(() => {
        if (!mounted) return;
        setError('Live analysis is unavailable. Index API could not be reached.');
        setHomeData(null);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const screenLabel = activeScreen
    ? activeScreen.charAt(0).toUpperCase() + activeScreen.slice(1).replace(/-/g, ' ')
    : 'Current Workspace';

  const sections = useMemo<ScreenAnalysis | null>(() => {
    if (!homeData) return null;

    const onScreen: AnalyzeCardData[] = [
      {
        title: weatherHeadline || 'Live graph status',
        detail: weatherDetail || 'Live graph weather loaded from Index API.',
      },
    ];

    const patterns = homeData.activity.slice(0, 2).map((item) => ({
      title: `${item.type} · ${item.time}`,
      detail: item.text,
    }));
    if (patterns.length === 0) {
      patterns.push({
        title: 'No notable patterns yet',
        detail: 'Capture more objects to surface live pattern analysis.',
      });
    }

    const actions: AnalyzeCardData[] = [];
    if (homeData.pending_reviews > 0) {
      actions.push({
        title: 'Review pending candidates',
        detail: `${homeData.pending_reviews} connection candidates are waiting for feedback.`,
      });
    }
    const firstThread = homeData.threads[0];
    if (firstThread) {
      actions.push({
        title: `Follow active ${firstThread.object_type} thread`,
        detail: firstThread.title,
      });
    }
    if (actions.length === 0) {
      actions.push({
        title: 'No immediate actions',
        detail: 'Live data is connected, but there are no pending review actions right now.',
      });
    }

    return { onScreen, patterns, actions };
  }, [homeData, weatherHeadline, weatherDetail]);

  if (loading) {
    return (
      <div
        style={{
          fontFamily: 'var(--font-code)',
          fontSize: 12,
          color: '#7A756E',
          padding: '14px 6px',
          lineHeight: 1.65,
        }}
      >
        Loading live engine analysis...
      </div>
    );
  }

  if (error || !sections) {
    return (
      <div
        style={{
          fontFamily: 'var(--font-code)',
          fontSize: 12,
          color: '#CC6644',
          padding: '14px 6px',
          lineHeight: 1.65,
        }}
      >
        {error || 'Live analysis unavailable.'}
      </div>
    );
  }

  return (
    <div
      style={{
        flex: 1,
        overflowY: 'auto',
        padding: '14px 18px',
        fontFamily: 'var(--font-code)',
        fontSize: 12,
        color: '#C0BDB5',
        lineHeight: 1.6,
      }}
    >
      <AnalyzeSection
        label={`Currently on screen: ${screenLabel}`}
        delay={0}
      >
        {sections.onScreen.map((card, i) => (
          <AnalyzeCard key={i} title={card.title} detail={card.detail} />
        ))}
      </AnalyzeSection>

      <AnalyzeSection label="Notable patterns" delay={1}>
        {sections.patterns.map((card, i) => (
          <AnalyzeCard key={i} title={card.title} detail={card.detail} />
        ))}
      </AnalyzeSection>

      <AnalyzeSection label="Suggested actions" delay={2}>
        {sections.actions.map((card, i) => (
          <AnalyzeCard key={i} title={card.title} detail={card.detail} />
        ))}
      </AnalyzeSection>

      <style>{`
        @keyframes analyzeSlideUp {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .analyze-section-anim { animation: none !important; opacity: 1 !important; transform: none !important; }
        }
      `}</style>
    </div>
  );
}

function AnalyzeSection({
  label,
  delay,
  children,
}: {
  label: string;
  delay: number;
  children: ReactNode;
}) {
  return (
    <div
      className="analyze-section-anim"
      style={{
        marginBottom: 16,
        animation: `analyzeSlideUp 0.35s ease ${delay * 0.12}s both`,
      }}
    >
      <div
        style={{
          fontFamily: 'var(--font-code)',
          fontSize: 9,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: '#3A7A88',
          marginBottom: 6,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <span
          style={{
            width: 5,
            height: 5,
            borderRadius: '50%',
            background: '#3A7A88',
          }}
        />
        {label}
      </div>
      {children}
    </div>
  );
}

function AnalyzeCard({ title, detail }: { title: string; detail: string }) {
  return (
    <div
      style={{
        background: '#1E2028',
        border: '1px solid rgba(244,243,240,0.05)',
        borderRadius: 6,
        padding: '10px 14px',
        marginBottom: 6,
      }}
    >
      <div
        style={{
          fontFamily: 'var(--font-code)',
          fontSize: 11,
          fontWeight: 500,
          color: '#F4F3F0',
          marginBottom: 3,
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontFamily: 'var(--font-code)',
          fontSize: 10,
          color: '#7A756E',
          lineHeight: 1.5,
        }}
      >
        {detail}
      </div>
    </div>
  );
}
