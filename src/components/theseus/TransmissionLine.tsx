'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { useAmbientGraphSignal } from '@/lib/theseus-ambient';
import type { GraphWeather, Hypothesis } from '@/lib/theseus-types';

/**
 * TransmissionLine (R0).
 *
 * Bottom-edge strip that rotates through real backend signals once every
 * ~8 seconds. The "eavesdropping on the machine" vocabulary: short mono
 * lines in dim text, crossfaded, all derived from actual GraphWeather or
 * Hypothesis data. Never fabricated. If a signal is missing we skip it.
 *
 * Mounted once by TheseusShell so every panel sees it.
 */

const ROTATE_MS = 8_000;
const CROSSFADE_MS = 420;

interface Transmission {
  id: string;
  text: string;
}

function formatRelative(iso?: string): string | null {
  if (!iso) return null;
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return null;
  const delta = Date.now() - then;
  if (delta < 0) return 'just now';
  const minutes = Math.floor(delta / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function buildTransmissions(
  weather: GraphWeather | null,
  hypotheses: Hypothesis[],
): Transmission[] {
  const lines: Transmission[] = [];
  if (!weather) return lines;

  // Corpus size — the steady background truth.
  if (weather.total_objects > 0) {
    lines.push({
      id: 'corpus',
      text: `corpus · ${weather.total_objects.toLocaleString()} objects · ${weather.total_edges.toLocaleString()} edges`,
    });
  }

  // Cluster health — reveals structure.
  if (weather.total_clusters > 0 && typeof weather.health_score === 'number') {
    lines.push({
      id: 'clusters',
      text: `${weather.total_clusters} clusters · health ${weather.health_score.toFixed(2)}`,
    });
  }

  // Recent activity — raw backend copy if it reads as a transmission.
  if (weather.recent_activity && weather.recent_activity.trim().length > 0) {
    lines.push({
      id: 'activity',
      text: weather.recent_activity.toLowerCase(),
    });
  }

  // Last engine run.
  const lastRun = formatRelative(weather.last_engine_run);
  if (lastRun) {
    lines.push({
      id: 'engine',
      text: `last engine run · ${lastRun}`,
    });
  }

  // Active tensions.
  if (typeof weather.tensions_active === 'number' && weather.tensions_active > 0) {
    lines.push({
      id: 'tensions',
      text: `${weather.tensions_active} tension${weather.tensions_active === 1 ? '' : 's'} active`,
    });
  }

  // Top hypothesis — we show the title unmodified so the user really is
  // reading what the machine generated, not a paraphrase.
  const topHypothesis = hypotheses.find((h) => h.confidence >= 0.4) ?? hypotheses[0];
  if (topHypothesis) {
    const conf = Math.round(topHypothesis.confidence * 100);
    lines.push({
      id: `hyp-${topHypothesis.id}`,
      text: `hypothesis · ${conf}% · ${topHypothesis.title}`,
    });
  }

  // IQ score if present.
  if (typeof weather.iq_score === 'number') {
    lines.push({
      id: 'iq',
      text: `iq ${weather.iq_score.toFixed(1)}`,
    });
  }

  return lines;
}

export default function TransmissionLine() {
  const { weather, hypotheses, loaded } = useAmbientGraphSignal();
  const prefersReducedMotion = usePrefersReducedMotion();

  const transmissions = useMemo(
    () => buildTransmissions(weather, hypotheses),
    [weather, hypotheses],
  );

  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  const lastLenRef = useRef(transmissions.length);

  // Reset index when the transmission set changes size so we don't land
  // on a stale slot past the end of the new array.
  useEffect(() => {
    if (transmissions.length !== lastLenRef.current) {
      lastLenRef.current = transmissions.length;
      if (index >= transmissions.length) setIndex(0);
    }
  }, [transmissions.length, index]);

  useEffect(() => {
    if (transmissions.length <= 1) return;
    const rotate = window.setInterval(() => {
      setVisible(false);
      window.setTimeout(() => {
        setIndex((i) => (i + 1) % transmissions.length);
        setVisible(true);
      }, CROSSFADE_MS);
    }, ROTATE_MS);
    return () => window.clearInterval(rotate);
  }, [transmissions.length]);

  if (!loaded || transmissions.length === 0) return null;

  const current = transmissions[index];
  if (!current) return null;

  return (
    <div
      className="theseus-transmission-line"
      aria-live="off"
      aria-hidden="true"
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        height: 22,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
        zIndex: 5,
        paddingBottom: 'env(safe-area-inset-bottom, 0)',
        background:
          'linear-gradient(to top, rgba(15,16,18,0.55) 0%, rgba(15,16,18,0) 100%)',
      }}
    >
      <span
        style={{
          fontFamily: 'var(--vie-font-mono, ui-monospace, monospace)',
          fontSize: 10.5,
          letterSpacing: '0.08em',
          textTransform: 'lowercase',
          color: 'var(--vie-text-dim, rgba(220,214,200,0.42))',
          opacity: prefersReducedMotion ? 1 : visible ? 1 : 0,
          transition: prefersReducedMotion
            ? 'none'
            : `opacity ${CROSSFADE_MS}ms ease`,
          maxWidth: 'min(560px, calc(100vw - 80px))',
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          textOverflow: 'ellipsis',
        }}
      >
        {current.text}
      </span>
    </div>
  );
}
