'use client';

/**
 * ProjectListView: grid of all projects grouped by status.
 *
 * Fetches projects from the API and groups them into status
 * sections (active, paused, archived, completed). Each card
 * shows: name, mode label, notebook parent if present, and
 * a template badge when applicable.
 */

import { useMemo } from 'react';
import { fetchProjects, useApiData } from '@/lib/commonplace-api';
import { useCommonPlace } from '@/lib/commonplace-context';
import type { ApiProjectListItem } from '@/lib/commonplace';

const STATUS_ORDER = ['active', 'paused', 'archived', 'completed'];

const STATUS_COLORS: Record<string, string> = {
  active: '#5A7A4A',
  paused: '#C49A4A',
  archived: '#9A8E82',
  completed: '#2D5F6B',
};

const MODE_LABELS: Record<string, string> = {
  collect: 'Collect',
  write: 'Write',
  review: 'Review',
};

export default function ProjectListView() {
  const { data: projects, loading, error, refetch } = useApiData(
    () => fetchProjects(),
    [],
  );
  const { launchView } = useCommonPlace();

  /* Group by status */
  const grouped = useMemo(() => {
    if (!projects) return [];
    const groups = new Map<string, ApiProjectListItem[]>();

    for (const p of projects) {
      const status = p.status || 'active';
      const existing = groups.get(status);
      if (existing) existing.push(p);
      else groups.set(status, [p]);
    }

    return STATUS_ORDER
      .filter((s) => groups.has(s))
      .map((s) => ({ status: s, items: groups.get(s)! }));
  }, [projects]);

  /* Loading */
  if (loading) {
    return (
      <div className="cp-list-view cp-scrollbar">
        <h2 className="cp-list-view-title">Projects</h2>
        <div className="cp-list-view-grid">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="cp-loading-skeleton"
              style={{ width: '100%', height: 80, borderRadius: 8 }}
            />
          ))}
        </div>
      </div>
    );
  }

  /* Error */
  if (error) {
    return (
      <div className="cp-list-view">
        <h2 className="cp-list-view-title">Projects</h2>
        <div className="cp-error-banner" style={{ margin: 16 }}>
          <p>
            {error.isNetworkError
              ? 'Could not reach CommonPlace API.'
              : `Error: ${error.message}`}
          </p>
          <button type="button" onClick={refetch}>Retry</button>
        </div>
      </div>
    );
  }

  /* Empty */
  if (grouped.length === 0) {
    return (
      <div className="cp-list-view">
        <h2 className="cp-list-view-title">Projects</h2>
        <div className="cp-empty-state">
          No projects yet. Create one from the Django admin.
        </div>
      </div>
    );
  }

  return (
    <div className="cp-list-view cp-scrollbar">
      <h2 className="cp-list-view-title">Projects</h2>

      {grouped.map((group) => (
        <div key={group.status} className="cp-status-group">
          <h3 className="cp-status-group-label">
            <span
              className="cp-status-group-dot"
              style={{ backgroundColor: STATUS_COLORS[group.status] ?? '#9A8E82' }}
            />
            {group.status.charAt(0).toUpperCase() + group.status.slice(1)}
            <span className="cp-status-group-count">({group.items.length})</span>
          </h3>

          <div className="cp-list-view-grid">
            {group.items.map((p) => (
              <button
                key={p.id}
                type="button"
                className="cp-list-card"
                onClick={() => launchView('project', { slug: p.slug })}
              >
                <div className="cp-list-card-body">
                  <h3 className="cp-list-card-name">{p.name}</h3>
                  <div className="cp-list-card-meta">
                    {p.mode && (
                      <span className="cp-list-card-mode">
                        {MODE_LABELS[p.mode] ?? p.mode}
                      </span>
                    )}
                    {p.notebook_name && (
                      <span className="cp-list-card-notebook">
                        {p.notebook_name}
                      </span>
                    )}
                    {p.is_template && (
                      <span className="cp-list-card-template">Template</span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
