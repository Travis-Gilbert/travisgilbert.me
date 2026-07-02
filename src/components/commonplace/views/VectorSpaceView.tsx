'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState } from 'react';
import {
  gqlEmbeddingSpace,
  gqlVectorNeighbors,
  stableNumId,
  type EmbeddingSpaceRowGql,
  type VectorNeighborGql,
} from '@/lib/commonplace-graphql';
import { useApiData } from '@/lib/commonplace-api';
import {
  categoryLabels,
  ingestCommonPlaceEmbeddingSpace,
} from '@/lib/commonplace-embedding-space';
import { useSelection } from '@/lib/providers/selection-provider';
import styles from './VectorSpaceView.module.css';

const AtlasCanvas = dynamic(() => import('./VectorSpaceAtlasCanvas'), {
  ssr: false,
  loading: () => <div className={styles.canvasLoading}>Loading atlas</div>,
});

interface VectorSpaceViewProps {
  onOpenObject?: (objectRef: number, title?: string) => void;
  limit?: number;
}

function titleFromText(row: EmbeddingSpaceRowGql): string {
  return row.text.split(/\s+/).slice(0, 7).join(' ') || row.identifier;
}

function scoreLabel(score: number): string {
  if (!Number.isFinite(score)) return 'semantic neighbor';
  return `${Math.round(score * 100)}% semantic`;
}

