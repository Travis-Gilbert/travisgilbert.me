'use client';

import { useState, useEffect, useCallback } from 'react';
import type { VideoProject, VideoProjectScene, VideoProjectSession, VideoNextAction } from '@/lib/studio-api';
import { logVideoSession } from '@/lib/studio-api';

/* ─────────────────────────────────────────────────
   Timer display
   ───────────────────────────────────────────────── */

function SessionTimer({ startedAt }: { startedAt: string }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const start = new Date(startedAt).getTime();
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [startedAt]);

  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;

  return (
    <span className="studio-session-timer">
      {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
    </span>
  );
}

/* ─────────────────────────────────────────────────
   Tool options
   ───────────────────────────────────────────────── */

const TOOL_OPTIONS = [
  'Ulysses',
  'Descript',
  'DaVinci Resolve',
  'YouTube',
  'Other',
];

/* ─────────────────────────────────────────────────
   End session form
   ───────────────────────────────────────────────── */

function EndSessionForm({
  video,
  startedAt,
  onSubmit,
  onCancel,
}: {
  video: VideoProject;
  startedAt: string;
  onSubmit: (session: VideoProjectSession) => void;
  onCancel: () => void;
}) {
  const [summary, setSummary] = useState(`Worked on ${video.phaseDisplay || video.phase}`);
  const [nextActionText, setNextActionText] = useState('');
  const [nextTool, setNextTool] = useState(TOOL_OPTIONS[0]);
  const [checkedScenes, setCheckedScenes] = useState<Set<number>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  const toggleScene = useCallback((id: number) => {
    setCheckedScenes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleSubmit = useCallback(async () => {
    setSubmitting(true);
    try {
      const subtasks = video.scenes
        .filter((s) => checkedScenes.has(s.id))
        .map((s) => s.title || `Scene ${s.order}`);

      const result = await logVideoSession(video.slug, {
        phase: video.phase,
        started_at: startedAt,
        ended_at: new Date().toISOString(),
        summary,
        subtasks_completed: subtasks,
        next_action: nextActionText || undefined,
        next_tool: nextTool !== 'Other' ? nextTool : undefined,
      });

      if (result.session) {
        onSubmit(result.session);
      }
    } catch {
      /* Silently fail; user can retry */
    } finally {
      setSubmitting(false);
    }
  }, [video, startedAt, summary, nextActionText, nextTool, checkedScenes, onSubmit]);

  return (
    <div className="studio-session-form">
      <div
        style={{
          fontFamily: 'var(--studio-font-mono)',
          fontSize: '9px',
          fontWeight: 700,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: 'var(--studio-text-3)',
          marginBottom: '10px',
        }}
      >
        End Session
      </div>

      {/* Summary */}
      <label
        style={{
          display: 'block',
          fontFamily: 'var(--studio-font-mono)',
          fontSize: '9px',
          color: 'var(--studio-text-3)',
          marginBottom: '4px',
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
        }}
      >
        Summary
      </label>
      <textarea
        value={summary}
        onChange={(e) => setSummary(e.target.value)}
        rows={2}
      />

      {/* Subtasks (scene checklist) */}
      {video.scenes.length > 0 && (
        <div style={{ margin: '12px 0' }}>
          <label
            style={{
              display: 'block',
              fontFamily: 'var(--studio-font-mono)',
              fontSize: '9px',
              color: 'var(--studio-text-3)',
              marginBottom: '6px',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}
          >
            Scenes Completed
          </label>
          {video.scenes
            .slice()
            .sort((a, b) => a.order - b.order)
            .map((scene) => (
              <label
                key={scene.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '3px 0',
                  fontFamily: 'var(--studio-font-body)',
                  fontSize: '12px',
                  color: 'var(--studio-text-2)',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={checkedScenes.has(scene.id)}
                  onChange={() => toggleScene(scene.id)}
                />
                {scene.title || `Scene ${scene.order}`}
              </label>
            ))}
        </div>
      )}

      {/* Next action */}
      <label
        style={{
          display: 'block',
          fontFamily: 'var(--studio-font-mono)',
          fontSize: '9px',
          color: 'var(--studio-text-3)',
          marginBottom: '4px',
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
        }}
      >
        Next Action
      </label>
      <input
        type="text"
        value={nextActionText}
        onChange={(e) => setNextActionText(e.target.value)}
        placeholder="What should happen next?"
        style={{
          width: '100%',
          padding: '6px 10px',
          borderRadius: '5px',
          border: '1px solid var(--studio-border)',
          backgroundColor: 'var(--studio-bg)',
          color: 'var(--studio-text-1)',
          fontFamily: 'var(--studio-font-body)',
          fontSize: '13px',
          outline: 'none',
          marginBottom: '10px',
        }}
      />

      {/* Next tool */}
      <label
        style={{
          display: 'block',
          fontFamily: 'var(--studio-font-mono)',
          fontSize: '9px',
          color: 'var(--studio-text-3)',
          marginBottom: '4px',
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
        }}
      >
        Next Tool
      </label>
      <select
        value={nextTool}
        onChange={(e) => setNextTool(e.target.value)}
        style={{
          width: '100%',
          padding: '6px 10px',
          borderRadius: '5px',
          border: '1px solid var(--studio-border)',
          backgroundColor: 'var(--studio-bg)',
          color: 'var(--studio-text-1)',
          fontFamily: 'var(--studio-font-body)',
          fontSize: '13px',
          outline: 'none',
          marginBottom: '14px',
        }}
      >
        {TOOL_OPTIONS.map((t) => (
          <option key={t} value={t}>{t}</option>
        ))}
      </select>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={onCancel}
          style={{
            padding: '6px 14px',
            borderRadius: '5px',
            border: '1px solid var(--studio-border)',
            background: 'none',
            color: 'var(--studio-text-3)',
            fontFamily: 'var(--studio-font-mono)',
            fontSize: '10px',
            fontWeight: 600,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          style={{
            padding: '6px 14px',
            borderRadius: '5px',
            border: '1px solid rgba(58,138,154,0.3)',
            backgroundColor: 'rgba(58,138,154,0.1)',
            color: 'var(--studio-teal)',
            fontFamily: 'var(--studio-font-mono)',
            fontSize: '10px',
            fontWeight: 600,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            cursor: submitting ? 'wait' : 'pointer',
            opacity: submitting ? 0.6 : 1,
          }}
        >
          {submitting ? 'Saving...' : 'Save Session'}
        </button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────
   Session Log (past sessions list)
   ───────────────────────────────────────────────── */

function formatSessionDuration(minutes: number): string {
  if (minutes < 1) return '<1m';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

export function VideoSessionLog({
  sessions,
  activeSession,
}: {
  sessions: VideoProjectSession[];
  activeSession?: { startedAt: string; phase: string } | null;
}) {
  const sorted = sessions.slice().sort((a, b) => {
    return new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime();
  });

  return (
    <div style={{ padding: '8px 0' }}>
      {activeSession && (
        <div
          className="studio-session-active"
          style={{ marginBottom: '12px' }}
        >
          <SessionTimer startedAt={activeSession.startedAt} />
          <span
            style={{
              fontFamily: 'var(--studio-font-mono)',
              fontSize: '9px',
              fontWeight: 600,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: 'var(--studio-green)',
            }}
          >
            Recording
          </span>
        </div>
      )}

      {sorted.length === 0 && !activeSession && (
        <div
          style={{
            fontFamily: 'var(--studio-font-body)',
            fontSize: '13px',
            color: 'var(--studio-text-3)',
            padding: '24px 0',
            textAlign: 'center',
          }}
        >
          No sessions logged yet.
        </div>
      )}

      {sorted.map((session) => (
        <div
          key={session.id}
          style={{
            padding: '10px 0',
            borderBottom: '1px solid var(--studio-border)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span
              style={{
                fontFamily: 'var(--studio-font-mono)',
                fontSize: '9px',
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                padding: '2px 6px',
                borderRadius: '3px',
                backgroundColor: 'rgba(90,122,74,0.1)',
                color: 'var(--studio-green)',
                border: '1px solid rgba(90,122,74,0.2)',
              }}
            >
              {session.phase}
            </span>
            <span
              style={{
                fontFamily: 'var(--studio-font-mono)',
                fontSize: '10px',
                color: 'var(--studio-text-3)',
              }}
            >
              {formatSessionDuration(session.durationMinutes)}
            </span>
            <span
              style={{
                fontFamily: 'var(--studio-font-mono)',
                fontSize: '9px',
                color: 'var(--studio-text-3)',
                marginLeft: 'auto',
              }}
            >
              {new Date(session.startedAt).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
              })}
            </span>
          </div>

          {session.summary && (
            <div
              style={{
                fontFamily: 'var(--studio-font-body)',
                fontSize: '12px',
                color: 'var(--studio-text-2)',
                lineHeight: 1.45,
                marginBottom: '4px',
              }}
            >
              {session.summary}
            </div>
          )}

          {session.subtasksCompleted.length > 0 && (
            <div
              style={{
                fontFamily: 'var(--studio-font-mono)',
                fontSize: '9px',
                color: 'var(--studio-text-3)',
                lineHeight: 1.6,
              }}
            >
              {session.subtasksCompleted.map((st, i) => (
                <span key={i} style={{ marginRight: '8px' }}>
                  \u2713 {st}
                </span>
              ))}
            </div>
          )}

          {session.nextAction && (
            <div
              style={{
                fontFamily: 'var(--studio-font-body)',
                fontSize: '11px',
                color: 'var(--studio-text-3)',
                marginTop: '4px',
              }}
            >
              Next: {session.nextAction}
              {session.nextTool ? ` (${session.nextTool})` : ''}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────────
   Session Tracker (main export)
   ───────────────────────────────────────────────── */

type TrackerState = 'inactive' | 'active' | 'ending';

export default function VideoSessionTracker({
  video,
  nextAction,
  onSessionLogged,
  onSessionStart,
  onSessionEnd,
}: {
  video: VideoProject;
  nextAction: VideoNextAction | null;
  onSessionLogged?: (session: VideoProjectSession) => void;
  onSessionStart?: (startedAt: string) => void;
  onSessionEnd?: () => void;
}) {
  const [state, setState] = useState<TrackerState>('inactive');
  const [startedAt, setStartedAt] = useState<string | null>(null);

  const handleStart = useCallback(() => {
    const now = new Date().toISOString();
    setStartedAt(now);
    setState('active');
    onSessionStart?.(now);
  }, [onSessionStart]);

  const handleEndClick = useCallback(() => {
    setState('ending');
  }, []);

  const handleCancelEnd = useCallback(() => {
    setState('active');
  }, []);

  const handleSessionSubmit = useCallback(
    (session: VideoProjectSession) => {
      setState('inactive');
      setStartedAt(null);
      onSessionLogged?.(session);
      onSessionEnd?.();
    },
    [onSessionLogged, onSessionEnd],
  );

  if (state === 'inactive') {
    return (
      <div style={{ padding: '8px 0' }}>
        <button
          type="button"
          onClick={handleStart}
          style={{
            padding: '10px 20px',
            borderRadius: '6px',
            border: '1px solid rgba(180,90,45,0.3)',
            backgroundColor: 'rgba(180,90,45,0.08)',
            color: '#B45A2D',
            fontFamily: 'var(--studio-font-mono)',
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            cursor: 'pointer',
            width: '100%',
            transition: 'all 0.12s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(180,90,45,0.14)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(180,90,45,0.08)';
          }}
        >
          Start Session
        </button>
      </div>
    );
  }

  if (state === 'ending' && startedAt) {
    return (
      <EndSessionForm
        video={video}
        startedAt={startedAt}
        onSubmit={handleSessionSubmit}
        onCancel={handleCancelEnd}
      />
    );
  }

  /* Active session */
  return (
    <div className="studio-session-active">
      <SessionTimer startedAt={startedAt!} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1, minWidth: 0 }}>
        <span
          style={{
            fontFamily: 'var(--studio-font-mono)',
            fontSize: '9px',
            fontWeight: 600,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: 'var(--studio-green)',
          }}
        >
          {video.phaseDisplay || video.phase}
        </span>
        {nextAction && (
          <span
            style={{
              fontFamily: 'var(--studio-font-body)',
              fontSize: '12px',
              color: 'var(--studio-text-2)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {nextAction.nextAction}
          </span>
        )}
        {nextAction?.nextTool && (
          <span
            style={{
              fontFamily: 'var(--studio-font-mono)',
              fontSize: '9px',
              color: 'var(--studio-text-3)',
            }}
          >
            {nextAction.nextTool}
          </span>
        )}
      </div>
      <button
        type="button"
        className="studio-session-end-btn"
        onClick={handleEndClick}
      >
        End Session
      </button>
    </div>
  );
}
