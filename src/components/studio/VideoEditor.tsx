'use client';

import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { VIDEO_PHASES, getVideoPhase } from '@/lib/studio';
import type { StageDefinition } from '@/lib/studio';
import type { VideoProject, VideoProjectScene, VideoProjectSession, VideoNextAction } from '@/lib/studio-api';
import { fetchVideoNextAction } from '@/lib/studio-api';
import VideoSessionTracker, { VideoSessionLog } from './VideoSessionTracker';

const VideoScriptEditor = lazy(() => import('./VideoScriptEditor'));
const EvidenceBoard = lazy(() => import('./EvidenceBoard'));

type VideoTab = 'overview' | 'script' | 'evidence' | 'details' | 'sessions';

const VIDEO_TABS: Array<{ key: VideoTab; label: string }> = [
  { key: 'overview', label: 'Overview' },
  { key: 'script', label: 'Script' },
  { key: 'evidence', label: 'Evidence' },
  { key: 'details', label: 'Details' },
  { key: 'sessions', label: 'Sessions' },
];

/* ─────────────────────────────────────────────────
   Scene type display config
   ───────────────────────────────────────────────── */

const SCENE_TYPE_LABELS: Record<string, string> = {
  vo: 'VO',
  on_camera: 'On-Camera',
  broll: 'B-Roll',
  graphic: 'Graphic',
  mixed: 'Mixed',
};

/* ─────────────────────────────────────────────────
   Phase dot labels for per-scene progress
   ───────────────────────────────────────────────── */

const SCENE_PHASE_KEYS: Array<{
  key: keyof VideoProjectScene;
  label: string;
  activeAtPhaseOrder: number;
}> = [
  { key: 'scriptLocked', label: 'Script', activeAtPhaseOrder: 1 },
  { key: 'voRecorded', label: 'VO', activeAtPhaseOrder: 2 },
  { key: 'filmed', label: 'Filmed', activeAtPhaseOrder: 3 },
  { key: 'assembled', label: 'Assembled', activeAtPhaseOrder: 4 },
  { key: 'polished', label: 'Polished', activeAtPhaseOrder: 5 },
];

/* ─────────────────────────────────────────────────
   Helpers
   ───────────────────────────────────────────────── */

function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function truncateLines(text: string, maxLines: number): string {
  const lines = text.split('\n').slice(0, maxLines);
  return lines.join('\n');
}

/* ─────────────────────────────────────────────────
   Phase Pipeline
   ───────────────────────────────────────────────── */

