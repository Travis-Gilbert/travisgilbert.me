'use client';

import { useState, useEffect, useCallback } from 'react';
import { getMockWorkbenchData } from '@/lib/studio-mock-data';
import { getStage, getContentTypeIdentity, STAGES } from '@/lib/studio';

const STORAGE_KEY = 'studio-workbench-open';

/**
 * Collapsible right panel for Studio pipeline stats.
 *
 * 300px slide panel showing pipeline breakdown, quick stats,
 * and recent activity. Persists open/closed state to
 * localStorage. Toggle via button or Cmd+. / Ctrl+. shortcut.
 *
 * Hidden on viewports below 1024px.
 */
export default function WorkbenchPanel() {
  const [open, setOpen] = useState(true);
  const [mounted, setMounted] = useState(false);

  /* Read persisted state after hydration */
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored !== null) {
      setOpen(stored === 'true');
    }
    setMounted(true);
  }, []);

  /* Persist toggle */
  const toggle = useCallback(() => {
    setOpen((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  }, []);

  /* Keyboard shortcut: Cmd+. or Ctrl+. */
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === '.' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        toggle();
      }
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [toggle]);

  const data = getMockWorkbenchData();

  /* Pre-mount: render collapsed to avoid flash */
  if (!mounted) return null;

  return (
    <aside
      className="studio-workbench studio-workbench-grid studio-scrollbar studio-grain"
      data-open={open ? 'true' : undefined}
      style={{
        width: open ? '300px' : '0px',
        minWidth: open ? '300px' : '0px',
        overflow: 'hidden',
        flexShrink: 0,
        backgroundColor: 'var(--studio-bg-sidebar)',
        borderLeft: open ? '1px solid var(--studio-border)' : 'none',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        transition: 'width 0.2s ease, min-width 0.2s ease',
      }}
    >
      {/* Bottom-right glow bloom (mirrors sidebar's top-left) */}
      <div className="studio-workbench-glow" aria-hidden="true" />

      {/* Toggle button */}
      <button
        type="button"
        onClick={toggle}
        aria-label={open ? 'Close workbench' : 'Open workbench'}
        title="Toggle workbench (Cmd+.)"
        style={{
          position: 'absolute',
          left: '-28px',
          top: '12px',
          width: '24px',
          height: '24px',
          backgroundColor: 'var(--studio-surface)',
          border: '1px solid var(--studio-border)',
          borderRadius: '4px',
          color: 'var(--studio-text-3)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10,
          transition: 'all 0.1s ease',
        }}
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        >
          {open ? (
            <polyline points="8,2 4,6 8,10" />
          ) : (
            <polyline points="4,2 8,6 4,10" />
          )}
        </svg>
      </button>

      {/* Panel content (only rendered when open for perf) */}
      {open && (
        <div
          className="studio-scrollbar"
          style={{
            padding: '20px 18px',
            opacity: open ? 1 : 0,
            transition: 'opacity 0.15s ease 0.05s',
            overflowY: 'auto',
            flex: 1,
          }}
        >
          {/* Section: Pipeline Breakdown */}
          <div style={{ marginBottom: '24px' }}>
            <div className="studio-nav-section-label">Pipeline</div>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '6px',
                marginTop: '8px',
              }}
            >
              {STAGES.map((s) => {
                const count = data.pipelineBreakdown[s.slug] ?? 0;
                return (
                  <span
                    key={s.slug}
                    className="studio-stage-badge"
                    data-stage={s.slug}
                    style={{ cursor: 'default' }}
                  >
                    {s.label} {count}
                  </span>
                );
              })}
            </div>
          </div>

          {/* Section: Quick Stats */}
          <div style={{ marginBottom: '24px' }}>
            <div className="studio-nav-section-label">Stats</div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '10px',
                marginTop: '8px',
              }}
            >
              <QuickStat
                value={data.totalWords.toLocaleString()}
                label="Total words"
              />
              <QuickStat
                value={String(data.publishReadyThisWeek)}
                label="Publish ready"
              />
              <QuickStat
                value={String(data.ideaBacklogCount)}
                label="Idea backlog"
              />
              <QuickStat
                value={String(
                  Object.values(data.pipelineBreakdown).reduce(
                    (a, b) => a + b,
                    0,
                  ),
                )}
                label="Total pieces"
              />
            </div>
          </div>

          {/* Section: Recent Activity */}
          <div>
            <div className="studio-nav-section-label">Recent</div>
            <div style={{ marginTop: '8px' }}>
              {data.recentActivity.map((entry) => {
                const typeId = getContentTypeIdentity(entry.contentType);
                return (
                  <div
                    key={entry.id}
                    style={{
                      display: 'flex',
                      gap: '8px',
                      alignItems: 'baseline',
                      padding: '6px 0',
                      borderBottom: '1px solid var(--studio-border)',
                    }}
                  >
                    <span
                      style={{
                        width: '5px',
                        height: '5px',
                        borderRadius: '50%',
                        backgroundColor:
                          typeId?.color ?? 'var(--studio-text-3)',
                        flexShrink: 0,
                        marginTop: '5px',
                      }}
                    />
                    <span
                      style={{
                        fontFamily: 'var(--studio-font-body)',
                        fontSize: '12px',
                        color: 'var(--studio-text-2)',
                        flex: 1,
                        lineHeight: 1.4,
                      }}
                    >
                      {entry.detail}
                    </span>
                    <span
                      style={{
                        fontFamily: 'var(--studio-font-mono)',
                        fontSize: '10px',
                        color: 'var(--studio-text-3)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {formatRelative(entry.occurredAt)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}

/* ── Quick stat tile ─────────────────────────── */

function QuickStat({ value, label }: { value: string; label: string }) {
  return (
    <div
      style={{
        backgroundColor: 'var(--studio-surface)',
        border: '1px solid var(--studio-border)',
        borderRadius: '5px',
        padding: '10px 12px',
      }}
    >
      <div
        style={{
          fontFamily: 'var(--studio-font-mono)',
          fontSize: '20px',
          fontWeight: 700,
          color: 'var(--studio-text-bright)',
          lineHeight: 1.1,
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontFamily: 'var(--studio-font-body)',
          fontSize: '10px',
          color: 'var(--studio-text-3)',
          marginTop: '3px',
          textTransform: 'uppercase' as const,
          letterSpacing: '0.06em',
        }}
      >
        {label}
      </div>
    </div>
  );
}

/* ── Helpers ───────────────────────────────────── */

function formatRelative(iso: string): string {
  const now = new Date('2026-03-04T14:00:00Z').getTime();
  const then = new Date(iso).getTime();
  const hours = Math.floor((now - then) / 3600000);
  if (hours < 1) return 'just now';
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}
