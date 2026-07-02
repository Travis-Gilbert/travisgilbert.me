'use client';

/**
 * The sidebar's Files drawer: a literal filesystem root rendered inside the
 * icon-first product sidebar.
 */

import { useCallback, useEffect, useMemo, useState, type FormEvent, type MouseEvent } from 'react';
import { FolderPlus } from 'iconoir-react';
import { FileTree, buildItemTree, type FileNode } from '@/components/ui/file-tree';
import { useApiData } from '@/lib/commonplace-api';
import { gqlItems } from '@/lib/commonplace-graphql';
import { useCapture } from '@/lib/providers/capture-provider';
import { useDrawer } from '@/lib/providers/drawer-provider';

const FOLDER_STORAGE_KEY = 'cp-sidebar-file-folders';

interface StoredFolder {
  id: string;
  name: string;
}

interface SidebarTreeProps {
  isOpen: boolean;
  isActive: boolean;
  onToggle: () => void;
  onOpenFiles: (event: MouseEvent<HTMLButtonElement>) => void;
}

function readStoredFolders(): StoredFolder[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(FOLDER_STORAGE_KEY) ?? '[]') as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((entry): StoredFolder[] => {
      if (
        typeof entry === 'object' &&
        entry !== null &&
        'id' in entry &&
        'name' in entry &&
        typeof entry.id === 'string' &&
        typeof entry.name === 'string'
      ) {
        return [{ id: entry.id, name: entry.name }];
      }
      return [];
    });
  } catch {
    return [];
  }
}

function newFolderId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `folder-${Date.now()}`;
}

function folderNodes(folders: StoredFolder[]): FileNode[] {
  return folders.map((folder) => ({
    id: folder.id,
    name: folder.name,
    type: 'folder',
    children: [],
  }));
}

export default function SidebarTree({ isOpen, isActive, onToggle, onOpenFiles }: SidebarTreeProps) {
  const { captureVersion } = useCapture();
  const { openDrawer } = useDrawer();
  const { data: items } = useApiData(() => gqlItems(), [captureVersion]);
  const [folders, setFolders] = useState<StoredFolder[]>([]);
  const [foldersLoaded, setFoldersLoaded] = useState(false);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [rootHovered, setRootHovered] = useState(false);
  const tree = useMemo(() => [...folderNodes(folders), ...buildItemTree(items ?? [])], [folders, items]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setFolders(readStoredFolders());
      setFoldersLoaded(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!foldersLoaded) return;
    try {
      window.localStorage.setItem(FOLDER_STORAGE_KEY, JSON.stringify(folders));
    } catch {
      // Local sidebar folders are best-effort until the GraphQL folder model lands.
    }
  }, [folders, foldersLoaded]);

  const handleCreateFolder = useCallback((event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = folderName.trim();
    if (!name) return;
    setFolders((current) => [
      ...current,
      {
        id: newFolderId(),
        name,
      },
    ]);
    setFolderName('');
    setIsCreatingFolder(false);
  }, [folderName]);

  const handleRootClick = useCallback((event: MouseEvent<HTMLButtonElement>) => {
    onToggle();
    onOpenFiles(event);
  }, [onOpenFiles, onToggle]);

  const handleNewFolder = useCallback((event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (!isOpen) onToggle();
    setIsCreatingFolder(true);
  }, [isOpen, onToggle]);

  return (
    <div className="mb-1 mt-1 font-mono">
      <div
        onMouseEnter={() => setRootHovered(true)}
        onMouseLeave={() => setRootHovered(false)}
        style={{
          width: '100%',
          minHeight: 36,
          borderRadius: 8,
          background: isActive || rootHovered ? 'var(--cp-sidebar-surface-hover)' : 'transparent',
          color: 'var(--cp-sidebar-text)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 5px 0 0',
          transition: 'background-color 160ms ease, color 160ms ease',
        }}
      >
        <button
          type="button"
          aria-expanded={isOpen}
          onClick={handleRootClick}
          style={{
            minWidth: 0,
            flex: 1,
            minHeight: 36,
            border: 'none',
            background: 'transparent',
            color: 'inherit',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '7px 4px 7px 11px',
            textAlign: 'left',
          }}
        >
        <span
          style={{
            width: 16,
            height: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: rootHovered ? 'var(--cp-sidebar-text)' : 'var(--cp-sidebar-text-muted)',
            transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
            transition: 'transform 180ms ease, color 180ms ease',
            flexShrink: 0,
          }}
        >
          <svg width="6" height="8" viewBox="0 0 6 8" fill="none">
            <path d="M1 1L5 4L1 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <span
          style={{
            width: 18,
            height: 16,
            color: 'var(--cp-gold)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <svg width="16" height="14" viewBox="0 0 16 14" fill="currentColor">
            <path d="M1.5 1C0.671573 1 0 1.67157 0 2.5V11.5C0 12.3284 0.671573 13 1.5 13H14.5C15.3284 13 16 12.3284 16 11.5V4.5C16 3.67157 15.3284 3 14.5 3H8L6.5 1H1.5Z" />
          </svg>
        </span>
        <span
          style={{
            flex: 1,
            fontSize: 13,
            lineHeight: 1.2,
            color: 'var(--cp-sidebar-text)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          Files
        </span>
        </button>
        <button
          type="button"
          aria-label="New folder"
          title="New folder"
          onClick={handleNewFolder}
          style={{
            width: 24,
            height: 24,
            border: 'none',
            borderRadius: 5,
            background: 'transparent',
            color: 'var(--cp-sidebar-text-muted)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          <FolderPlus width={15} height={15} strokeWidth={1.7} />
        </button>
      </div>

      {isOpen && (
        <div style={{ padding: '4px 0 8px 20px' }}>
          {isCreatingFolder && (
            <form onSubmit={handleCreateFolder} style={{ padding: '2px 8px 5px 22px' }}>
              <input
                value={folderName}
                onChange={(event) => setFolderName(event.currentTarget.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') {
                    setFolderName('');
                    setIsCreatingFolder(false);
                  }
                }}
                placeholder="Folder name"
                autoFocus
                style={{
                  width: '100%',
                  border: '1px solid var(--cp-sidebar-border)',
                  borderRadius: 5,
                  background: 'rgba(255, 255, 255, 0.04)',
                  color: 'var(--cp-sidebar-text)',
                  fontFamily: 'var(--cp-font-mono)',
                  fontSize: 12,
                  padding: '5px 7px',
                  outline: 'none',
                }}
              />
            </form>
          )}
          <FileTree
            data={tree}
            variant="rail"
            label=""
            emptyHint="No files yet."
            onActivate={(node) => {
              if (node.type === 'file' && node.id) openDrawer(node.id);
            }}
          />
        </div>
      )}
    </div>
  );
}
