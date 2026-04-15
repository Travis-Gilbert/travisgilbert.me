'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { useAmbientGraphSignal } from '@/lib/theseus-ambient';
import type { Hypothesis } from '@/lib/theseus-types';

/**
 * AmbientGraphActivity (R1).
 *
 * Faint hypothesis titles drift in from a random viewport edge, pause
 * mid-travel, fade out. Behind them, a thin SVG line forms between two
 * dots every few seconds. All opacity tuned low (0.08-0.14) so the
 * surface reads as "machine at work in the periphery," not as decoration.
 *
 * Real data only: hypothesis titles come straight from getHypotheses().
 * Edge formations use real graph density (from GraphWeather) to modulate
 * cadence: denser graphs show slightly more activity.
 *
 * Mounted inside AskExperience only while the user is in IDLE or THINKING.
 */

const WHISPER_INTERVAL_MS = 18_000;
const WHISPER_DURATION_MS = 14_000;
// Edge cadence: density floor of 0.5 keeps sparse graphs visible.
// At typical density (~0.3) this yields ~10s intervals; at very dense
// graphs (density=1) it drops to ~5s.
const EDGE_BASE_INTERVAL_MS = 5_000;
const EDGE_DURATION_MS = 4_500;
const EDGE_DENSITY_FLOOR = 0.5;
const MAX_WHISPERS = 2;

interface WhisperInstance {
  id: number;
  text: string;
  confidence: number;
  startSide: 'left' | 'right';
  yFraction: number; // 0..1 of viewport height
  startedAt: number;
}

interface EdgeInstance {
  id: number;
  a: { x: number; y: number };
  b: { x: number; y: number };
  startedAt: number;
}

function pickWhisperSource(hypotheses: Hypothesis[]): Hypothesis | null {
  if (hypotheses.length === 0) return null;
  return hypotheses[Math.floor(Math.random() * hypotheses.length)];
}

