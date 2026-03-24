'use client';

/**
 * NotebookListView: bookshelf layout for notebook collection.
 *
 * Two tiers: pinned notebooks shown as 3D angled book covers,
 * remaining notebooks as flat front-facing covers grouped by category.
 */

import { useState, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { fetchNotebooks, createNotebook, useApiData } from '@/lib/commonplace-api';
import type { ApiNotebookListItem } from '@/lib/commonplace';
import { useLayout } from '@/lib/providers/layout-provider';
import FeaturedBook from './notebook-shelf/FeaturedBook';
import ShelfBook from './notebook-shelf/ShelfBook';
import AddBookButton from './notebook-shelf/AddBookButton';
import './notebook-shelf/notebook-shelf.css';

function getPinnedSlugs(): string[] {
  try {
    return JSON.parse(localStorage.getItem('cp-pinned-notebooks') || '[]');
  } catch {
    return [];
  }
}

interface NotebookGroup {
  label: string;
  notebooks: ApiNotebookListItem[];
}

function groupNotebooks(notebooks: ApiNotebookListItem[]): NotebookGroup[] {
  const groups = new Map<string, ApiNotebookListItem[]>();
  for (const nb of notebooks) {
    const key = nb.description?.split(' ')[0] || 'Other';
    const existing = groups.get(key);
    if (existing) existing.push(nb);
    else groups.set(key, [nb]);
  }
  const other: ApiNotebookListItem[] = [];
  const result: NotebookGroup[] = [];
  for (const [label, nbs] of groups) {
    if (nbs.length === 1 || label === 'Other') other.push(...nbs);
    else result.push({ label, notebooks: nbs });
  }
  if (other.length > 0) result.push({ label: 'Other', notebooks: other });
  return result;
}

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
  const [pinnedSlugs] = useState<string[]>(getPinnedSlugs);

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

  const handleOpen = useCallback(
    (slug: string) => launchView('notebook', { slug }),
    [launchView],
  );

  const items = useMemo(() => notebooks ?? [], [notebooks]);

  const pinned = useMemo(() => {
    if (pinnedSlugs.length > 0) {
      return items.filter((nb) => pinnedSlugs.includes(nb.slug));
    }
    return [...items]
      .sort((a, b) => b.object_count - a.object_count)
      .slice(0, 3);
  }, [items, pinnedSlugs]);

  const unpinned = useMemo(
    () => items.filter((nb) => !pinned.some((p) => p.id === nb.id)),
    [items, pinned],
  );

  const groups = useMemo(() => groupNotebooks(unpinned), [unpinned]);

  /* Loading */
  if (loading) {
    return (
      <div className="cp-bookshelf cp-scrollbar">
        <header className="cp-bookshelf-header">
          <h2>Notebooks</h2>
        </header>
        <div className="cp-bookshelf-skeleton-featured">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="cp-bookshelf-skeleton-card">
              <div className="cp-bookshelf-skeleton-book cp-loading-skeleton" />
            </div>
          ))}
        </div>
        <div className="cp-bookshelf-skeleton-shelf">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="cp-bookshelf-skeleton-spine cp-loading-skeleton" />
          ))}
        </div>
      </div>
    );
  }

  /* Error */
  if (error) {
    return (
      <div className="cp-bookshelf">
        <header className="cp-bookshelf-header">
          <h2>Notebooks</h2>
        </header>
        <div className="cp-error-banner" style={{ margin: '0 0 20px' }}>
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

  const createForm = (
    <div className="cp-bookshelf-create-form">
      <input
        type="text"
        value={newName}
        onChange={(e) => setNewName(e.target.value)}
        placeholder="Notebook name"
        autoFocus
        className="cp-input"
        style={{ fontSize: 13 }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleCreate();
          if (e.key === 'Escape') setShowCreate(false);
        }}
      />
      <div className="cp-bookshelf-create-row">
        <label
          style={{
            fontFamily: 'var(--cp-font-mono)',
            fontSize: 10,
            color: 'var(--cp-text-faint)',
          }}
        >
          Color
        </label>
        <input
          type="color"
          value={newColor}
          onChange={(e) => setNewColor(e.target.value)}
          style={{
            width: 24,
            height: 24,
            border: 'none',
            padding: 0,
            cursor: 'pointer',
          }}
        />
      </div>
      <div className="cp-bookshelf-create-actions">
        <button
          type="button"
          className="cp-btn-accent"
          style={{ flex: 1 }}
          onClick={handleCreate}
          disabled={creating || !newName.trim()}
        >
          {creating ? 'Creating...' : 'Create'}
        </button>
        <button
          type="button"
          className="cp-btn-ghost"
          onClick={() => setShowCreate(false)}
        >
          Cancel
        </button>
      </div>
    </div>
  );

  /* Empty */
  if (items.length === 0) {
    return (
      <div className="cp-bookshelf">
        <header className="cp-bookshelf-header">
          <h2>Notebooks</h2>
        </header>
        {showCreate ? createForm : (
          <div className="cp-empty-state">
            <p>No notebooks yet.</p>
            <button
              type="button"
              className="cp-btn-accent"
              onClick={() => setShowCreate(true)}
              style={{ marginTop: 8 }}
            >
              <span className="cp-btn-accent-dot" />
              Create your first notebook
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="cp-bookshelf cp-scrollbar">
      <header className="cp-bookshelf-header">
        <h2>Notebooks</h2>
        <span>{items.length} volumes</span>
      </header>

      {showCreate && createForm}

      {/* Featured section (pinned or top 3 by object count) */}
      {pinned.length > 0 && (
        <section className="cp-bookshelf-featured-section">
          <div className="cp-bookshelf-section-label">Pinned</div>
          <div className="cp-bookshelf-featured-grid">
            {pinned.map((nb) => (
              <FeaturedBook
                key={nb.id}
                notebook={nb}
                onClick={handleOpen}
              />
            ))}
          </div>
        </section>
      )}

      {/* Shelf sections (grouped) */}
      {groups.map((group) => (
        <section key={group.label} className="cp-bookshelf-section">
          <div className="cp-bookshelf-section-label">{group.label}</div>
          <div className="cp-bookshelf-grid-container">
            <div className="cp-bookshelf-grid">
              {group.notebooks.map((nb) => (
                <ShelfBook
                  key={nb.id}
                  notebook={nb}
                  onClick={handleOpen}
                />
              ))}
              {!showCreate && (
                <AddBookButton onClick={() => setShowCreate(true)} />
              )}
            </div>
          </div>
        </section>
      ))}

      {/* If no groups remain (all notebooks are pinned), show a standalone add button */}
      {groups.length === 0 && !showCreate && (
        <section className="cp-bookshelf-section">
          <div className="cp-bookshelf-grid-container">
            <div className="cp-bookshelf-grid">
              <AddBookButton onClick={() => setShowCreate(true)} />
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
