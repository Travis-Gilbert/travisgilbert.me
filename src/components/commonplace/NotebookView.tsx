'use client';

/**
 * NotebookView: detail view for a single notebook.
 *
 * Layout:
 *   [color dot] Notebook name
 *   Description text
 *   [Objects] [Timeline]   (ViewSubTabs)
 *   Objects tab -> ObjectListPanel
 *   Timeline tab -> ScopedTimelinePanel
 *
 * Fetches notebook detail by slug. Color from the notebook's
 * `color` field is applied to the header badge. Objects come
 * from the notebook detail response; the timeline uses scoped
 * fetchFeed({ notebook: slug }).
 */

import { useState } from 'react';
import { fetchNotebookBySlug, useApiData } from '@/lib/commonplace-api';
import ViewSubTabs from './ViewSubTabs';
import ObjectListPanel from './ObjectListPanel';
import ScopedTimelinePanel from './ScopedTimelinePanel';

const TABS = [
  { key: 'objects', label: 'Objects' },
  { key: 'timeline', label: 'Timeline' },
];

interface NotebookViewProps {
  slug: string;
  onOpenObject?: (objectRef: number, title?: string) => void;
}

export default function NotebookView({ slug, onOpenObject }: NotebookViewProps) {
  const { data: notebook, loading, error, refetch } = useApiData(
    () => fetchNotebookBySlug(slug),
    [slug],
  );

  const [activeTab, setActiveTab] = useState('objects');

  /* Loading */
  if (loading) {
    return (
      <div className="cp-notebook-view cp-scrollbar">
        <div className="cp-notebook-header">
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
  if (error || !notebook) {
    return (
      <div className="cp-notebook-view">
        <div className="cp-error-banner" style={{ margin: 16 }}>
          <p>
            {error?.isNetworkError
              ? 'Could not reach CommonPlace API.'
              : `Error: ${error?.message ?? 'Notebook not found'}`}
          </p>
          <button type="button" onClick={refetch}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="cp-notebook-view cp-scrollbar">
      {/* Header */}
      <div className="cp-notebook-header">
        <span
          className="cp-notebook-color-bar"
          style={{ backgroundColor: notebook.color || '#8B6FA0' }}
        />
        <div className="cp-notebook-header-text">
          <h2 className="cp-notebook-title">{notebook.name}</h2>
          {notebook.description && (
            <p className="cp-notebook-description">{notebook.description}</p>
          )}
          <span className="cp-notebook-count">
            {notebook.object_count} object{notebook.object_count !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Sub-tabs */}
      <ViewSubTabs tabs={TABS} active={activeTab} onChange={setActiveTab} />

      {/* Tab content */}
      <div className="cp-notebook-content">
        {activeTab === 'objects' && (
          <ObjectListPanel
            objects={notebook.objects}
            onOpenObject={onOpenObject}
          />
        )}
        {activeTab === 'timeline' && (
          <ScopedTimelinePanel
            notebook={slug}
            onOpenObject={onOpenObject ? (ref) => onOpenObject(ref) : undefined}
          />
        )}
      </div>
    </div>
  );
}
