'use client';

import { useMemo } from 'react';
import { FileSystem, type FileSystemItem } from '@/components/ui/file-system';
import { useApiData } from '@/lib/commonplace-api';
import { gqlItems, type ItemGql } from '@/lib/commonplace-graphql';
import { useCapture } from '@/lib/providers/capture-provider';
import { useDrawer } from '@/lib/providers/drawer-provider';
import { useSelection } from '@/lib/providers/selection-provider';
import FileItemViewer from './FileItemViewer';
import styles from './FileItemViewer.module.css';

function normalizeObjectPath(path: string | null | undefined): string | null {
  const clean = path?.trim().replace(/^\/+/, '').replace(/\/+$/, '');
  return clean || null;
}

function pathSegment(value: string): string {
  return (
    value
      .trim()
      .replace(/^\/+|\/+$/g, '')
      .replace(/[/\\?#]+/g, '-')
      .replace(/\s+/g, ' ')
      .slice(0, 96) || 'untitled'
  );
}

function pathName(path: string): string {
  const index = path.lastIndexOf('/');
  return index === -1 ? path : path.slice(index + 1);
}

function filePathFor(item: ItemGql): string {
  const existingPath = normalizeObjectPath(item.path);
  if (existingPath) return existingPath;

  const folder = pathSegment(item.collections[0] ?? item.kind ?? 'items');
  const name = pathSegment(item.title || item.id);
  return `${folder}/${name}`;
}

function metadataFor(item: ItemGql): Record<string, string> {
  return Object.fromEntries(
    [
      ['Kind', item.kind],
      ['Residency', item.residency],
      ['Source', item.source ?? ''],
      ['Classification', item.classification ?? ''],
      ['Tags', item.tags.join(', ')],
    ].filter(([, value]) => value),
  );
}

function isoFromMs(ms: number): string | undefined {
  return ms ? new Date(ms).toISOString() : undefined;
}

function publicUrl(item: ItemGql): string | undefined {
  if (item.source?.startsWith('http')) return item.source;
  if (item.path?.startsWith('http')) return item.path;
  return undefined;
}

function toFileSystemItem(item: ItemGql): FileSystemItem {
  const path = filePathFor(item);
  const url = publicUrl(item);
  return {
    kind: 'file',
    id: item.id,
    key: item.blobHash ?? item.id,
    path,
    name: item.title || pathName(path),
    contentType: item.mime ?? undefined,
    url,
    previewImageUrl: item.mime?.startsWith('image/') ? url ?? null : null,
    createdAt: isoFromMs(item.createdAtMs),
    updatedAt: isoFromMs(item.updatedAtMs),
    metadata: metadataFor(item),
  };
}

export default function FilesView() {
  const { captureVersion, notifyCaptured } = useCapture();
  const { openDrawer } = useDrawer();
  const { selectedItems, selectSingle } = useSelection();
  const { data: items } = useApiData(() => gqlItems(), [captureVersion]);
  const allItems = useMemo(() => items ?? [], [items]);
  const itemById = useMemo(() => new Map(allItems.map((item) => [item.id, item])), [allItems]);
  const selectedItem = useMemo(() => {
    const selectedId = [...selectedItems].find((id) => itemById.has(id));
    return selectedId ? itemById.get(selectedId) ?? null : allItems[0] ?? null;
  }, [allItems, itemById, selectedItems]);
  const fileItems = useMemo(() => allItems.map(toFileSystemItem), [allItems]);

  return (
    <div className={styles.filesSurface}>
      <div className={styles.treePane}>
        <FileSystem
          items={fileItems}
          title="Commonplace"
          defaultView="columns"
          className="h-full"
          onSelectionChange={(entry) => {
            if (entry?.kind === 'file' && entry.id) selectSingle(entry.id);
          }}
          onFileOpen={(file) => {
            if (file.id) selectSingle(file.id);
          }}
        />
      </div>
      <aside className={styles.previewPane} aria-label="Item preview">
        <FileItemViewer
          item={selectedItem}
          onOpenObject={(id) => openDrawer(id)}
          onSaved={notifyCaptured}
        />
      </aside>
    </div>
  );
}
