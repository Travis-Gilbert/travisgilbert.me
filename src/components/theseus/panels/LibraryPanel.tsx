'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ModelGrid } from '@/components/theseus/library/ModelGrid';
import { listMaps } from '@/lib/ask-theseus';
import type { SavedMapListItem } from '@/lib/map-types';
import CaptureModal from '@/components/theseus/capture/CaptureModal';
import MosaicAnalytics from '@/components/theseus/library/MosaicAnalytics';

// Module-level ref for files from global drop (avoids stale closure in event handler)
let globalDropFilesRef: File[] | undefined;

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
  const [captureOpen, setCaptureOpen] = useState(false);

  // Listen for global drop events dispatched by TheseusShell
  useEffect(() => {
    function handler(e: Event) {
      const detail = (e as CustomEvent<{ files?: File[] }>).detail;
      if (detail?.files) {
        // Global drop with pre-loaded files: store them and open modal
        globalDropFilesRef = detail.files;
        setCaptureOpen(true);
      }
    }
    window.addEventListener('theseus:capture-open', handler);
    return () => window.removeEventListener('theseus:capture-open', handler);
  }, []);

  return (
    <div style={{ height: '100%', overflowY: 'auto' }}>
      <div style={{ padding: '40px 40px 24px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
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
        <button
          type="button"
          onClick={() => setCaptureOpen(true)}
          style={{
            padding: '6px 14px',
            borderRadius: 8,
            background: 'transparent',
            border: '1px solid rgba(74,138,150,0.4)',
            color: 'var(--vie-teal-light)',
            fontFamily: 'var(--vie-font-mono)',
            fontSize: 12,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            flexShrink: 0,
            marginTop: 4,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--vie-teal)';
            e.currentTarget.style.color = 'var(--vie-text)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = 'var(--vie-teal-light)';
          }}
        >
          + Add to graph
        </button>
      </div>

      <CaptureModal
        open={captureOpen}
        onOpenChange={(open) => {
          setCaptureOpen(open);
          if (!open) globalDropFilesRef = undefined;
        }}
        initialFiles={globalDropFilesRef}
      />

      <section style={{ marginBottom: 40 }}>
        <SectionHeader title="Maps" />
        <MapShelf />
      </section>

      <section style={{ marginBottom: 40 }}>
        <SectionHeader title="Saved Models" />
        <ModelGrid />
      </section>

      <section style={{ marginBottom: 40 }}>
        <SectionHeader title="Analytics" />
        <MosaicAnalytics />
      </section>
    </div>
  );
}
