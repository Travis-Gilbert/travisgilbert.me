'use client';

/**
 * DailyLogPanel: activity detail for a single date.
 *
 * Fetches /daily-logs/{date}/ and displays five conditional
 * sections: objects created, objects updated, edges formed,
 * entities resolved, and a summary block.
 *
 * Handles 404 gracefully (no log for that date = "No activity
 * recorded" rather than a generic error banner).
 */

import { fetchDailyLogByDate, useApiData } from '@/lib/commonplace-api';
import { getObjectTypeIdentity } from '@/lib/commonplace';

interface DailyLogPanelProps {
  date: string; // YYYY-MM-DD
  onOpenObject?: (objectRef: number, title?: string) => void;
}

export default function DailyLogPanel({ date, onOpenObject }: DailyLogPanelProps) {
  const { data: log, loading, error } = useApiData(
    () => fetchDailyLogByDate(date),
    [date],
  );

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="cp-daily-log-panel">
        <div
          className="cp-loading-skeleton"
          style={{ width: '60%', height: 14, borderRadius: 4, marginBottom: 12 }}
        />
        <div
          className="cp-loading-skeleton"
          style={{ width: '90%', height: 12, borderRadius: 4, marginBottom: 8 }}
        />
        <div
          className="cp-loading-skeleton"
          style={{ width: '75%', height: 12, borderRadius: 4 }}
        />
      </div>
    );
  }

  /* ── 404: no log for this date ── */
  if (error?.status === 404) {
    return (
      <div className="cp-daily-log-panel">
        <div className="cp-empty-state" style={{ padding: '24px 0' }}>
          No activity recorded for this date.
          <span className="cp-empty-state-hint">
            Capture or connect objects to see them on the calendar.
          </span>
        </div>
      </div>
    );
  }

  /* ── Other errors ── */
  if (error) {
    return (
      <div className="cp-daily-log-panel">
        <div className="cp-error-banner">
          <p>
            {error.isNetworkError
              ? 'Could not reach CommonPlace API.'
              : `Error: ${error.message}`}
          </p>
        </div>
      </div>
    );
  }

  if (!log) return null;

  const hasCreated = log.objects_created.length > 0;
  const hasUpdated = log.objects_updated.length > 0;
  const hasEdges = log.edges_created.length > 0;
  const hasEntities = log.entities_resolved.length > 0;
  const hasSummary = Boolean(log.summary);

  return (
    <div className="cp-daily-log-panel cp-scrollbar">
      {/* Objects Created */}
      {hasCreated && (
        <div>
          <div className="cp-daily-log-section-title">Objects Created</div>
          {log.objects_created.map((obj) => {
            const typeId = getObjectTypeIdentity(obj.object_type);
            return (
              <button
                key={obj.id}
                type="button"
                className="cp-daily-log-item"
                onClick={() => onOpenObject?.(obj.id, obj.title)}
              >
                <span
                  className="cp-daily-log-type-dot"
                  style={{ backgroundColor: typeId.color }}
                />
                <span className="cp-daily-log-item-title">{obj.title}</span>
                <span className="cp-daily-log-item-type">{typeId.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Objects Updated */}
      {hasUpdated && (
        <div>
          <div className="cp-daily-log-section-title">Objects Updated</div>
          {log.objects_updated.map((upd) => (
            <button
              key={upd.id}
              type="button"
              className="cp-daily-log-item"
              onClick={() => onOpenObject?.(upd.id, upd.title)}
            >
              <span className="cp-daily-log-action-badge">{upd.action}</span>
              <span className="cp-daily-log-item-title">{upd.title}</span>
            </button>
          ))}
        </div>
      )}

      {/* Edges Created */}
      {hasEdges && (
        <div>
          <div className="cp-daily-log-section-title">Connections Made</div>
          {log.edges_created.map((edge) => (
            <div key={edge.id} className="cp-daily-log-edge-item">
              <span className="cp-daily-log-edge-from">{edge.from_title}</span>
              <span className="cp-daily-log-edge-arrow">&rarr;</span>
              <span className="cp-daily-log-edge-to">{edge.to_title}</span>
              {edge.reason && (
                <span className="cp-daily-log-edge-reason">{edge.reason}</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Entities Resolved */}
      {hasEntities && (
        <div>
          <div className="cp-daily-log-section-title">Entities Resolved</div>
          {log.entities_resolved.map((ent, i) => (
            <div key={`${ent.text}-${i}`} className="cp-daily-log-entity-item">
              <span className="cp-daily-log-entity-text">{ent.text}</span>
              <span className="cp-daily-log-entity-type">({ent.entity_type})</span>
              <span className="cp-daily-log-edge-arrow">&rarr;</span>
              <span className="cp-daily-log-entity-resolved">{ent.resolved_to}</span>
            </div>
          ))}
        </div>
      )}

      {/* Summary */}
      {hasSummary && (
        <div>
          <div className="cp-daily-log-section-title">Summary</div>
          <div className="cp-daily-log-summary">{log.summary}</div>
        </div>
      )}

      {/* Completely empty log (log exists but all arrays empty) */}
      {!hasCreated && !hasUpdated && !hasEdges && !hasEntities && !hasSummary && (
        <div className="cp-empty-state" style={{ padding: '24px 0' }}>
          No activity recorded for this date.
          <span className="cp-empty-state-hint">
            Capture or connect objects to see them on the calendar.
          </span>
        </div>
      )}
    </div>
  );
}
