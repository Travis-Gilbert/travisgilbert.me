'use client';

/**
 * FrameManager: save/restore named view configurations.
 *
 * Dropdown in the network pane toolbar area. Persists frames to
 * localStorage. Each frame stores zoom, center position, and
 * optionally highlighted node IDs.
 *
 * Built-in frames: "Overview" (reset zoom), "Recent" (last 7 days),
 * "Clusters" (zoom to center).
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { ViewFrame } from '@/lib/commonplace';
import { loadFrames, saveFrames, createFrame } from '@/lib/commonplace-graph';

interface FrameManagerProps {
  /** Current zoom level from the graph view */
  currentZoom: number;
  /** Current center X */
  currentCenterX: number;
  /** Current center Y */
  currentCenterY: number;
  /** Callback to restore a frame */
  onRestoreFrame: (frame: ViewFrame) => void;
  /** Returns a base64 PNG snapshot of the current canvas for thumbnail storage */
  getCanvasSnapshot?: () => string | null;
}

/** Built-in frames that are always available */
const BUILT_IN_FRAMES: ViewFrame[] = [
  {
    id: 'builtin-overview',
    name: 'Overview',
    zoom: 1,
    centerX: 0,
    centerY: 0,
    highlightedNodeIds: [],
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'builtin-recent',
    name: 'Recent (7d)',
    zoom: 1.5,
    centerX: 0,
    centerY: 0,
    highlightedNodeIds: [],
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'builtin-clusters',
    name: 'Clusters',
    zoom: 1.2,
    centerX: 0,
    centerY: 0,
    highlightedNodeIds: [],
    createdAt: '2026-01-01T00:00:00Z',
  },
];

export default function FrameManager({
  currentZoom,
  currentCenterX,
  currentCenterY,
  onRestoreFrame,
  getCanvasSnapshot,
}: FrameManagerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [userFrames, setUserFrames] = useState<ViewFrame[]>([]);
  const [saveName, setSaveName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  /* Load user frames from localStorage */
  useEffect(() => {
    setUserFrames(loadFrames());
  }, []);

  /* Close on outside click */
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setIsSaving(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  const handleSave = useCallback(() => {
    if (!saveName.trim()) return;
    const thumbnail = getCanvasSnapshot?.() ?? undefined;
    const frame: ViewFrame = {
      ...createFrame(saveName.trim(), currentZoom, currentCenterX, currentCenterY),
      thumbnail: thumbnail ?? undefined,
    };
    const updated = [...userFrames, frame];
    setUserFrames(updated);
    saveFrames(updated);
    setSaveName('');
    setIsSaving(false);
  }, [saveName, currentZoom, currentCenterX, currentCenterY, userFrames, getCanvasSnapshot]);

  const handleDelete = useCallback(
    (frameId: string) => {
      const updated = userFrames.filter((f) => f.id !== frameId);
      setUserFrames(updated);
      saveFrames(updated);
    },
    [userFrames],
  );

  const allFrames = [...BUILT_IN_FRAMES, ...userFrames];

  return (
    <div ref={dropdownRef} style={{ position: 'relative' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="cp-frame-btn"
        title="View frames"
        aria-label="View frames"
        aria-expanded={isOpen}
      >
        <svg width={12} height={12} viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <rect x={1} y={1} width={10} height={10} rx={1.5} stroke="currentColor" strokeWidth={1.2} />
          <line x1={4} y1={1} x2={4} y2={11} stroke="currentColor" strokeWidth={0.8} />
          <line x1={1} y1={5} x2={11} y2={5} stroke="currentColor" strokeWidth={0.8} />
        </svg>
        <span>Frames</span>
      </button>

      {isOpen && (
        <div className="cp-frame-dropdown">
          <div
            style={{
              fontFamily: 'var(--cp-font-mono)',
              fontSize: 9,
              letterSpacing: '0.08em',
              color: 'var(--cp-text-faint)',
              padding: '6px 10px 4px',
              textTransform: 'uppercase',
            }}
          >
            Saved Views
          </div>

          {allFrames.map((frame) => (
            <div key={frame.id} className="cp-frame-item">
              <button
                onClick={() => {
                  onRestoreFrame(frame);
                  setIsOpen(false);
                }}
                className="cp-frame-item-btn"
                style={{ display: 'flex', alignItems: 'center', gap: 7 }}
              >
                {/* Thumbnail: 48x48 preview for user frames, placeholder for built-ins */}
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 3,
                    overflow: 'hidden',
                    flexShrink: 0,
                    backgroundColor: 'var(--cp-surface)',
                    border: '1px solid var(--cp-border)',
                  }}
                >
                  {frame.thumbnail ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={frame.thumbnail}
                      alt=""
                      aria-hidden="true"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    /* Blueprint grid placeholder for built-in frames */
                    <svg width={48} height={48} viewBox="0 0 48 48" aria-hidden="true">
                      <rect width={48} height={48} fill="var(--cp-surface)" />
                      {Array.from({ length: 6 }).map((_, i) => (
                        <line key={`v${i}`} x1={i * 8} y1={0} x2={i * 8} y2={48}
                          stroke="var(--cp-border)" strokeWidth={0.5} />
                      ))}
                      {Array.from({ length: 6 }).map((_, i) => (
                        <line key={`h${i}`} x1={0} y1={i * 8} x2={48} y2={i * 8}
                          stroke="var(--cp-border)" strokeWidth={0.5} />
                      ))}
                      <circle cx={24} cy={24} r={4} fill="var(--cp-accent)" opacity={0.35} />
                    </svg>
                  )}
                </div>
                <span>{frame.name}</span>
              </button>
              {/* Only user frames are deletable */}
              {!frame.id.startsWith('builtin-') && (
                <button
                  onClick={() => handleDelete(frame.id)}
                  className="cp-frame-delete-btn"
                  title={`Delete "${frame.name}"`}
                  aria-label={`Delete frame ${frame.name}`}
                >
                  ×
                </button>
              )}
            </div>
          ))}

          <div style={{ borderTop: '1px solid var(--cp-border)', margin: '4px 0' }} />

          {isSaving ? (
            <div style={{ padding: '4px 10px', display: 'flex', gap: 4 }}>
              <input
                type="text"
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSave();
                  if (e.key === 'Escape') setIsSaving(false);
                }}
                placeholder="Frame name..."
                autoFocus
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: '1px solid var(--cp-border)',
                  borderRadius: 3,
                  padding: '2px 6px',
                  fontFamily: 'var(--cp-font-body)',
                  fontSize: 11,
                  color: 'var(--cp-text)',
                  outline: 'none',
                }}
              />
              <button
                onClick={handleSave}
                style={{
                  background: 'var(--cp-accent)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 3,
                  padding: '2px 8px',
                  fontFamily: 'var(--cp-font-mono)',
                  fontSize: 9,
                  cursor: 'pointer',
                }}
              >
                SAVE
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsSaving(true)}
              className="cp-frame-item-btn"
              style={{ width: '100%', textAlign: 'left', padding: '4px 10px' }}
            >
              + Save current view
            </button>
          )}
        </div>
      )}
    </div>
  );
}