export default function AmbientGraphActivity({ active }: { active: boolean }) {
  const { hypotheses, weather, loaded } = useAmbientGraphSignal();
  const prefersReducedMotion = usePrefersReducedMotion();

  const [whispers, setWhispers] = useState<WhisperInstance[]>([]);
  const [edges, setEdges] = useState<EdgeInstance[]>([]);
  const nextIdRef = useRef(1);
  const rootRef = useRef<HTMLDivElement>(null);

  // Density factor from graph weather: rougher signal for edge cadence.
  // 0..1 where 1 = very dense graph (lots of edges per object).
  const density = useMemo(() => {
    if (!weather || weather.total_objects === 0) return 0.3;
    const ratio = weather.total_edges / Math.max(weather.total_objects, 1);
    // Typical graph has 2-6 edges per node; normalize to 0..1
    return Math.min(1, Math.max(0.15, ratio / 6));
  }, [weather]);

  // Whisper scheduler: every WHISPER_INTERVAL_MS, spawn one if under cap.
  useEffect(() => {
    if (!active || prefersReducedMotion || !loaded) return;
    if (hypotheses.length === 0) return;

    function spawn() {
      const source = pickWhisperSource(hypotheses);
      if (!source) return;
      const id = nextIdRef.current++;
      const instance: WhisperInstance = {
        id,
        text: source.title,
        confidence: source.confidence,
        startSide: Math.random() > 0.5 ? 'left' : 'right',
        yFraction: 0.18 + Math.random() * 0.58,
        startedAt: Date.now(),
      };
      setWhispers((prev) => {
        const next = [...prev, instance];
        return next.length > MAX_WHISPERS ? next.slice(-MAX_WHISPERS) : next;
      });
      // Auto-remove after duration.
      window.setTimeout(() => {
        setWhispers((prev) => prev.filter((w) => w.id !== id));
      }, WHISPER_DURATION_MS + 200);
    }

    // First spawn after a short delay so the surface isn't busy on mount.
    const initialTimer = window.setTimeout(spawn, 2_400);
    const recurring = window.setInterval(spawn, WHISPER_INTERVAL_MS);
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(recurring);
    };
  }, [active, hypotheses, prefersReducedMotion, loaded]);

  // Edge-formation scheduler: cadence scaled by graph density.
  useEffect(() => {
    if (!active || prefersReducedMotion || !loaded) return;
    const intervalMs = Math.round(EDGE_BASE_INTERVAL_MS / Math.max(density, EDGE_DENSITY_FLOOR));

    function spawn() {
      const root = rootRef.current;
      if (!root) return;
      const w = root.clientWidth;
      const h = root.clientHeight;
      if (w < 200 || h < 200) return;

      // Avoid the bottom dock zone (roughly bottom 160px) and top nav area.
      const marginTop = 80;
      const marginBottom = 180;
      const yRange = Math.max(100, h - marginTop - marginBottom);

      const ax = 60 + Math.random() * (w - 120);
      const ay = marginTop + Math.random() * yRange;
      const angle = Math.random() * Math.PI * 2;
      const len = 80 + Math.random() * 180;
      const bx = Math.max(40, Math.min(w - 40, ax + Math.cos(angle) * len));
      const by = Math.max(marginTop, Math.min(h - marginBottom, ay + Math.sin(angle) * len));

      const id = nextIdRef.current++;
      const instance: EdgeInstance = {
        id,
        a: { x: ax, y: ay },
        b: { x: bx, y: by },
        startedAt: Date.now(),
      };
      setEdges((prev) => [...prev, instance]);
      window.setTimeout(() => {
        setEdges((prev) => prev.filter((e) => e.id !== id));
      }, EDGE_DURATION_MS + 400);
    }

    const initialTimer = window.setTimeout(spawn, 3_800);
    const recurring = window.setInterval(spawn, intervalMs);
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(recurring);
    };
  }, [active, prefersReducedMotion, loaded, density]);

  // Reduced-motion static fallback: show one whisper, no edges, no drift.
  const reducedStaticWhisper = useMemo(() => {
    if (!prefersReducedMotion) return null;
    if (!loaded || hypotheses.length === 0) return null;
    const h = hypotheses[0];
    return h?.title ?? null;
  }, [prefersReducedMotion, loaded, hypotheses]);

  if (!active) return null;

  if (prefersReducedMotion) {
    if (!reducedStaticWhisper) return null;
    return (
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 48px',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--vie-font-mono, ui-monospace, monospace)',
            fontSize: 11,
            letterSpacing: '0.04em',
            color: 'color-mix(in oklab, var(--vie-amber, #c49a4a) 55%, var(--vie-text-dim, #6a645a) 45%)',
            opacity: 0.1,
            textAlign: 'center',
            maxWidth: 520,
          }}
        >
          {reducedStaticWhisper}
        </span>
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
      className="theseus-ambient-activity"
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 1,
        overflow: 'hidden',
      }}
    >
      {/* Edge formations: one SVG layer for all active edges. */}
      <svg
        width="100%"
        height="100%"
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
      >
        {edges.map((edge) => {
          const lineLength = Math.hypot(edge.b.x - edge.a.x, edge.b.y - edge.a.y);
          return (
            <g key={edge.id} className="theseus-ambient-edge">
              <circle
                cx={edge.a.x}
                cy={edge.a.y}
                r={2.2}
                fill="rgba(74,138,150,0.22)"
              />
              <circle
                cx={edge.b.x}
                cy={edge.b.y}
                r={2.2}
                fill="rgba(74,138,150,0.22)"
              />
              <line
                x1={edge.a.x}
                y1={edge.a.y}
                x2={edge.b.x}
                y2={edge.b.y}
                stroke="rgba(74,138,150,0.20)"
                strokeWidth={1}
                strokeDasharray={lineLength}
                style={{
                  // CSS custom property feeds the keyframe's starting
                  // stroke-dashoffset so each line draws over its own length.
                  ['--len' as string]: `${lineLength}`,
                  animation: `vie-edge-draw ${EDGE_DURATION_MS}ms ease-in-out forwards`,
                }}
              />
            </g>
          );
        })}
      </svg>

      {/* Hypothesis whispers: one span per instance, positioned by fraction. */}
      {whispers.map((whisper) => (
        <span
          key={whisper.id}
          className={`theseus-ambient-whisper theseus-ambient-whisper--${whisper.startSide}`}
          style={{
            position: 'absolute',
            top: `${whisper.yFraction * 100}%`,
            [whisper.startSide]: 0,
            fontFamily: 'var(--vie-font-mono, ui-monospace, monospace)',
            fontSize: 11,
            letterSpacing: '0.04em',
            color: 'color-mix(in oklab, var(--vie-amber, #c49a4a) 55%, var(--vie-text-dim, #6a645a) 45%)',
            maxWidth: 320,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            padding: '0 24px',
            animation: `vie-whisper-${whisper.startSide} ${WHISPER_DURATION_MS}ms ease-in-out forwards`,
          }}
        >
          {whisper.text}
        </span>
      ))}
    </div>
  );
}