export default function VectorSpaceView({
  onOpenObject,
  limit = 5_000,
}: VectorSpaceViewProps) {
  const { selectedItems, selectSingle, clearSelection } = useSelection();
  const [query, setQuery] = useState('');
  const [mosaicState, setMosaicState] = useState<{ key: string; error: string | null }>({
    key: '',
    error: null,
  });
  const [selectedIdentifier, setSelectedIdentifier] = useState<string | null>(null);
  const [neighborsState, setNeighborsState] = useState<{ key: string; items: VectorNeighborGql[] }>({
    key: '',
    items: [],
  });

  const { data, loading, error, refetch } = useApiData(
    () => gqlEmbeddingSpace({ limit }),
    [limit],
  );
  const rows = useMemo(() => data?.rows ?? [], [data]);
  const selectedRowIds = useMemo(
    () => new Set(rows.map((row) => row.identifier).filter((id) => selectedItems.has(id))),
    [rows, selectedItems],
  );
  const scopedRows = useMemo(
    () => (selectedRowIds.size > 0 ? rows.filter((row) => selectedRowIds.has(row.identifier)) : rows),
    [rows, selectedRowIds],
  );

  const visibleRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return scopedRows;
    return scopedRows.filter((row) =>
      `${row.identifier} ${row.text} ${row.categoryLabel} ${row.communityId} ${row.epistemicStatus}`
        .toLowerCase()
        .includes(q),
    );
  }, [query, scopedRows]);
  const externallySelectedIdentifier = useMemo(
    () => rows.find((row) => selectedItems.has(row.identifier))?.identifier ?? null,
    [rows, selectedItems],
  );
  const currentSelectedIdentifier = externallySelectedIdentifier ?? selectedIdentifier;

  const selectedRow = useMemo(
    () => rows.find((row) => row.identifier === currentSelectedIdentifier) ?? null,
    [currentSelectedIdentifier, rows],
  );

  const labels = useMemo(() => categoryLabels(visibleRows), [visibleRows]);
  const visibleKey = useMemo(
    () => visibleRows.map((row) => row.identifier).join('\u0000'),
    [visibleRows],
  );
  const effectiveSelectedIdentifier = selectedRow ? currentSelectedIdentifier : null;
  const neighbors = useMemo(
    () =>
      effectiveSelectedIdentifier && neighborsState.key === effectiveSelectedIdentifier
        ? neighborsState.items
        : [],
    [effectiveSelectedIdentifier, neighborsState.items, neighborsState.key],
  );
  const highlightedIdentifiers = useMemo(
    () => neighbors.map((hit) => hit.row.identifier),
    [neighbors],
  );
  const mosaicReady = visibleRows.length > 0 && mosaicState.key === visibleKey && !mosaicState.error;
  const mosaicError = mosaicState.key === visibleKey ? mosaicState.error : null;

  useEffect(() => {
    if (visibleRows.length === 0) {
      return undefined;
    }
    let cancelled = false;
    ingestCommonPlaceEmbeddingSpace(visibleRows)
      .then(() => {
        if (!cancelled) setMosaicState({ key: visibleKey, error: null });
      })
      .catch((err) => {
        if (!cancelled) {
          setMosaicState({
            key: visibleKey,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [visibleRows, visibleKey]);

  useEffect(() => {
    if (!effectiveSelectedIdentifier) {
      return undefined;
    }
    let cancelled = false;
    gqlVectorNeighbors(effectiveSelectedIdentifier, 8)
      .then((result) => {
        if (!cancelled) {
          setNeighborsState({ key: effectiveSelectedIdentifier, items: result });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setNeighborsState({ key: effectiveSelectedIdentifier, items: [] });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [effectiveSelectedIdentifier]);

  const openRow = (row: EmbeddingSpaceRowGql) => {
    onOpenObject?.(stableNumId(row.identifier), titleFromText(row));
  };

  const selectRow = (identifier: string | null) => {
    setSelectedIdentifier(identifier);
    if (identifier) selectSingle(identifier);
    else clearSelection();
  };

  if (loading) {
    return (
      <div className={styles.vectorSpace}>
        <div className={styles.toolbar}>
          <div className={styles.titleBlock}>
            <div className={styles.title}>Vector Space</div>
            <div className={styles.meta}>Loading stored embeddings</div>
          </div>
        </div>
        <div className={styles.canvasFrame}>
          <div className={styles.canvasLoading}>Loading embedding space</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.vectorSpace}>
        <div className={styles.toolbar}>
          <div className={styles.titleBlock}>
            <div className={styles.title}>Vector Space</div>
            <div className={styles.meta}>Backend unavailable</div>
          </div>
        </div>
        <div className={styles.empty}>
          <div>
            <p>Could not load the embedding space.</p>
            <button type="button" className={styles.openButton} onClick={refetch}>
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className={styles.vectorSpace}>
        <div className={styles.toolbar}>
          <div className={styles.titleBlock}>
            <div className={styles.title}>Vector Space</div>
            <div className={styles.meta}>No stored embeddings yet</div>
          </div>
        </div>
        <div className={styles.empty}>
          Capture or ingest items through the RustyRed backend to populate the embedding atlas.
        </div>
      </div>
    );
  }

  return (
    <div className={styles.vectorSpace}>
      <div className={styles.toolbar}>
        <div className={styles.titleBlock}>
          <div className={styles.title}>Vector Space</div>
          <div className={styles.meta}>
            {visibleRows.length} of {data?.total ?? rows.length} embedded items · {data?.projection ?? 'server projection'}
            {mosaicError ? ' · direct atlas fallback' : ''}
          </div>
        </div>
        <input
          className={styles.search}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search embeddings"
          aria-label="Search embeddings"
        />
      </div>

      <div className={styles.body}>
        <div className={styles.canvasFrame}>
          {visibleRows.length > 0 ? (
            <AtlasCanvas
              rows={visibleRows}
              mosaicReady={mosaicReady}
              selectedIdentifier={effectiveSelectedIdentifier}
              highlightedIdentifiers={highlightedIdentifiers}
              onSelect={selectRow}
            />
          ) : (
            <div className={styles.empty}>No embedded items match this search.</div>
          )}
        </div>

        <aside className={styles.sideRail} aria-label="Selected embedding">
          <div className={styles.railSection}>
            <div className={styles.railLabel}>Selected</div>
            {selectedRow ? (
              <>
                <h2 className={styles.selectedTitle}>{titleFromText(selectedRow)}</h2>
                <p className={styles.selectedText}>{selectedRow.text}</p>
                <div className={styles.tagRow}>
                  <span className={styles.tag}>{selectedRow.categoryLabel}</span>
                  <span className={styles.tag}>{selectedRow.epistemicStatus}</span>
                  <span className={styles.tag}>{selectedRow.communityId}</span>
                </div>
                <button
                  type="button"
                  className={styles.openButton}
                  onClick={() => openRow(selectedRow)}
                >
                  Open object
                </button>
              </>
            ) : (
              <p className={styles.selectedText}>
                Select a point to inspect its stored text and nearest semantic neighbors.
              </p>
            )}
          </div>

          <div className={styles.railSection}>
            <div className={styles.railLabel}>Clusters</div>
            <div className={styles.tagRow}>
              {labels.slice(0, 12).map((label) => (
                <span key={label} className={styles.tag}>{label}</span>
              ))}
            </div>
          </div>

          <div className={styles.railSection} style={{ flex: 1, minHeight: 0 }}>
            <div className={styles.railLabel}>Nearest</div>
            <div className={`${styles.neighborList} cp-scrollbar`}>
              {neighbors.length > 0 ? neighbors.map((hit) => (
                <button
                  key={hit.row.identifier}
                  type="button"
                  className={styles.neighbor}
                  onClick={() => selectRow(hit.row.identifier)}
                >
                  <strong>{titleFromText(hit.row)}</strong>
                  <span>{scoreLabel(hit.score)}</span>
                </button>
              )) : (
                <p className={styles.selectedText}>No neighbor selected yet.</p>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
