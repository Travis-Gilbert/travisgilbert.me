'use client';

/**
 * NotebookListView: grid of all notebooks.
 *
 * Fetches notebooks from the API and renders each as a card
 * showing: color dot, name, description excerpt, object count.
 * Clicking a card opens the notebook detail via launchView().
 */

import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { fetchNotebooks, createNotebook, useApiData } from '@/lib/commonplace-api';
import { useLayout } from '@/lib/providers/layout-provider';

export default function NotebookListView() {
  const { data: notebooks, loading, error, refetch } = useApiData(
    () => fetchNotebooks(),
    [],
  );
  const { launchView } = useLayout();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#8B6FA0');
  const [creating, setCreating] = useState(false);

  const handleCreate = useCallback(async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const nb = await createNotebook({ name: newName.trim(), color: newColor });
      setNewName('');
      setShowCreate(false);
      refetch();
      launchView('notebook', { slug: nb.slug });
    } catch {
      toast.error('Failed to create notebook');
    } finally {
      setCreating(false);
    }
  }, [newName, newColor, refetch, launchView]);

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

  const createForm = (
    <div className="cp-inline-create" style={{ padding: '0 16px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
      <input
        type="text"
        value={newName}
        onChange={(e) => setNewName(e.target.value)}
        placeholder="Notebook name"
        autoFocus
        className="cp-input"
        style={{ fontSize: 12 }}
        onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setShowCreate(false); }}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <label style={{ fontFamily: 'var(--cp-font-mono)', fontSize: 10, color: 'var(--cp-text-faint)' }}>Color</label>
        <input type="color" value={newColor} onChange={(e) => setNewColor(e.target.value)} style={{ width: 24, height: 24, border: 'none', padding: 0, cursor: 'pointer' }} />
      </div>
      <div style={{ display: 'flex', gap: 4 }}>
        <button type="button" className="cp-btn-accent" style={{ flex: 1 }} onClick={handleCreate} disabled={creating || !newName.trim()}>
          {creating ? 'Creating...' : 'Create'}
        </button>
        <button type="button" className="cp-btn-ghost" onClick={() => setShowCreate(false)}>Cancel</button>
      </div>
    </div>
  );

  /* Empty */
  if (items.length === 0) {
    return (
      <div className="cp-list-view">
        <h2 className="cp-list-view-title">Notebooks</h2>
        {showCreate ? createForm : (
          <div className="cp-empty-state">
            <p>No notebooks yet.</p>
            <button type="button" className="cp-btn-accent" onClick={() => setShowCreate(true)} style={{ marginTop: 8 }}>
              <span className="cp-btn-accent-dot" />
              Create your first notebook
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="cp-list-view cp-scrollbar">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px' }}>
        <h2 className="cp-list-view-title" style={{ padding: 0 }}>Notebooks</h2>
        {!showCreate && (
          <button type="button" className="cp-btn-accent" onClick={() => setShowCreate(true)} style={{ fontSize: 11, padding: '4px 10px' }}>
            <span className="cp-btn-accent-dot" />
            New
          </button>
        )}
      </div>
      {showCreate && createForm}
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
