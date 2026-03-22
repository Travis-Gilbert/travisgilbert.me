'use client';

/**
 * NotebookListView: grid of all notebooks.
 *
 * Fetches notebooks from the API and renders each as a card
 * showing: color dot, name, description excerpt, object count.
 * Clicking a card opens the notebook detail via launchView().
 */

import { fetchNotebooks, useApiData } from '@/lib/commonplace-api';
import { useLayout } from '@/lib/providers/layout-provider';

export default function NotebookListView() {
  const { data: notebooks, loading, error, refetch } = useApiData(
    () => fetchNotebooks(),
    [],
  );
  const { launchView } = useLayout();

  /* Loading */
  if (loading) {
    return (
      <div className="cp-list-view cp-scrollbar">
        <h2 className="cp-list-view-title">Notebooks</h2>
        <div className="cp-list-view-grid">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="cp-loading-skeleton"
              style={{ width: '100%', height: 100, borderRadius: 8 }}
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
        <h2 className="cp-list-view-title">Notebooks</h2>
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

  const items = notebooks ?? [];

  /* Empty */
  if (items.length === 0) {
    return (
      <div className="cp-list-view">
        <h2 className="cp-list-view-title">Notebooks</h2>
        <div className="cp-empty-state">
          No notebooks yet. Create one from the Django admin.
        </div>
      </div>
    );
  }

  return (
    <div className="cp-list-view cp-scrollbar">
      <h2 className="cp-list-view-title">Notebooks</h2>
      <div className="cp-list-view-grid">
        {items.map((nb) => (
          <button
            key={nb.id}
            type="button"
            className="cp-list-card"
            onClick={() => launchView('notebook', { slug: nb.slug })}
          >
            <span
              className="cp-list-card-color"
              style={{ backgroundColor: nb.color || '#8B6FA0' }}
            />
            <div className="cp-list-card-body">
              <h3 className="cp-list-card-name">{nb.name}</h3>
              {nb.description && (
                <p className="cp-list-card-desc">
                  {nb.description.length > 80
                    ? nb.description.slice(0, 80) + '...'
                    : nb.description}
                </p>
              )}
              <span className="cp-list-card-count">
                {nb.object_count} object{nb.object_count !== 1 ? 's' : ''}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
