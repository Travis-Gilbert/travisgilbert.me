'use client';

import { useState, useMemo } from 'react';
import type { NotebookObjectCompact } from '@/lib/commonplace';
import TypeLandscape from './TypeLandscape';
import ObjectRow, { assignTier } from './ObjectRow';

type SortKey = 'connected' | 'recent' | 'alpha' | 'type';

export default function NotebookObjectsTab({
  objects,
  onOpenObject,
}: {
  objects: NotebookObjectCompact[];
  onOpenObject?: (objectRef: number, title?: string) => void;
}) {
  const [sortBy, setSortBy] = useState<SortKey>('connected');
  const [typeFilter, setTypeFilter] = useState('all');

  const sorted = useMemo(() => {
    let list = [...objects];
    if (typeFilter !== 'all') {
      list = list.filter((o) => o.object_type === typeFilter);
    }
    switch (sortBy) {
      case 'connected':
        list.sort((a, b) => b.edge_count - a.edge_count);
        break;
      case 'recent':
        list.sort(
          (a, b) =>
            new Date(b.captured_at).getTime() -
            new Date(a.captured_at).getTime(),
        );
        break;
      case 'alpha':
        list.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case 'type':
        list.sort((a, b) => {
          const typeCmp = a.object_type.localeCompare(b.object_type);
          if (typeCmp !== 0) return typeCmp;
          return b.edge_count - a.edge_count;
        });
        break;
    }
    return list;
  }, [objects, sortBy, typeFilter]);

  const maxEdges = useMemo(
    () => Math.max(...objects.map((o) => o.edge_count), 0),
    [objects],
  );

  return (
    <div>
      {/* Type landscape (primary navigation) */}
      <div style={{ padding: '8px 0 0' }}>
        <TypeLandscape
          objects={objects}
          activeFilter={typeFilter}
          onFilter={setTypeFilter}
          totalShown={sorted.length}
        />
      </div>

      {/* Sort control */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '10px 0 6px',
        }}
      >
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortKey)}
          style={{
            padding: '3px 8px',
            fontFamily: 'var(--cp-font-mono)',
            fontSize: 9.5,
            color: 'var(--cp-text-muted)',
            background: 'rgba(242, 236, 224, 0.5)',
            border: '1px solid var(--cp-border)',
            borderRadius: 4,
            cursor: 'pointer',
            outline: 'none',
          }}
        >
          <option value="connected">Most connected</option>
          <option value="recent">Recent</option>
          <option value="alpha">Alphabetical</option>
          <option value="type">Group by type</option>
        </select>
      </div>

      {/* Object list (flat, respects sort order) */}
      <div style={{ paddingBottom: 40 }}>
        {sorted.map((obj) => (
          <ObjectRow
            key={obj.id}
            obj={obj}
            tier={assignTier(obj.edge_count, maxEdges)}
            onOpen={onOpenObject}
          />
        ))}
      </div>

      {/* Empty state */}
      {sorted.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 24px' }}>
          <div
            style={{
              fontFamily: 'var(--cp-font-title)',
              fontSize: 17,
              fontWeight: 600,
              color: 'var(--cp-text-muted)',
              marginBottom: 8,
            }}
          >
            No objects match
          </div>
          <div
            style={{
              fontFamily: 'var(--font-body, IBM Plex Sans, sans-serif)',
              fontSize: 13,
              fontWeight: 300,
              color: 'var(--cp-text-faint)',
              maxWidth: 280,
              margin: '0 auto',
              lineHeight: 1.5,
            }}
          >
            Try a different type filter, or drag objects here to grow this
            collection.
          </div>
        </div>
      )}
    </div>
  );
}
