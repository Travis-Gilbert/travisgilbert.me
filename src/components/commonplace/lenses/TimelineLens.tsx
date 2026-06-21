'use client';

/**
 * Timeline lens — one scoped 2D track fusing two time axes (P2 / FR-030..032,
 * SC-030). No Timeline3D* suite.
 *
 *   - "Your record" (transaction-time): when you captured / touched this object
 *     — from the object's bi-temporal record (captured_at + recent_nodes).
 *   - "World history" (valid-time): events the engine knows about the entity.
 *     There is no browser-reachable entity-history endpoint yet, so this axis
 *     states so honestly (seam); a sparse personal history still renders as one
 *     coherent track (SC-030).
 *
 * Below the track, a related-in-time strip salvages the ScopedTimelinePanel
 * card pattern (object cards via ObjectRenderer) seeded by the object.
 */

import { useState, useEffect } from 'react';
import { fetchObjectDetail } from '@/lib/commonplace-api';
import { askObject, provenanceToNeighbors, type LensNeighbor } from './lens-data';
import { getObjectTypeIdentity } from '@/lib/commonplace';
import ObjectRenderer from '../objects/ObjectRenderer';
import { useApplyLens } from './use-apply-lens';
import type { LensViewProps } from './lens-types';

interface TrackEvent { label: string; dateMs: number; kind: string }

const NODE_LABEL: Record<string, string> = {
  creation: 'Created', update: 'Updated', connection: 'Connected', enrichment: 'Enriched', retrospective: 'Reflected',
};

function fmt(ms: number): string {
  return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function TimelineLens({ ctx }: LensViewProps) {
  const [personal, setPersonal] = useState<TrackEvent[]>([]);
  const [related, setRelated] = useState<LensNeighbor[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const applyLens = useApplyLens();

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    Promise.allSettled([fetchObjectDetail(ctx.objectSlug), askObject(ctx.objectTitle, undefined, 10)])
      .then(([detailRes, askRes]) => {
        if (cancelled) return;
        const events: TrackEvent[] = [];
        if (detailRes.status === 'fulfilled') {
          const d = detailRes.value;
          if (d.captured_at) events.push({ label: 'Captured', dateMs: Date.parse(d.captured_at), kind: 'creation' });
          for (const node of d.recent_nodes ?? []) {
            const ms = Date.parse(node.occurred_at);
            if (Number.isFinite(ms)) events.push({ label: NODE_LABEL[node.node_type] ?? node.node_type, dateMs: ms, kind: node.node_type });
          }
        }
        events.sort((a, b) => a.dateMs - b.dateMs);
        setPersonal(events);
        if (askRes.status === 'fulfilled') {
          const n = provenanceToNeighbors(askRes.value.provenance, ctx.objectSlug);
          n.sort((a, b) => Date.parse(b.object.captured_at ?? '') - Date.parse(a.object.captured_at ?? ''));
          setRelated(n);
        }
        setStatus('ready');
      })
      .catch(() => { if (!cancelled) setStatus('error'); });
    return () => { cancelled = true; };
  }, [ctx.objectSlug, ctx.objectTitle]);

  const valid = personal.filter((e) => Number.isFinite(e.dateMs));
  const min = valid.length ? Math.min(...valid.map((e) => e.dateMs)) : 0;
  const max = valid.length ? Math.max(...valid.map((e) => e.dateMs)) : 1;
  const span = Math.max(1, max - min);
  const xOf = (ms: number) => (valid.length <= 1 ? 50 : ((ms - min) / span) * 92 + 4);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }} className="cp-scrollbar">
      <div style={{ padding: 14 }}>
        {/* ── 2D track ── */}
        <Lane label="Your record" color="var(--cp-text)">
          {status === 'loading' && <LaneNote>reading provenance…</LaneNote>}
          {status !== 'loading' && valid.length === 0 && <LaneNote>No recorded provenance yet.</LaneNote>}
          {valid.map((e, i) => (
            <Marker key={i} leftPct={xOf(e.dateMs)} color={getObjectTypeIdentity(ctx.objectType).color} label={e.label} sub={fmt(e.dateMs)} />
          ))}
        </Lane>

        <Lane label="World history" color="var(--cp-text-muted)">
          <LaneNote>
            Entity world-history is not wired to the browser yet (seam: an entity-history query to the engine). Your record above is the live axis.
          </LaneNote>
        </Lane>
      </div>

      {/* ── Related in time (salvaged ScopedTimelinePanel card pattern) ── */}
      <div style={{ borderTop: '1px solid var(--cp-border-faint)', padding: '10px 14px' }}>
        <div style={{ fontFamily: 'var(--cp-font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--cp-text-muted)', marginBottom: 8 }}>
          Related, recent first
        </div>
        {status === 'ready' && related.length === 0 && <LaneNote>No related items.</LaneNote>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {related.map((n) => (
            <div key={n.object.slug} style={{ display: 'grid', gridTemplateColumns: '92px minmax(0,1fr)', gap: 10, alignItems: 'start' }}>
              <div style={{ fontFamily: 'var(--cp-font-mono)', fontSize: 10, color: 'var(--cp-text-muted)', paddingTop: 8 }}>
                {n.object.captured_at ? fmt(Date.parse(n.object.captured_at)) : '—'}
              </div>
              <ObjectRenderer
                object={n.object}
                variant="timeline"
                onClick={(obj) => applyLens('timeline', { objectRef: obj.id, objectSlug: obj.slug, objectType: obj.object_type_slug, objectTitle: obj.display_title ?? obj.title })}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Lane({ label, color, children }: { label: string; color: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontFamily: 'var(--cp-font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color, marginBottom: 6 }}>{label}</div>
      <div style={{ position: 'relative', height: 48, borderLeft: '1px solid var(--cp-border-faint)', borderBottom: '1px solid var(--cp-border-faint)' }}>
        {children}
      </div>
    </div>
  );
}

function Marker({ leftPct, color, label, sub }: { leftPct: number; color: string; label: string; sub: string }) {
  return (
    <div style={{ position: 'absolute', left: `${leftPct}%`, top: 0, transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }} title={`${label} · ${sub}`}>
      <span style={{ width: 9, height: 9, borderRadius: '50%', background: color, marginTop: 4, boxShadow: '0 0 0 3px var(--cp-surface, #fff)' }} />
      <span style={{ fontFamily: 'var(--cp-font-body)', fontSize: 10, color: 'var(--cp-text)', whiteSpace: 'nowrap' }}>{label}</span>
      <span style={{ fontFamily: 'var(--cp-font-mono)', fontSize: 8, color: 'var(--cp-text-muted)', whiteSpace: 'nowrap' }}>{sub}</span>
    </div>
  );
}

function LaneNote({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: '8px 10px', fontFamily: 'var(--cp-font-body)', fontSize: 11, fontStyle: 'italic', color: 'var(--cp-text-muted)' }}>{children}</div>;
}
