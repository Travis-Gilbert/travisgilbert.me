'use client';

/**
 * Theseus UI layout.
 *
 * Dark ground, teal accent, Theseus branding.
 * Shared header with stats strip across all Theseus pages.
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getGraphWeather } from '@/lib/theseus-api';
import type { GraphWeather } from '@/lib/theseus-types';

const T = {
  bg: '#0f1012',
  card: '#1a1b1f',
  text: '#e8e5e0',
  textMuted: '#9a958d',
  textDim: '#5c5851',
  teal: '#2D5F6B',
  tealLight: '#4A8A96',
  amber: '#C49A4A',
  terra: '#C4503C',
  purple: '#7B5EA7',
  border: 'rgba(255,255,255,0.06)',
  mono: "'Courier Prime', monospace",
  body: "'IBM Plex Sans', sans-serif",
  title: "'Vollkorn', serif",
} as const;

function StatsStrip({ weather }: { weather: GraphWeather | null }) {
  if (!weather) return null;
  return (
    <div
      style={{
        display: 'flex',
        gap: 16,
        alignItems: 'center',
        fontFamily: T.mono,
        fontSize: 11,
        color: T.textDim,
        letterSpacing: '0.02em',
      }}
    >
      <span>{weather.total_objects.toLocaleString()} objects</span>
      <span>{weather.total_edges.toLocaleString()} edges</span>
      <span style={{ color: T.tealLight }}>
        IQ {Math.round(weather.iq_score ?? 0)}
      </span>
      {(weather.tensions_active ?? 0) > 0 && (
        <span style={{ color: T.terra }}>
          {weather.tensions_active} tension{weather.tensions_active !== 1 ? 's' : ''}
        </span>
      )}
    </div>
  );
}

export default function TheseusLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [weather, setWeather] = useState<GraphWeather | null>(null);

  useEffect(() => {
    getGraphWeather()
      .then((res) => { if (res.ok) setWeather(res); })
      .catch(() => {});
  }, []);

  return (
    <div
      style={{
        minHeight: '100vh',
        background: T.bg,
        color: T.text,
        fontFamily: T.body,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Vollkorn:ital,wght@0,400;0,600;0,700;1,400&family=IBM+Plex+Sans:wght@300;400;500&family=Courier+Prime:wght@400;700&display=swap');
      `}</style>

      {/* Header */}
      <header
        style={{
          padding: '12px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: `1px solid ${T.border}`,
          background: `${T.bg}ee`,
          backdropFilter: 'blur(8px)',
          position: 'sticky',
          top: 0,
          zIndex: 50,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Link
            href="/theseus"
            style={{
              fontFamily: T.mono,
              fontSize: 13,
              fontWeight: 700,
              color: T.text,
              letterSpacing: '0.06em',
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            THESEUS
            <span
              style={{
                width: 5,
                height: 5,
                borderRadius: '50%',
                background: T.teal,
                display: 'inline-block',
              }}
            />
          </Link>
          <nav
            style={{
              display: 'flex',
              gap: 8,
              fontFamily: T.mono,
              fontSize: 11,
            }}
          >
            <Link
              href="/theseus"
              style={{ color: T.textMuted, textDecoration: 'none' }}
            >
              home
            </Link>
            <Link
              href="/theseus/library"
              style={{ color: T.textMuted, textDecoration: 'none' }}
            >
              library
            </Link>
          </nav>
        </div>

        <StatsStrip weather={weather} />
      </header>

      {/* Main content */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {children}
      </main>
    </div>
  );
}
