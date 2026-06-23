'use client';

/**
 * File tree — vendored from 21st.dev (jatin-yadav05/file-tree), adapted for
 * CommonPlace v2:
 *   - colors tokenized to --cp-* (the original used custom classes);
 *   - nodes carry `id` and/or `data` and fire `onActivate` on click (a folder
 *     both toggles AND activates, while a file leaf can open the object);
 *   - a `variant`: 'card' (parchment card, in a pane) or 'rail' (transparent,
 *     dark-sidebar colors) for compact sidebar drawers.
 * The visual language (tree lines, folder/file glyphs, expand chevron) is kept.
 */

import { useState } from 'react';
import { cn } from '@/lib/utils';

export interface FileNode {
  name: string;
  type: 'file' | 'folder';
  children?: FileNode[];
  extension?: string;
  /** Item id for a file leaf (used by onActivate to open the object). */
  id?: string;
  /** Arbitrary payload (e.g. a nav target) carried by the node. */
  data?: unknown;
}

type Variant = 'card' | 'rail';

interface Palette {
  text: string;
  muted: string;
  hover: string;
  line: string;
  folder: string;
  accent: string;
}

function paletteFor(variant: Variant): Palette {
  return variant === 'rail'
    ? {
        text: 'var(--cp-sidebar-text)',
        muted: 'var(--cp-sidebar-text-muted)',
        hover: 'var(--cp-sidebar-surface-hover)',
        line: 'var(--cp-sidebar-border)',
        folder: 'var(--cp-gold)',
        accent: 'var(--cp-red)',
      }
    : {
        text: 'var(--cp-text)',
        muted: 'var(--cp-text-muted)',
        hover: 'var(--cp-surface-hover)',
        line: 'var(--cp-border-faint)',
        folder: 'var(--cp-gold)',
        accent: 'var(--cp-red)',
      };
}

const FILE_ICONS: Record<string, { color: string; icon: string }> = {
  css: { color: 'oklch(0.62 0.11 235)', icon: '◈' },
  note: { color: 'oklch(0.7 0.02 70)', icon: '◇' },
  file: { color: 'oklch(0.68 0.03 90)', icon: '◇' },
  source: { color: 'oklch(0.62 0.07 220)', icon: '◈' },
  js: { color: 'oklch(0.78 0.16 92)', icon: '◈' },
  json: { color: 'oklch(0.7 0.09 150)', icon: '◌' },
  jsx: { color: 'oklch(0.68 0.1 220)', icon: '◈' },
  link: { color: 'oklch(0.62 0.07 220)', icon: '◐' },
  image: { color: 'oklch(0.7 0.12 160)', icon: '◑' },
  doc: { color: 'oklch(0.66 0.1 280)', icon: '◉' },
  docx: { color: 'oklch(0.66 0.1 280)', icon: '◉' },
  md: { color: 'var(--cp-sidebar-text-muted)', icon: '◊' },
  markdown: { color: 'var(--cp-sidebar-text-muted)', icon: '◊' },
  pdf: { color: 'oklch(0.65 0.16 25)', icon: '◍' },
  ts: { color: 'oklch(0.62 0.11 250)', icon: '◈' },
  tsx: { color: 'oklch(0.62 0.11 250)', icon: '◈' },
  txt: { color: 'oklch(0.7 0.02 70)', icon: '◇' },
};

function fileIconFor(extension: string | undefined, fallback: string) {
  return FILE_ICONS[(extension || '').toLowerCase()] || { color: fallback, icon: '◇' };
}

interface FileItemProps {
  node: FileNode;
  depth: number;
  pal: Palette;
  onActivate?: (node: FileNode) => void;
}

