'use client';

/**
 * ProjectView: detail view for a single project.
 *
 * Similar to NotebookView but shows project-specific fields:
 * mode (collect/write/review), status (active/paused/archived/
 * completed), notebook parent link if present.
 *
 * Objects tab shows the project's attached objects.
 * Timeline tab shows scoped feed filtered by project slug.
 */

import { useState } from 'react';
import { fetchProjectBySlug, useApiData } from '@/lib/commonplace-api';
import { useLayout } from '@/lib/providers/layout-provider';
import ViewSubTabs from './ViewSubTabs';
import ObjectListPanel from './ObjectListPanel';
import ScopedTimelinePanel from './ScopedTimelinePanel';

const TABS = [
  { key: 'objects', label: 'Objects' },
  { key: 'timeline', label: 'Timeline' },
];

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

interface ProjectViewProps {
  slug: string;
  onOpenObject?: (objectRef: number, title?: string) => void;
}

export default function ProjectView({ slug, onOpenObject }: ProjectViewProps) {
  const { data: project, loading, error, refetch } = useApiData(
    () => fetchProjectBySlug(slug),
    [slug],
  );

  const { launchView } = useLayout();
  const [activeTab, setActiveTab] = useState('objects');

  /* Loading */
  if (loading) {
    return (
      <div className="cp-project-view cp-scrollbar">
        <div className="cp-project-header">
          <div className="cp-loading-skeleton" style={{ width: 200, height: 24 }} />
        </div>
        <div style={{ padding: '0 16px' }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="cp-loading-skeleton"
              style={{ width: '100%', height: 60, borderRadius: 8, marginBottom: 12 }}
            />
          ))}
        </div>
      </div>
    );
  }

  /* Error */
  if (error || !project) {
    return (
      <div className="cp-project-view">
        <div className="cp-error-banner" style={{ margin: 16 }}>
          <p>
            {error?.isNetworkError
              ? 'Could not reach CommonPlace API.'
              : `Error: ${error?.message ?? 'Project not found'}`}
          </p>
          <button type="button" onClick={refetch}>Retry</button>
        </div>
      </div>
    );
  }

  const statusColor = STATUS_COLORS[project.status] ?? '#9A8E82';

  return (
    <div className="cp-project-view cp-scrollbar">
      {/* Header */}
      <div className="cp-project-header">
        <div className="cp-project-header-top">
          <span
            className="cp-project-status-dot"
            style={{ backgroundColor: statusColor }}
          />
          <h2 className="cp-project-title">{project.name}</h2>
        </div>

        <div className="cp-project-meta">
          <span
            className="cp-project-status-badge"
            style={{ color: statusColor, borderColor: statusColor }}
          >
            {project.status}
          </span>
          {project.mode && (
            <span className="cp-project-mode-badge">
              {MODE_LABELS[project.mode] ?? project.mode}
            </span>
          )}
          {project.notebook_name && (
            <button
              type="button"
              className="cp-project-notebook-link"
              onClick={() => {
                if (project.notebook) {
                  launchView('notebook', { slug: project.notebook });
                }
              }}
            >
              {project.notebook_name}
            </button>
          )}
        </div>

        {project.description && (
          <p className="cp-project-description">{project.description}</p>
        )}
      </div>

      {/* Sub-tabs */}
      <ViewSubTabs tabs={TABS} active={activeTab} onChange={setActiveTab} />

      {/* Tab content */}
      <div className="cp-project-content">
        {activeTab === 'objects' && (
          <ObjectListPanel
            objects={project.objects}
            onOpenObject={onOpenObject}
          />
        )}
        {activeTab === 'timeline' && (
          <ScopedTimelinePanel
            project={slug}
            onOpenObject={onOpenObject ? (ref) => onOpenObject(ref) : undefined}
          />
        )}
      </div>
    </div>
  );
}
