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
      // API not available yet
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

/**
 * LibraryPanel: artifacts + models wrapper for PanelManager.
 * Combines the previous Artifacts and Models pages into one panel.
 */
export default function LibraryPanel() {
  return (
    <div style={{ height: '100%', overflowY: 'auto' }}>
      <div style={{ padding: '40px 40px 24px' }}>
        <h1 style={{
          fontFamily: 'var(--vie-font-title)',
          fontSize: 24,
          fontWeight: 400,
          color: 'var(--vie-text)',
          margin: 0,
        }}>
          Library
        </h1>
        <p style={{
          fontFamily: 'var(--vie-font-body)',
          fontSize: 13,
          color: 'var(--vie-text-dim)',
          margin: '8px 0 0',
        }}>
          Saved maps, models, and system artifacts.
        </p>
      </div>

      <section style={{ marginBottom: 40 }}>
        <SectionHeader title="Maps" />
        <MapShelf />
      </section>

      <section style={{ marginBottom: 40 }}>
        <SectionHeader title="Saved Models" />
        <ModelGrid />
      </section>
    </div>
  );
}
