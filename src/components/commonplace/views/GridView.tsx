'use client';

import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { toast } from 'sonner';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  gqlEditItem,
  gqlItems,
  stableNumId,
  type ItemGql,
} from '@/lib/commonplace-graphql';
import { useApiData } from '@/lib/commonplace-api';
import { useCapture } from '@/lib/providers/capture-provider';
import { useSelection } from '@/lib/providers/selection-provider';
import styles from './StructuredDataView.module.css';

const RESIDENCY_COLUMNS = ['local', 'synced', 'hosted'] as const;
const NOCO_URL = process.env.NEXT_PUBLIC_NOCODB_URL;
const columnHelper = createColumnHelper<ItemGql>();

type ViewMode = 'table' | 'board' | 'gallery' | 'nocodb';
const BASE_VIEW_MODES = ['table', 'board', 'gallery'] as const;
const NOCO_VIEW_MODES = ['table', 'board', 'gallery', 'nocodb'] as const;

interface GridViewProps {
  onOpenObject?: (objectRef: number, title?: string) => void;
}

function formatDate(ms: number) {
  if (!Number.isFinite(ms) || ms <= 0) return 'Unknown';
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(ms));
}

function isMedia(item: ItemGql) {
  return (
    item.kind === 'image' ||
    item.kind === 'media' ||
    item.mime?.startsWith('image/') ||
    item.mime?.startsWith('video/')
  );
}

function mediaUrl(item: ItemGql) {
  if (item.source?.startsWith('http')) return item.source;
  if (item.path?.startsWith('http')) return item.path;
  return null;
}

function selectedItemsOnly(items: ItemGql[], selectedItems: Set<string>) {
  if (selectedItems.size === 0) return items;
  return items.filter((item) => selectedItems.has(item.id) || selectedItems.has(String(stableNumId(item.id))));
}

