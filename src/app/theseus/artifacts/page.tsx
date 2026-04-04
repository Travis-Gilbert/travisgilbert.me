'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ModelGrid } from '@/components/theseus/library/ModelGrid';
import { listMaps } from '@/lib/ask-theseus';
import type { SavedMapListItem } from '@/lib/map-types';

function originLabel(origin: string): string {
  switch (origin) {
    case 'ask': return 'Ask';
    case 'microscope': return 'Microscope';
    case 'rerun': return 'Re-run';
    default: return origin;
  }
}

function MapShelf() {
  const [maps, setMaps] = useState<SavedMapListItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMaps = useCallback(async () => {
    try {
      const data = await listMaps({ page: 1 });
      setMaps(data.results);
    } catch {
      // API not available yet; show empty state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchMaps(); }, [fetchMaps]);

  if (loading) return null;

  if (maps.length === 0) {
    return (
      <p style={{
        color: 'var(--vie-text-dim)',
        fontFamily: 'var(--vie-font-body)',
        fontSize: 13,
        padding: '0 40px',
      }}>
        No maps saved yet. Ask Theseus a question and save the map, or use the microscope on a cluster.
      </p>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '0 40px' }}>
      {maps.map((tm) => (
        <Link
          key={tm.slug}
          href={`/theseus/truth-maps/${tm.slug}`}
          style={{
            display: 'block',
            padding: '12px 16px',
            borderRadius: 8,
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
            textDecoration: 'none',
            transition: 'background 150ms ease',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
            <span style={{ fontFamily: 'var(--vie-font-body)', fontSize: 14, color: 'var(--vie-text)' }}>
              {tm.title}
            </span>
            <span style={{ fontSize: 10, fontFamily: 'var(--vie-font-mono)', color: 'var(--vie-text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {originLabel(tm.origin)}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 16, fontSize: 11, fontFamily: 'var(--vie-font-mono)', color: 'var(--vie-text-dim)' }}>
            <span>{tm.claim_count} claims</span>
            <span>{tm.tension_count} tensions</span>
            <span>{tm.blind_spot_count} blind spots</span>
            <span>{new Date(tm.created_at).toLocaleDateString()}</span>
          </div>
        </Link>
      ))}
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <h2 style={{
      fontFamily: 'var(--vie-font-mono)',
      fontSize: 11,
      fontWeight: 400,
      letterSpacing: '0.1em',
      textTransform: 'uppercase',
      color: 'var(--vie-text-dim)',
      margin: '0 0 16px',
      padding: '0 40px',
    }}>
      {title}
    </h2>
  );
}

export default function ArtifactsPage() {
  return (
    <div style={{ height: '100%', overflowY: 'auto' }}>
      <div style={{ padding: '40px 40px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <svg width="22" height="22" viewBox="0 0 24 24" strokeWidth="1.5" fill="none" style={{ color: '#b45a2d' }} aria-hidden="true">
            <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M5 6C5.55228 6 6 5.55228 6 5C6 4.44772 5.55228 4 5 4C4.44772 4 4 4.44772 4 5C4 5.55228 4.44772 6 5 6Z" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M5 10.5V9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M5 15V13.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M5 20C5.55228 20 6 19.5523 6 19C6 18.4477 5.55228 18 5 18C4.44772 18 4 18.4477 4 19C4 19.5523 4.44772 20 5 20Z" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M19 20C19.5523 20 20 19.5523 20 19C20 18.4477 19.5523 18 19 18C18.4477 18 18 18.4477 18 19C18 19.5523 18.4477 20 19 20Z" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M10.5 19H9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M15 19H13.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <h1 style={{
            fontFamily: 'var(--vie-font-title)',
            fontSize: 24,
            fontWeight: 400,
            color: 'var(--vie-text)',
            margin: 0,
          }}>
            Artifacts
          </h1>
        </div>
        <p style={{
          fontFamily: 'var(--vie-font-body)',
          fontSize: 13,
          color: 'var(--vie-text-dim)',
          margin: '8px 0 0',
        }}>
          Saved models, maps, and system-produced outputs.
        </p>
      </div>

      {/* Maps shelf */}
      <section style={{ marginBottom: 40 }}>
        <SectionHeader title="Maps" />
        <MapShelf />
      </section>

      {/* Saved Models shelf */}
      <section style={{ marginBottom: 40 }}>
        <SectionHeader title="Saved Models" />
        <ModelGrid />
      </section>
    </div>
  );
}