function VideoPhasePipeline({
  currentPhase,
  lockedThrough,
}: {
  currentPhase: string;
  lockedThrough: string;
}) {
  const current = getVideoPhase(currentPhase);
  const locked = getVideoPhase(lockedThrough);
  const lockedOrder = locked.order >= 0 ? locked.order : -1;

  return (
    <div className="studio-editor-column" style={{ padding: '12px 0 8px' }}>
      <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexWrap: 'wrap' }}>
        {VIDEO_PHASES.map((phase) => {
          const isActive = phase.slug === current.slug;
          const isLocked = phase.order <= lockedOrder && !isActive;
          const isFuture = phase.order > current.order;

          return (
            <div
              key={phase.slug}
              className={isLocked ? 'studio-phase-locked' : undefined}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: isActive ? '4px 10px' : '4px 6px',
                borderRadius: '6px',
                border: isActive
                  ? `1px solid ${phase.color}40`
                  : '1px solid transparent',
                backgroundColor: isActive
                  ? `${phase.color}12`
                  : undefined,
                opacity: isFuture && !isActive ? 0.45 : undefined,
                transition: 'all 0.15s ease',
              }}
            >
              <div
                style={{
                  width: isActive ? 8 : 6,
                  height: isActive ? 8 : 6,
                  borderRadius: '50%',
                  backgroundColor: phase.color,
                  boxShadow: isActive ? `0 0 6px ${phase.color}60` : undefined,
                  transition: 'all 0.15s ease',
                }}
              />
              {isActive && (
                <span
                  style={{
                    fontFamily: 'var(--studio-font-mono)',
                    fontSize: '9px',
                    fontWeight: 700,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: phase.color,
                  }}
                >
                  {phase.label}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────
   Next Action Card
   ───────────────────────────────────────────────── */

function NextActionCard({ action }: { action: VideoNextAction }) {
  return (
    <div className="studio-next-action">
      <div className="studio-next-action-label">
        {action.phaseName} {action.progress ? `\u00B7 ${action.progress}` : ''}
      </div>
      <div className="studio-next-action-text">
        {action.nextAction}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
        {action.nextTool && (
          <span className="studio-next-action-tool">{action.nextTool}</span>
        )}
        {action.estimatedMinutes > 0 && (
          <span
            style={{
              fontFamily: 'var(--studio-font-mono)',
              fontSize: '9px',
              color: 'var(--studio-text-3)',
            }}
          >
            ~{action.estimatedMinutes}m
          </span>
        )}
      </div>
      {action.doneWhen && (
        <div className="studio-next-action-done-when">
          Done when: {action.doneWhen}
        </div>
      )}
      {action.context.length > 0 && (
        <ul
          style={{
            margin: '8px 0 0',
            padding: '0 0 0 16px',
            fontFamily: 'var(--studio-font-body)',
            fontSize: '12px',
            color: 'var(--studio-text-2)',
            lineHeight: 1.5,
          }}
        >
          {action.context.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────
   Scene Card
   ───────────────────────────────────────────────── */

function SceneCard({
  scene,
  currentPhaseOrder,
}: {
  scene: VideoProjectScene;
  currentPhaseOrder: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const typeLabel = SCENE_TYPE_LABELS[scene.sceneType] ?? scene.sceneType;
  const estDuration = scene.estimatedSeconds > 0
    ? formatDuration(scene.estimatedSeconds)
    : formatDuration(Math.round((scene.wordCount / 150) * 60));

  return (
    <div
      className="studio-scene-card"
      data-expanded={expanded ? 'true' : 'false'}
      onClick={() => setExpanded((prev) => !prev)}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
        <span
          style={{
            fontFamily: 'var(--studio-font-mono)',
            fontSize: '10px',
            fontWeight: 700,
            color: 'var(--studio-text-3)',
            minWidth: '18px',
          }}
        >
          {scene.order}
        </span>
        <span
          style={{
            fontFamily: 'var(--studio-font-title)',
            fontSize: '14px',
            fontWeight: 600,
            color: 'var(--studio-text-bright)',
            flex: 1,
          }}
        >
          {scene.title || `Scene ${scene.order}`}
        </span>
        <span
          className="studio-scene-type-badge"
          data-type={scene.sceneType}
        >
          {typeLabel}
        </span>
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
        <span
          style={{
            fontFamily: 'var(--studio-font-mono)',
            fontSize: '9px',
            color: 'var(--studio-text-3)',
          }}
        >
          {scene.wordCount} words
        </span>
        <span
          style={{
            fontFamily: 'var(--studio-font-mono)',
            fontSize: '9px',
            color: 'var(--studio-text-3)',
          }}
        >
          ~{estDuration}
        </span>

        {/* Phase completion dots */}
        <div className="studio-scene-phase-dots" style={{ marginLeft: 'auto' }}>
          {SCENE_PHASE_KEYS.map(({ key, label, activeAtPhaseOrder }) => {
            const complete = Boolean(scene[key]);
            const active = activeAtPhaseOrder === currentPhaseOrder;
            const future = activeAtPhaseOrder > currentPhaseOrder;
            return (
              <div
                key={key}
                className="studio-scene-phase-dot"
                data-complete={complete ? 'true' : 'false'}
                data-active={active ? 'true' : 'false'}
                data-future={future ? 'true' : 'false'}
                title={`${label}: ${complete ? 'complete' : active ? 'in progress' : 'upcoming'}`}
              />
            );
          })}
        </div>
      </div>

      {/* Script preview (collapsed) or full (expanded) */}
      {!expanded && scene.scriptText && (
        <div
          style={{
            fontFamily: 'var(--studio-font-body)',
            fontSize: '12px',
            color: 'var(--studio-text-3)',
            lineHeight: 1.45,
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          }}
        >
          {truncateLines(scene.scriptText, 2)}
        </div>
      )}

      {expanded && scene.scriptText && (
        <div
          style={{
            fontFamily: 'var(--studio-font-title)',
            fontSize: '14px',
            color: 'var(--studio-text-2)',
            lineHeight: 1.65,
            marginTop: '8px',
            padding: '12px',
            borderRadius: '6px',
            backgroundColor: 'var(--studio-surface)',
            border: '1px solid var(--studio-border)',
            whiteSpace: 'pre-wrap',
          }}
        >
          {scene.scriptText}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────
   VideoEditor: main component
   ───────────────────────────────────────────────── */

/* ─────────────────────────────────────────────────
   Details Tab (YouTube metadata, linked essays, deliverables)
   ───────────────────────────────────────────────── */

function VideoDetailsTab({ video }: { video: VideoProject }) {
  return (
    <div className="studio-editor-column" style={{ padding: '16px 0' }}>
      <div
        style={{
          fontFamily: 'var(--studio-font-mono)',
          fontSize: '9px',
          fontWeight: 700,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: 'var(--studio-text-3)',
          marginBottom: '12px',
        }}
      >
        YouTube Metadata
      </div>

      {/* YouTube title */}
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
        Title
      </label>
      <div
        style={{
          fontFamily: 'var(--studio-font-body)',
          fontSize: '14px',
          color: video.youtubeTitle ? 'var(--studio-text-bright)' : 'var(--studio-text-3)',
          padding: '8px 0',
          borderBottom: '1px solid var(--studio-border)',
          marginBottom: '12px',
        }}
      >
        {video.youtubeTitle || 'Not set'}
      </div>

      {/* YouTube description */}
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
        Description
      </label>
      <div
        style={{
          fontFamily: 'var(--studio-font-body)',
          fontSize: '13px',
          color: video.youtubeDescription ? 'var(--studio-text-2)' : 'var(--studio-text-3)',
          padding: '8px 0',
          borderBottom: '1px solid var(--studio-border)',
          marginBottom: '12px',
          whiteSpace: 'pre-wrap',
          lineHeight: 1.5,
        }}
      >
        {video.youtubeDescription || 'Not set'}
      </div>

      {/* Deliverables */}
      {video.deliverables.length > 0 && (
        <>
          <div
            style={{
              fontFamily: 'var(--studio-font-mono)',
              fontSize: '9px',
              fontWeight: 700,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: 'var(--studio-text-3)',
              marginTop: '16px',
              marginBottom: '8px',
            }}
          >
            Deliverables
          </div>
          {video.deliverables.map((d) => (
            <div
              key={d.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 0',
                borderBottom: '1px solid var(--studio-border)',
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--studio-font-mono)',
                  fontSize: '9px',
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  padding: '2px 6px',
                  borderRadius: '3px',
                  backgroundColor: 'rgba(58,138,154,0.1)',
                  color: 'var(--studio-teal)',
                  border: '1px solid rgba(58,138,154,0.2)',
                }}
              >
                {d.deliverableType}
              </span>
              <span
                style={{
                  fontFamily: 'var(--studio-font-body)',
                  fontSize: '13px',
                  color: 'var(--studio-text-bright)',
                  flex: 1,
                }}
              >
                {d.filePath || d.notes || d.deliverableType}
              </span>
              <span
                style={{
                  fontFamily: 'var(--studio-font-mono)',
                  fontSize: '9px',
                  color: d.approved ? 'var(--studio-green)' : 'var(--studio-text-3)',
                }}
              >
                {d.approved ? 'approved' : 'pending'}
              </span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────
   VideoEditor: main component
   ───────────────────────────────────────────────── */

export default function VideoEditor({
  slug,
  video,
}: {
  slug: string;
  video: VideoProject;
}) {
  const [nextAction, setNextAction] = useState<VideoNextAction | null>(null);
  const [title, setTitle] = useState(video.title);
  const [thesis, setThesis] = useState(video.thesis);
  const [activeTab, setActiveTab] = useState<VideoTab>('overview');
  const [sessions, setSessions] = useState<VideoProjectSession[]>(video.sessions);
  const [activeSession, setActiveSession] = useState<{ startedAt: string; phase: string } | null>(null);

  const currentPhase = getVideoPhase(video.phase);

  // Fetch next action on mount
  useEffect(() => {
    fetchVideoNextAction(slug).then((data) => {
      if (data) setNextAction(data);
    });
  }, [slug]);

  const handleSessionStart = useCallback((startedAt: string) => {
    setActiveSession({ startedAt, phase: video.phase });
  }, [video.phase]);

  const handleSessionEnd = useCallback(() => {
    setActiveSession(null);
  }, []);

  const handleSessionLogged = useCallback((session: VideoProjectSession) => {
    setSessions((prev) => [session, ...prev]);
    setActiveSession(null);
  }, []);

  // Aggregate stats
  const totalScenes = video.scenes.length;
  const totalWords = video.scenes.reduce((sum, s) => sum + s.wordCount, 0);
  const totalSeconds = video.scenes.reduce((sum, s) => {
    return sum + (s.estimatedSeconds > 0
      ? s.estimatedSeconds
      : Math.round((s.wordCount / 150) * 60));
  }, 0);

  // Phase progress: count scenes where the current phase's boolean is true
  const currentPhaseKey = SCENE_PHASE_KEYS.find(
    (k) => k.activeAtPhaseOrder === currentPhase.order,
  );
  const phaseCompleteCount = currentPhaseKey
    ? video.scenes.filter((s) => Boolean(s[currentPhaseKey.key])).length
    : 0;

  return (
    <div className="studio-writing-surface" style={{ paddingTop: '8px', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      {/* Phase Pipeline */}
      <VideoPhasePipeline
        currentPhase={video.phase}
        lockedThrough={video.phaseLockedThrough}
      />

      {/* Title and Thesis */}
      <div className="studio-editor-column" style={{ padding: '16px 0 8px' }}>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Video title..."
          style={{
            width: '100%',
            fontFamily: 'var(--studio-font-title)',
            fontSize: '26px',
            fontWeight: 700,
            color: 'var(--studio-text-bright)',
            backgroundColor: 'transparent',
            border: 'none',
            outline: 'none',
            padding: '0',
            lineHeight: 1.3,
          }}
        />
        <textarea
          value={thesis}
          onChange={(e) => setThesis(e.target.value)}
          placeholder="Thesis: what is this video about?"
          rows={2}
          style={{
            width: '100%',
            fontFamily: 'var(--studio-font-body)',
            fontSize: '14px',
            color: 'var(--studio-text-2)',
            backgroundColor: 'transparent',
            border: 'none',
            outline: 'none',
            padding: '0',
            marginTop: '8px',
            resize: 'none',
            lineHeight: 1.5,
          }}
        />
      </div>

      {/* Tab Bar */}
      <div className="studio-editor-column">
        <div className="studio-video-tabs">
          {VIDEO_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className="studio-video-tab"
              data-active={activeTab === tab.key ? 'true' : 'false'}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <>
          {/* Session Tracker */}
          <div className="studio-editor-column">
            <VideoSessionTracker
              video={video}
              nextAction={nextAction}
              onSessionLogged={handleSessionLogged}
              onSessionStart={handleSessionStart}
              onSessionEnd={handleSessionEnd}
            />
          </div>

          {/* Next Action Card */}
          {nextAction && (
            <div className="studio-editor-column">
              <NextActionCard action={nextAction} />
            </div>
          )}

          {/* Scene List */}
          <div className="studio-editor-column" style={{ padding: '8px 0' }}>
            <div
              style={{
                fontFamily: 'var(--studio-font-mono)',
                fontSize: '9px',
                fontWeight: 700,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: 'var(--studio-text-3)',
                marginBottom: '8px',
              }}
            >
              Scenes
            </div>
            {video.scenes.length === 0 ? (
              <div
                style={{
                  fontFamily: 'var(--studio-font-body)',
                  fontSize: '13px',
                  color: 'var(--studio-text-3)',
                  padding: '24px 0',
                  textAlign: 'center',
                }}
              >
                No scenes yet. Add scenes in the Django Studio editor.
              </div>
            ) : (
              video.scenes
                .slice()
                .sort((a, b) => a.order - b.order)
                .map((scene) => (
                  <SceneCard
                    key={scene.id}
                    scene={scene}
                    currentPhaseOrder={currentPhase.order}
                  />
                ))
            )}
          </div>

          {/* Bottom Bar */}
          <div
            className="studio-editor-column"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              padding: '12px 0',
              borderTop: '1px solid var(--studio-border)',
              marginTop: '8px',
            }}
          >
            <span
              style={{
                fontFamily: 'var(--studio-font-mono)',
                fontSize: '10px',
                color: 'var(--studio-text-3)',
              }}
            >
              {totalScenes} scenes
            </span>
            <span
              style={{
                fontFamily: 'var(--studio-font-mono)',
                fontSize: '10px',
                color: 'var(--studio-text-3)',
              }}
            >
              {totalWords.toLocaleString()} words
            </span>
            <span
              style={{
                fontFamily: 'var(--studio-font-mono)',
                fontSize: '10px',
                color: 'var(--studio-text-3)',
              }}
            >
              ~{formatDuration(totalSeconds)} runtime
            </span>
            {currentPhaseKey && totalScenes > 0 && (
              <span
                style={{
                  fontFamily: 'var(--studio-font-mono)',
                  fontSize: '10px',
                  color: currentPhase.color,
                  marginLeft: 'auto',
                }}
              >
                {phaseCompleteCount}/{totalScenes} {currentPhaseKey.label.toLowerCase()}
              </span>
            )}
          </div>
        </>
      )}

      {activeTab === 'script' && (
        <Suspense
          fallback={
            <div
              className="studio-editor-column"
              style={{
                padding: '32px 0',
                textAlign: 'center',
                fontFamily: 'var(--studio-font-mono)',
                fontSize: '11px',
                color: 'var(--studio-text-3)',
              }}
            >
              Loading editor...
            </div>
          }
        >
          <VideoScriptEditor
            slug={slug}
            initialScript={video.scriptBody}
          />
        </Suspense>
      )}

      {activeTab === 'evidence' && (
        <Suspense
          fallback={
            <div
              className="studio-editor-column"
              style={{
                padding: '32px 0',
                textAlign: 'center',
                fontFamily: 'var(--studio-font-mono)',
                fontSize: '11px',
                color: 'var(--studio-text-3)',
              }}
            >
              Loading...
            </div>
          }
        >
          <div className="studio-editor-column" style={{ padding: '8px 0' }}>
            <div
              style={{
                fontFamily: 'var(--studio-font-mono)',
                fontSize: '9px',
                fontWeight: 700,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: 'var(--studio-text-3)',
                marginBottom: '8px',
              }}
            >
              Evidence Board
            </div>
            <EvidenceBoard
              slug={slug}
              initialRows={video.evidenceBoard}
              sources={Array.isArray(video.sources) ? video.sources.map((s) => s.title).filter(Boolean) : []}
            />
          </div>
        </Suspense>
      )}

      {activeTab === 'details' && (
        <VideoDetailsTab video={video} />
      )}

      {activeTab === 'sessions' && (
        <div className="studio-editor-column">
          <VideoSessionLog
            sessions={sessions}
            activeSession={activeSession}
          />
        </div>
      )}
    </div>
  );
}