export default function GridView({ onOpenObject }: GridViewProps) {
  const { captureVersion, notifyCaptured } = useCapture();
  const { selectedItems, selectSingle, clearSelection } = useSelection();
  const [mode, setMode] = useState<ViewMode>('table');
  const [editingTitle, setEditingTitle] = useState<Record<string, string>>({});
  const { data: items } = useApiData(() => gqlItems(), [captureVersion]);
  const allItems = useMemo(() => items ?? [], [items]);
  const visibleItems = useMemo(
    () => selectedItemsOnly(allItems, selectedItems),
    [allItems, selectedItems],
  );
  const mediaItems = useMemo(() => visibleItems.filter(isMedia), [visibleItems]);
  const viewModes = NOCO_URL ? NOCO_VIEW_MODES : BASE_VIEW_MODES;
  const selectedCount = selectedItems.size;

  async function saveTitle(item: ItemGql) {
    const title = editingTitle[item.id];
    if (title == null || title.trim() === item.title) return;
    await gqlEditItem({ id: item.id, title: title.trim() || item.title });
    notifyCaptured();
    toast.success('Title saved');
  }

  async function moveResidency(item: ItemGql, residency: string) {
    if (item.residency === residency) return;
    await gqlEditItem({ id: item.id, residency });
    notifyCaptured();
    toast.success('Record moved');
  }

  return (
    <div className={styles.surface}>
      <header className={styles.toolbar}>
        <div>
          <h2 className={styles.title}>Structured Data</h2>
          <p className={styles.meta}>
            {visibleItems.length} records
            {selectedCount > 0 ? ` filtered by ${selectedCount} selected object${selectedCount === 1 ? '' : 's'}` : ''}
          </p>
        </div>
        <Tabs
          value={mode}
          onValueChange={(value) => setMode(value as ViewMode)}
          className={styles.modeTabs}
        >
          <TabsList className={styles.segmented} aria-label="Structured data view">
            {viewModes.map((nextMode) => (
              <TabsTrigger key={nextMode} value={nextMode} className={styles.segment}>
                {nextMode === 'nocodb' ? 'NocoDB' : nextMode[0].toUpperCase() + nextMode.slice(1)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        {selectedCount > 0 && (
          <button type="button" className={styles.secondaryButton} onClick={clearSelection}>
            Clear selection
          </button>
        )}
      </header>

      <section className={styles.body}>
        {mode === 'table' && (
          <RecordTable
            items={visibleItems}
            editingTitle={editingTitle}
            setEditingTitle={setEditingTitle}
            onSaveTitle={saveTitle}
            onSelect={(item) => selectSingle(item.id)}
            onOpenObject={onOpenObject}
          />
        )}
        {mode === 'board' && (
          <RecordBoard
            items={visibleItems}
            onMove={moveResidency}
            onSelect={(item) => selectSingle(item.id)}
            onOpenObject={onOpenObject}
          />
        )}
        {mode === 'gallery' && (
          <MediaGallery
            items={mediaItems}
            onSelect={(item) => selectSingle(item.id)}
            onOpenObject={onOpenObject}
          />
        )}
        {mode === 'nocodb' && <NocoDbFrame items={visibleItems} selectedItems={selectedItems} />}
      </section>
    </div>
  );
}

function RecordTable({
  items,
  editingTitle,
  setEditingTitle,
  onSaveTitle,
  onSelect,
  onOpenObject,
}: {
  items: ItemGql[];
  editingTitle: Record<string, string>;
  setEditingTitle: Dispatch<SetStateAction<Record<string, string>>>;
  onSaveTitle: (item: ItemGql) => Promise<void>;
  onSelect: (item: ItemGql) => void;
  onOpenObject?: (objectRef: number, title?: string) => void;
}) {
  const columns = useMemo(
    () => [
      columnHelper.accessor('title', {
        header: 'Title',
        cell: ({ row }) => {
          const item = row.original;
          return (
            <input
              className={styles.titleInput}
              value={editingTitle[item.id] ?? item.title}
              onChange={(event) =>
                setEditingTitle((prev) => ({ ...prev, [item.id]: event.target.value }))
              }
              onFocus={() => onSelect(item)}
              onBlur={() => void onSaveTitle(item)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') event.currentTarget.blur();
              }}
              aria-label={`Edit title for ${item.title}`}
            />
          );
        },
      }),
      columnHelper.accessor('kind', { header: 'Type' }),
      columnHelper.accessor('residency', { header: 'Residency' }),
      columnHelper.accessor((item) => item.tags.join(', '), {
        id: 'tags',
        header: 'Tags',
      }),
      columnHelper.accessor((item) => formatDate(item.updatedAtMs), {
        id: 'updated',
        header: 'Updated',
      }),
      columnHelper.display({
        id: 'open',
        header: '',
        cell: ({ row }) => (
          <button
            type="button"
            className={styles.linkButton}
            onClick={() => onOpenObject?.(stableNumId(row.original.id), row.original.title)}
          >
            Open
          </button>
        ),
      }),
    ],
    [editingTitle, onOpenObject, onSaveTitle, onSelect, setEditingTitle],
  );
  const table = useReactTable({ data: items, columns, getCoreRowModel: getCoreRowModel() });

  if (items.length === 0) {
    return <EmptyState text="No records are available for this selection." />;
  }

  return (
    <div className={styles.tableScroller}>
      <table className={styles.table}>
        <thead>
          {table.getHeaderGroups().map((group) => (
            <tr key={group.id}>
              {group.headers.map((header) => (
                <th key={header.id}>
                  {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id} onClick={() => onSelect(row.original)}>
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RecordBoard({
  items,
  onMove,
  onSelect,
  onOpenObject,
}: {
  items: ItemGql[];
  onMove: (item: ItemGql, residency: string) => Promise<void>;
  onSelect: (item: ItemGql) => void;
  onOpenObject?: (objectRef: number, title?: string) => void;
}) {
  if (items.length === 0) return <EmptyState text="No records are available for this board." />;

  return (
    <div className={styles.board}>
      {RESIDENCY_COLUMNS.map((column) => {
        const columnItems = items.filter((item) => item.residency === column);
        return (
          <section key={column} className={styles.boardColumn}>
            <div className={styles.boardHeader}>
              <span>{column}</span>
              <span>{columnItems.length}</span>
            </div>
            <div className={styles.boardStack}>
              {columnItems.map((item) => (
                <article key={item.id} className={styles.boardCard} onClick={() => onSelect(item)}>
                  <strong>{item.title}</strong>
                  <span>{item.kind}</span>
                  <div className={styles.cardActions}>
                    {RESIDENCY_COLUMNS.filter((next) => next !== column).map((next) => (
                      <button
                        key={next}
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          void onMove(item, next);
                        }}
                      >
                        Move to {next}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onOpenObject?.(stableNumId(item.id), item.title);
                      }}
                    >
                      Open
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function MediaGallery({
  items,
  onSelect,
  onOpenObject,
}: {
  items: ItemGql[];
  onSelect: (item: ItemGql) => void;
  onOpenObject?: (objectRef: number, title?: string) => void;
}) {
  if (items.length === 0) return <EmptyState text="No media items are available for this selection." />;

  return (
    <div className={styles.gallery}>
      {items.map((item) => {
        const url = mediaUrl(item);
        return (
          <button
            key={item.id}
            type="button"
            className={styles.mediaTile}
            onClick={() => {
              onSelect(item);
              onOpenObject?.(stableNumId(item.id), item.title);
            }}
          >
            {url && item.mime?.startsWith('image/') ? (
              <span
                aria-hidden="true"
                className={styles.mediaPreview}
                style={{ backgroundImage: `url("${url}")` }}
              />
            ) : (
              <span>{item.kind}</span>
            )}
            <strong>{item.title}</strong>
          </button>
        );
      })}
    </div>
  );
}

function NocoDbFrame({
  items,
  selectedItems,
}: {
  items: ItemGql[];
  selectedItems: Set<string>;
}) {
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const frameSrc = useMemo(() => {
    if (!NOCO_URL) return null;
    try {
      const url = new URL(
        NOCO_URL,
        typeof window === 'undefined' ? 'https://commonplace.local' : window.location.href,
      );
      url.searchParams.set('commonplaceApi', '/api/commonplace/rustyred?view=table');
      url.searchParams.set('commonplaceSource', 'items');
      url.searchParams.set('commonplaceView', 'structured-data');
      if (selectedItems.size > 0) url.searchParams.set('commonplaceSelection', [...selectedItems].join(','));
      return url.toString();
    } catch {
      return NOCO_URL;
    }
  }, [selectedItems]);
  const bridgePayload = useMemo(
    () => ({
      type: 'commonplace:nocodb-selection',
      itemIds: items.map((item) => item.id),
      mediaItemIds: items.filter(isMedia).map((item) => item.id),
      selectedItemIds: [...selectedItems],
    }),
    [items, selectedItems],
  );

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame || !frameSrc) return;
    frame.contentWindow?.postMessage(bridgePayload, '*');
  }, [bridgePayload, frameSrc]);

  if (!NOCO_URL) {
    return (
      <EmptyState
        text="NocoDB runtime is not configured. Set NEXT_PUBLIC_NOCODB_URL to mount the NocoDB frontend over the CommonPlace data source contract."
      />
    );
  }

  return (
    <iframe
      ref={frameRef}
      className={styles.nocodbFrame}
      src={frameSrc ?? NOCO_URL}
      title="NocoDB CommonPlace data source"
      onLoad={() => frameRef.current?.contentWindow?.postMessage(bridgePayload, '*')}
      sandbox="allow-forms allow-same-origin allow-scripts allow-popups"
    />
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className={styles.empty}>
      {text}
    </div>
  );
}