function FileItem({ node, depth, pal, onActivate }: FileItemProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [isHovered, setIsHovered] = useState(false);

  const isFolder = node.type === 'folder';
  const hasChildren = isFolder && node.children && node.children.length > 0;
  const icon = fileIconFor(node.extension, pal.muted);

  return (
    <div className="select-none">
      <div
        className="group relative flex items-center gap-2 rounded-md px-2 py-1 cursor-pointer transition-colors duration-200 ease-out"
        onClick={() => {
          if (isFolder) setIsOpen(!isOpen);
          onActivate?.(node);
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{ paddingLeft: `${depth * 14 + 8}px`, background: isHovered ? pal.hover : 'transparent' }}
      >
        {depth > 0 && (
          <div className="absolute top-0 bottom-0 flex" style={{ left: `${(depth - 1) * 14 + 15}px` }}>
            <div className="w-px transition-colors duration-200" style={{ background: isHovered ? pal.accent : pal.line }} />
          </div>
        )}

        <div className={cn('flex h-4 w-4 items-center justify-center transition-transform duration-200 ease-out', isFolder && isOpen && 'rotate-90')}>
          {isFolder ? (
            <svg width="6" height="8" viewBox="0 0 6 8" fill="none" style={{ color: isHovered ? pal.accent : pal.muted }}>
              <path d="M1 1L5 4L1 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : (
            <span className="text-xs" style={{ color: icon.color }}>{icon.icon}</span>
          )}
        </div>

        <div className="flex h-4 w-4 items-center justify-center transition-all duration-200" style={{ color: isFolder ? pal.folder : icon.color, opacity: isHovered ? 1 : 0.82 }}>
          {isFolder ? (
            <svg width="15" height="13" viewBox="0 0 16 14" fill="currentColor">
              <path d="M1.5 1C0.671573 1 0 1.67157 0 2.5V11.5C0 12.3284 0.671573 13 1.5 13H14.5C15.3284 13 16 12.3284 16 11.5V4.5C16 3.67157 15.3284 3 14.5 3H8L6.5 1H1.5Z" />
            </svg>
          ) : (
            <svg width="12" height="14" viewBox="0 0 14 16" fill="currentColor" opacity="0.85">
              <path d="M1.5 0C0.671573 0 0 0.671573 0 1.5V14.5C0 15.3284 0.671573 16 1.5 16H12.5C13.3284 16 14 15.3284 14 14.5V4.5L9.5 0H1.5Z" />
              <path d="M9 0V4.5H14" fill="currentColor" fillOpacity="0.5" />
            </svg>
          )}
        </div>

        <span
          className="truncate font-mono text-[13px] transition-colors duration-200"
          style={{ color: isFolder ? pal.text : isHovered ? pal.text : pal.muted }}
        >
          {node.name}
        </span>
      </div>

      {hasChildren && (
        <div
          className="overflow-hidden transition-all duration-300 ease-out"
          style={{ maxHeight: isOpen ? `${node.children!.length * 320 + 80}px` : '0px', opacity: isOpen ? 1 : 0 }}
        >
          {node.children!.map((child, index) => (
            <FileItem key={`${child.type}:${child.name}:${child.id ?? index}`} node={child} depth={depth + 1} pal={pal} onActivate={onActivate} />
          ))}
        </div>
      )}
    </div>
  );
}

interface FileTreeProps {
  data: FileNode[];
  className?: string;
  label?: string;
  variant?: Variant;
  emptyHint?: string;
  onActivate?: (node: FileNode) => void;
}

export function FileTree({ data, className, label = 'explorer', variant = 'card', emptyHint, onActivate }: FileTreeProps) {
  const pal = paletteFor(variant);
  const isCard = variant === 'card';

  return (
    <div
      className={cn('font-mono', isCard && 'rounded-lg p-3', className)}
      style={isCard ? { background: 'var(--cp-surface)', border: '1px solid var(--cp-border)' } : undefined}
    >
      {isCard ? (
        <div className="mb-2 flex items-center gap-2 border-b pb-3" style={{ borderColor: 'var(--cp-border-faint)' }}>
          <div className="flex gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full" style={{ background: 'oklch(0.65 0.2 25)' }} />
            <div className="h-2.5 w-2.5 rounded-full" style={{ background: 'oklch(0.75 0.18 85)' }} />
            <div className="h-2.5 w-2.5 rounded-full" style={{ background: 'oklch(0.65 0.18 150)' }} />
          </div>
          <span className="ml-2 text-xs" style={{ color: pal.muted }}>{label}</span>
        </div>
      ) : label ? (
        <div className="px-2 pb-1 font-mono text-[10px] uppercase tracking-[0.14em]" style={{ color: pal.muted }}>{label}</div>
      ) : null}

      <div className="space-y-0.5">
        {data.length === 0 ? (
          <div className="px-2 py-4 text-center text-xs" style={{ color: pal.muted, opacity: 0.7 }}>
            {emptyHint ?? 'No files yet.'}
          </div>
        ) : (
          data.map((node, index) => (
            <FileItem key={`${node.type}:${node.name}:${node.id ?? index}`} node={node} depth={0} pal={pal} onActivate={onActivate} />
          ))
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────
   Build a folder tree from items' auto-structured paths (used by the full-pane
   FilesView). Folders come from path segments; the last segment is the item's
   own slug, so the leaf shows the item title and carries its id for selection.
   ───────────────────────────────────────────────── */

export interface TreeItem {
  id: string;
  title: string;
  kind: string;
  mime?: string | null;
  path?: string | null;
}

function extensionFromName(value: string | null | undefined): string | undefined {
  const match = value?.trim().match(/\.([a-z0-9]+)$/i);
  return match?.[1]?.toLowerCase();
}

function extensionFromMime(mime: string | null | undefined): string | undefined {
  switch (mime) {
    case 'application/javascript':
    case 'text/javascript':
      return 'js';
    case 'application/json':
      return 'json';
    case 'application/pdf':
      return 'pdf';
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      return 'docx';
    case 'application/msword':
      return 'doc';
    case 'text/css':
      return 'css';
    case 'text/markdown':
      return 'md';
    case 'text/plain':
      return 'txt';
    default:
      return undefined;
  }
}

function itemExtension(item: TreeItem): string {
  return (
    extensionFromName(item.path) ??
    extensionFromName(item.title) ??
    extensionFromMime(item.mime) ??
    item.kind
  );
}

export function buildItemTree(items: TreeItem[]): FileNode[] {
  const root: FileNode = { name: 'root', type: 'folder', children: [] };
  for (const item of items) {
    const segments = (item.path || '').split('/').filter(Boolean);
    const folders = segments.slice(0, -1);
    let cursor = root;
    for (const folder of folders) {
      let next = cursor.children!.find((c) => c.type === 'folder' && c.name === folder);
      if (!next) {
        next = { name: folder, type: 'folder', children: [] };
        cursor.children!.push(next);
      }
      cursor = next;
    }
    cursor.children!.push({ name: item.title || 'Untitled', type: 'file', extension: itemExtension(item), id: item.id });
  }
  const sortRec = (node: FileNode) => {
    if (!node.children) return;
    node.children.sort((a, b) => (a.type !== b.type ? (a.type === 'folder' ? -1 : 1) : a.name.localeCompare(b.name)));
    node.children.forEach(sortRec);
  };
  sortRec(root);
  return root.children ?? [];
}
