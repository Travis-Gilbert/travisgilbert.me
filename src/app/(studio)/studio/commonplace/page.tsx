'use client';

import Link from 'next/link';
import { useState, useEffect, useCallback } from 'react';
import { fetchAllTasks, updateTask, type TaskGroup } from '@/lib/studio-api';
import { getContentTypeIdentity } from '@/lib/studio';

const TABS = ['All', 'Notes', 'Tasks', 'Sources'] as const;
type Tab = (typeof TABS)[number];

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function CommonplacePage() {
  const [activeTab, setActiveTab] = useState<Tab>('Tasks');
  const [taskGroups, setTaskGroups] = useState<TaskGroup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchAllTasks().then((groups) => {
      if (!cancelled) {
        setTaskGroups(groups);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleToggleTask = useCallback(
    (contentType: string, contentSlug: string, taskId: number, done: boolean) => {
      setTaskGroups((prev) =>
        prev
          .map((g) => {
            if (g.content_type !== contentType || g.content_slug !== contentSlug)
              return g;
            return {
              ...g,
              tasks: g.tasks.map((t) =>
                t.id === taskId ? { ...t, done } : t,
              ),
            };
          })
          .filter((g) => g.tasks.some((t) => !t.done)),
      );
      updateTask(contentType, contentSlug, taskId, { done });
    },
    [],
  );

  const openCount = taskGroups.reduce(
    (n, g) => n + g.tasks.filter((t) => !t.done).length,
    0,
  );

  return (
    <div style={{ padding: '32px 28px', maxWidth: '720px' }}>
      <h1
        style={{
          fontFamily: 'var(--studio-font-title)',
          fontSize: '22px',
          fontWeight: 600,
          color: 'var(--studio-text-1)',
          margin: '0 0 20px',
        }}
      >
        Commonplace
      </h1>

      {/* Tab bar */}
      <div
        style={{
          display: 'flex',
          gap: '4px',
          marginBottom: '24px',
          borderBottom: '1px solid var(--studio-border)',
          paddingBottom: '0',
        }}
      >
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              fontFamily: 'var(--studio-font-mono)',
              fontSize: '12px',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              padding: '8px 14px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color:
                activeTab === tab
                  ? 'var(--studio-text-1)'
                  : 'var(--studio-text-3)',
              borderBottom:
                activeTab === tab
                  ? '2px solid var(--studio-accent)'
                  : '2px solid transparent',
              marginBottom: '-1px',
              transition: 'color 150ms, border-color 150ms',
            }}
          >
            {tab}
            {tab === 'Tasks' && openCount > 0 && (
              <span
                style={{
                  marginLeft: '6px',
                  fontWeight: 400,
                  color: 'var(--studio-text-3)',
                }}
              >
                ({openCount})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'Tasks' && (
        <TasksPanel
          groups={taskGroups}
          loading={loading}
          onToggle={handleToggleTask}
        />
      )}

      {activeTab === 'All' && (
        <PlaceholderPanel label="All commonplace entries will appear here." />
      )}

      {activeTab === 'Notes' && (
        <PlaceholderPanel label="Notes captured across content will appear here." />
      )}

      {activeTab === 'Sources' && (
        <PlaceholderPanel label="Research sources linked to content will appear here." />
      )}
    </div>
  );
}

/* ── Tasks panel ── */

function TasksPanel({
  groups,
  loading,
  onToggle,
}: {
  groups: TaskGroup[];
  loading: boolean;
  onToggle: (ct: string, slug: string, id: number, done: boolean) => void;
}) {
  if (loading) {
    return (
      <p
        style={{
          fontFamily: 'var(--studio-font-body)',
          fontSize: '13px',
          color: 'var(--studio-text-3)',
        }}
      >
        Loading tasks...
      </p>
    );
  }

  if (groups.length === 0) {
    return (
      <p
        style={{
          fontFamily: 'var(--studio-font-body)',
          fontSize: '13px',
          color: 'var(--studio-text-3)',
        }}
      >
        No open tasks across content.
      </p>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      {groups.map((group) => {
        const type = getContentTypeIdentity(group.content_type);
        const openTasks = group.tasks.filter((t) => !t.done);
        if (openTasks.length === 0) return null;

        return (
          <div key={`${group.content_type}:${group.content_slug}`}>
            {/* Content item header */}
            <Link
              href={`/studio/${type.route}/${group.content_slug}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                textDecoration: 'none',
                color: 'var(--studio-text-1)',
                fontFamily: 'var(--studio-font-title)',
                fontSize: '14px',
                fontWeight: 500,
                marginBottom: '8px',
              }}
            >
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: type.color,
                  flexShrink: 0,
                }}
              />
              {group.content_slug}
              <span
                style={{
                  fontFamily: 'var(--studio-font-mono)',
                  fontSize: '10px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: type.color,
                  opacity: 0.7,
                }}
              >
                {type.label}
              </span>
            </Link>

            {/* Task list */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                paddingLeft: '16px',
              }}
            >
              {openTasks.map((task) => (
                <label
                  key={task.id}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '8px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontFamily: 'var(--studio-font-body)',
                    color: 'var(--studio-tc)',
                    lineHeight: '1.5',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={task.done}
                    onChange={() =>
                      onToggle(
                        group.content_type,
                        group.content_slug,
                        task.id,
                        !task.done,
                      )
                    }
                    style={{ marginTop: '3px', flexShrink: 0 }}
                  />
                  <span style={{ flex: 1 }}>{task.text}</span>
                  <span
                    style={{
                      fontFamily: 'var(--studio-font-mono)',
                      fontSize: '10px',
                      color: 'var(--studio-text-3)',
                      flexShrink: 0,
                      marginTop: '2px',
                    }}
                  >
                    {relativeTime(task.created_at)}
                  </span>
                </label>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Placeholder for future tabs ── */

function PlaceholderPanel({ label }: { label: string }) {
  return (
    <p
      style={{
        fontFamily: 'var(--studio-font-body)',
        fontSize: '13px',
        color: 'var(--studio-text-3)',
        fontStyle: 'italic',
      }}
    >
      {label}
    </p>
  );
}
