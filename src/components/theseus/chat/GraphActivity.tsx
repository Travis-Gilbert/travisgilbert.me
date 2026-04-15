'use client';

import { useMemo } from 'react';
import { useAmbientGraphSignal } from '@/lib/theseus-ambient';
import type { GraphWeather, Hypothesis } from '@/lib/theseus-types';

type ActivityType = 'cluster' | 'tension' | 'hypothesis' | 'connection';

interface ActivityItem {
  id: string;
  type: ActivityType;
  label: string;
  detail: string;
  time: string;
  query: string;
}

function formatRelative(iso?: string): string {
  if (!iso) return '';
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return '';
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

/**
 * Derive a small list of real graph activity items from the ambient
 * signal (GraphWeather + Hypotheses). Honest by design: if there is no
 * backend data, we render nothing — no placeholders.
 */
function buildActivity(
  weather: GraphWeather | null,
  hypotheses: Hypothesis[],
): ActivityItem[] {
  const items: ActivityItem[] = [];

  // Hypotheses arrive with titles + confidence. Take the strongest few.
  for (const h of hypotheses.slice(0, 3)) {
    const conf = Math.round(h.confidence * 100);
    items.push({
      id: `hyp-${h.id}`,
      type: 'hypothesis',
      label: h.title,
      detail: `${conf}% confidence`,
      time: formatRelative(h.created_at),
      query: h.title,
    });
  }

  if (weather) {
    if (typeof weather.tensions_active === 'number' && weather.tensions_active > 0) {
      items.push({
        id: 'tensions',
        type: 'tension',
        label: `${weather.tensions_active} active tension${weather.tensions_active === 1 ? '' : 's'}`,
        detail: 'claims in conflict',
        time: formatRelative(weather.last_engine_run),
        query: 'What unresolved tensions are active?',
      });
    }

    if (weather.total_clusters > 0) {
      items.push({
        id: 'clusters',
        type: 'cluster',
        label: `${weather.total_clusters} clusters`,
        detail: `health ${weather.health_score.toFixed(2)}`,
        time: formatRelative(weather.last_engine_run),
        query: 'Show me the cluster structure.',
      });
    }

    if (weather.total_edges > 0 && weather.total_objects > 0) {
      const density = (weather.total_edges / weather.total_objects).toFixed(1);
      items.push({
        id: 'connections',
        type: 'connection',
        label: `${weather.total_edges.toLocaleString()} edges connect ${weather.total_objects.toLocaleString()} objects`,
        detail: `density ${density}`,
        time: '',
        query: 'What are my strongest connections right now?',
      });
    }
  }

  return items.slice(0, 4);
}

function prefillQuery(item: ActivityItem) {
  window.dispatchEvent(
    new CustomEvent('theseus:prefill-ask', { detail: { query: item.query } }),
  );
}

export default function GraphActivity() {
  const { weather, hypotheses, loaded } = useAmbientGraphSignal();

  const items = useMemo(
    () => buildActivity(weather, hypotheses),
    [weather, hypotheses],
  );

  if (!loaded || items.length === 0) return null;

  return (
    <div className="graph-activity-wrapper">
      <div className="graph-activity-divider" />
      <div className="graph-activity">
        <h2 className="graph-activity-header">Graph Activity</h2>
        <div className="graph-activity-feed">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              className="graph-activity-item"
              onClick={() => prefillQuery(item)}
            >
              <span className={`graph-activity-dot graph-activity-dot-${item.type}`} aria-hidden="true" />
              <span className="graph-activity-content">
                <span className="graph-activity-label">{item.label}</span>
                <span className="graph-activity-meta">
                  <span className={`graph-activity-type graph-activity-type-${item.type}`}>
                    {item.type}
                  </span>
                  <span className="graph-activity-sep">&middot;</span>
                  <span>{item.detail}</span>
                  {item.time && (
                    <>
                      <span className="graph-activity-sep">&middot;</span>
                      <span>{item.time}</span>
                    </>
                  )}
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
