'use client';

/**
 * ResurfaceView: surfaces forgotten objects for rediscovery.
 *
 * Uses the /resurface/ API endpoint to fetch scored suggestions.
 * Each card shows the object's type, title, score, and an
 * explanation of why it was surfaced. Clicking a card
 * opens the object detail in an adjacent pane.
 *
 * Refresh button triggers a new fetch for fresh suggestions.
 */

import { fetchResurface, useApiData } from '@/lib/commonplace-api';
import { getObjectTypeIdentity } from '@/lib/commonplace';
import type { ApiResurfaceCard } from '@/lib/commonplace';

interface ResurfaceViewProps {
  onOpenObject?: (objectRef: number, title?: string) => void;
}

/** Format a relative time string from an ISO date */
function relativeTime(isoDate: string): string {
  const now = Date.now();
  const then = new Date(isoDate).getTime();
  const diffMs = now - then;

  const days = Math.floor(diffMs / 86400000);
  if (days < 1) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  if (days < 365) return `${Math.floor(days / 30)} months ago`;
  return `${Math.floor(days / 365)}y ago`;
}

export default function ResurfaceView({ onOpenObject }: ResurfaceViewProps) {
  const {
    data: resurfaceData,
    loading,
    error,
    refetch,
  } = useApiData(() => fetchResurface({ count: 5 }), []);

  const cards: ApiResurfaceCard[] = resurfaceData?.cards ?? [];

  /* ── Loading state ── */
  if (loading) {
    return (
      <div className="cp-resurface-view cp-scrollbar">
        <div className="cp-resurface-header">
          <h2 className="cp-resurface-title">Resurface</h2>
        </div>
        <div style={{ padding: '0 16px' }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="cp-loading-skeleton"
              style={{ width: '100%', height: 100, borderRadius: 8, marginBottom: 12 }}
            />
          ))}
        </div>
      </div>
    );
  }

  /* ── Error state ── */
  if (error) {
    return (
      <div className="cp-resurface-view">
        <div className="cp-resurface-header">
          <h2 className="cp-resurface-title">Resurface</h2>
        </div>
        <div className="cp-error-banner" style={{ margin: 16 }}>
          <p>
            {error.isNetworkError
              ? 'Could not reach CommonPlace API.'
              : `Error: ${error.message}`}
          </p>
          <button type="button" onClick={refetch}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  /* ── Empty state ── */
  if (cards.length === 0) {
    return (
      <div className="cp-resurface-view">
        <div className="cp-resurface-header">
          <h2 className="cp-resurface-title">Resurface</h2>
        </div>
        <div className="cp-empty-state">
          No suggestions yet. Capture more objects so the system can find connections.
        </div>
      </div>
    );
  }

  return (
    <div className="cp-resurface-view cp-scrollbar">
      <div className="cp-resurface-header">
        <h2 className="cp-resurface-title">Resurface</h2>
        <button
          type="button"
          className="cp-resurface-refresh"
          onClick={refetch}
          title="Refresh suggestions"
        >
          Refresh
        </button>
      </div>

      <p className="cp-resurface-subtitle">
        Objects you may have forgotten. Click to revisit.
      </p>

      <div className="cp-resurface-list">
        {cards.map((card) => {
          const obj = card.object;
          const typeSlug = obj.object_type_data?.slug ?? '';
          const typeId = getObjectTypeIdentity(typeSlug);
          return (
            <button
              key={obj.id}
              type="button"
              className="cp-resurface-card"
              onClick={() => onOpenObject?.(obj.id, obj.title)}
            >
              <div className="cp-resurface-card-header">
                <span
                  className="cp-resurface-type-dot"
                  style={{ backgroundColor: typeId.color }}
                />
                <span className="cp-resurface-card-type">
                  {typeId.label}
                </span>
                <span className="cp-resurface-card-time">
                  {relativeTime(obj.captured_at)}
                </span>
              </div>
              <h3 className="cp-resurface-card-title">{obj.display_title}</h3>
              <p className="cp-resurface-card-signal">{card.signal_label}</p>
              {card.explanation && (
                <p className="cp-resurface-card-why">{card.explanation}</p>
              )}
              <div className="cp-resurface-score">
                <span
                  className="cp-resurface-score-bar"
                  style={{ width: `${Math.round(card.score * 100)}%` }}
                />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
