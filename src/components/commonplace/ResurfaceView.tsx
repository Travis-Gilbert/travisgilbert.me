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
import type { ApiResurfaceCard } from '@/lib/commonplace';
import { useCommonPlace } from '@/lib/commonplace-context';
import ObjectRenderer from './objects/ObjectRenderer';
import { renderableFromResurfaceCard } from './objectRenderables';
import { useRenderableObjectAction } from './useRenderableObjectAction';

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
  const { openContextMenu } = useCommonPlace();
  const {
    data: resurfaceData,
    loading,
    error,
    refetch,
  } = useApiData(() => fetchResurface({ count: 5 }), []);

  const cards: ApiResurfaceCard[] = resurfaceData?.cards ?? [];
  const handleObjectClick = useRenderableObjectAction(
    onOpenObject
      ? (obj) => onOpenObject(obj.id, obj.display_title ?? obj.title)
      : undefined,
  );

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
          <span className="cp-empty-state-hint">
            No suggestions yet. Capture more objects so the engine can find patterns.
          </span>
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
          const object = renderableFromResurfaceCard(card);
          return (
            <div key={object.id} className="cp-resurface-card">
              <div className="cp-resurface-card-header">
                <span className="cp-resurface-card-time">
                  {relativeTime(card.object.captured_at)}
                </span>
              </div>
              <ObjectRenderer
                object={object}
                variant="module"
                onClick={handleObjectClick}
                onContextMenu={(e, obj) => openContextMenu(e.clientX, e.clientY, obj)}
              />
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
            </div>
          );
        })}
      </div>
    </div>
  );
}
