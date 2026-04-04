'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { loadMap, rerunMap } from '@/lib/ask-theseus';
import type { SavedMap, MapDiff } from '@/lib/map-types';
import type { TheseusResponse } from '@/lib/theseus-types';
import type { SceneDirective } from '@/lib/theseus-viz/SceneDirective';
import dynamic from 'next/dynamic';
import { truthMapShape, type ShapeResult } from '@/components/theseus/renderers/shapes';

const ParticleField = dynamic(
  () => import('@/components/theseus/renderers/ParticleField'),
  { ssr: false },
);

const PARTICLE_COUNT = 30_000;

export default function MapDetailPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [truthMap, setTruthMap] = useState<SavedMap | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [diff, setDiff] = useState<MapDiff | null>(null);
  const [rerunning, setRerunning] = useState(false);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    loadMap(slug)
      .then(setTruthMap)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [slug]);

  const handleRerun = useCallback(async () => {
    if (!slug) return;
    setRerunning(true);
    try {
      const result = await rerunMap(slug);
      setDiff(result.diff);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRerunning(false);
    }
  }, [slug]);

  // Build a minimal TheseusResponse from the saved epistemic_data
  const fakeResponse = useMemo<TheseusResponse | null>(() => {
    if (!truthMap) return null;
    return {
      query: truthMap.query_text,
      mode: 'full',
      confidence: { evidence: 0.5, tension: 0.5, combined: 0.5 },
      sections: [truthMap.epistemic_data],
      metadata: { duration_ms: 0, objects_searched: 0, engine_version: 'replay' },
    };
  }, [truthMap]);

  // Use saved visual composition for exact replay
  const directive = useMemo<SceneDirective | null>(() => {
    if (!truthMap?.visual_composition?.scene_directive) return null;
    return truthMap.visual_composition.scene_directive;
  }, [truthMap]);

  const shapeResult = useMemo<ShapeResult | null>(() => {
    if (!fakeResponse || !directive) return null;
    return truthMapShape.generate({
      response: fakeResponse,
      directive,
      particleCount: PARTICLE_COUNT,
    });
  }, [fakeResponse, directive]);

  if (loading) {
    return (
      <div style={{ padding: '2rem', color: 'var(--theseus-text-dim, #9a8e82)' }}>
        Loading map...
      </div>
    );
  }

  if (error || !truthMap) {
    return (
      <div style={{ padding: '2rem', color: '#C4503C' }}>
        {error || 'Map not found.'}
      </div>
    );
  }

  const ep = truthMap.epistemic_data;

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Particle visualization */}
      <div style={{ flex: 1, position: 'relative' }}>
        {shapeResult && (
          <ParticleField
            className="theseus-interactive"
            playback={{
              elapsedMs: 10000,
              totalMs: 10000,
              phaseProgress: {
                focal_nodes_appear: 1,
                supporting_nodes_appear: 1,
                edges_draw: 1,
                clusters_coalesce: 1,
                data_builds: 1,
                labels_fade_in: 1,
                crystallize: 1,
              },
              isComplete: true,
            }}
            shapeResult={shapeResult}
            particleCount={PARTICLE_COUNT}
          />
        )}
      </div>

      {/* Epistemic data sidebar */}
      <div style={{
        width: 360,
        overflowY: 'auto',
        padding: '1.5rem',
        borderLeft: '1px solid rgba(255,255,255,0.08)',
        background: 'rgba(0,0,0,0.3)',
      }}>
        <h1 style={{ fontFamily: 'var(--font-title)', fontSize: '1.25rem', color: 'var(--theseus-text, #e8e5e0)', marginBottom: '0.5rem' }}>
          {truthMap.title}
        </h1>

        {truthMap.query_text && (
          <p style={{ fontSize: '0.85rem', color: 'var(--theseus-text-dim, #9a8e82)', marginBottom: '1rem' }}>
            {truthMap.query_text}
          </p>
        )}

        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
          <button
            onClick={handleRerun}
            disabled={rerunning}
            style={{
              padding: '0.4rem 0.8rem',
              fontSize: '0.75rem',
              background: 'rgba(45,95,107,0.3)',
              border: '1px solid rgba(45,95,107,0.5)',
              borderRadius: 4,
              color: 'var(--theseus-text, #e8e5e0)',
              cursor: rerunning ? 'wait' : 'pointer',
            }}
          >
            {rerunning ? 'Re-running...' : 'Re-run'}
          </button>
          <span style={{ fontSize: '0.7rem', color: 'var(--theseus-text-dim, #9a8e82)', alignSelf: 'center' }}>
            {new Date(truthMap.created_at).toLocaleDateString()}
          </span>
        </div>

        {diff && (
          <div style={{ marginBottom: '1.5rem', padding: '0.75rem', background: 'rgba(45,95,107,0.15)', borderRadius: 6, fontSize: '0.8rem' }}>
            <strong style={{ color: 'var(--theseus-text, #e8e5e0)' }}>Changes since last snapshot:</strong>
            <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1rem', color: 'var(--theseus-text-dim, #9a8e82)' }}>
              {diff.new_claims.length > 0 && <li>{diff.new_claims.length} new claims</li>}
              {diff.removed_claims.length > 0 && <li>{diff.removed_claims.length} claims removed</li>}
              {diff.new_tensions.length > 0 && <li>{diff.new_tensions.length} new tensions</li>}
              {diff.resolved_tensions.length > 0 && <li>{diff.resolved_tensions.length} tensions resolved</li>}
              {diff.new_blind_spots.length > 0 && <li>{diff.new_blind_spots.length} new blind spots</li>}
              {diff.resolved_blind_spots.length > 0 && <li>{diff.resolved_blind_spots.length} blind spots resolved</li>}
              {diff.entrenchment_changes.length > 0 && <li>{diff.entrenchment_changes.length} entrenchment shifts</li>}
            </ul>
          </div>
        )}

        {/* Agreement groups */}
        <section style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--theseus-text-dim, #9a8e82)', marginBottom: '0.75rem' }}>
            Agreement Groups ({ep.agreement_groups?.length || 0})
          </h2>
          {ep.agreement_groups?.map((group) => (
            <div key={group.id} style={{ marginBottom: '0.75rem', padding: '0.6rem', background: 'rgba(255,255,255,0.03)', borderRadius: 4 }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--theseus-text, #e8e5e0)', marginBottom: '0.25rem' }}>
                {group.label}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--theseus-text-dim, #9a8e82)' }}>
                {group.claims.length} claims, entrenchment: {(group.mean_entrenchment * 100).toFixed(0)}%
              </div>
            </div>
          ))}
        </section>

        {/* Tension zones */}
        {ep.tension_zones && ep.tension_zones.length > 0 && (
          <section style={{ marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#C4503C', marginBottom: '0.75rem' }}>
              Tensions ({ep.tension_zones.length})
            </h2>
            {ep.tension_zones.map((tz) => (
              <div key={tz.id} style={{ marginBottom: '0.75rem', padding: '0.6rem', background: 'rgba(196,80,60,0.08)', borderRadius: 4, borderLeft: '2px solid rgba(196,80,60,0.4)' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--theseus-text, #e8e5e0)' }}>
                  {tz.title}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--theseus-text-dim, #9a8e82)', marginTop: '0.25rem' }}>
                  Severity: {tz.severity}
                </div>
              </div>
            ))}
          </section>
        )}

        {/* Blind spots */}
        {ep.blind_spots && ep.blind_spots.length > 0 && (
          <section style={{ marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--theseus-text-dim, #9a8e82)', marginBottom: '0.75rem' }}>
              Blind Spots ({ep.blind_spots.length})
            </h2>
            {ep.blind_spots.map((bs) => (
              <div key={bs.id} style={{ marginBottom: '0.5rem', padding: '0.5rem', background: 'rgba(255,255,255,0.02)', borderRadius: 4, borderLeft: '2px dashed rgba(154,142,130,0.3)' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--theseus-text-dim, #9a8e82)' }}>
                  {bs.description}
                </div>
                {bs.suggested_query && (
                  <div style={{ fontSize: '0.7rem', color: 'rgba(45,95,107,0.8)', marginTop: '0.25rem' }}>
                    Suggested: {bs.suggested_query}
                  </div>
                )}
              </div>
            ))}
          </section>
        )}

        {/* Sensitivity */}
        {ep.what_if_sensitivities && ep.what_if_sensitivities.length > 0 && (
          <section>
            <h2 style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--theseus-text-dim, #9a8e82)', marginBottom: '0.75rem' }}>
              Load-bearing Sources
            </h2>
            {ep.what_if_sensitivities.map((s) => (
              <div key={s.object_pk} style={{ fontSize: '0.8rem', color: 'var(--theseus-text-dim, #9a8e82)', marginBottom: '0.35rem' }}>
                {s.label}: {s.would_retract_count} would retract, {s.would_weaken_count} would weaken
              </div>
            ))}
          </section>
        )}
      </div>
    </div>
  );
}
