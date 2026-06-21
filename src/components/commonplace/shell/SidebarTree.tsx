'use client';

/**
 * The sidebar's primary navigator: the category file tree. It renders the
 * original bar's categories (Home, Library, Models, Artifacts, Notebooks,
 * Projects, Timeline, Map, System) AS a file tree -- folders for expandable
 * categories, files for leaves -- and navigates exactly like the old bar did
 * (a folder both expands and navigates). The "auto-organizer" primitive that
 * files actual items under these categories is Travis's to define later; this
 * renders the taxonomy the categories declare.
 */

import { useMemo } from 'react';
import { FileTree, type FileNode } from '@/components/ui/file-tree';
import { SIDEBAR_SECTIONS, type SidebarItem } from '@/lib/commonplace';
import { useLayout } from '@/lib/providers/layout-provider';

function itemToNode(item: SidebarItem): FileNode {
  // An expandable category is a folder even when it has no children yet (e.g.
  // Library, which the auto-organizer fills), so it shows the folder glyph.
  const isFolder = !!item.expandable;
  return {
    name: item.label,
    type: isFolder ? 'folder' : 'file',
    children: isFolder ? (item.children ?? []).map(itemToNode) : undefined,
    data: item,
  };
}

/** All non-Capture categories, flattened into one tree (matches the bar). */
function categoryNodes(): FileNode[] {
  return SIDEBAR_SECTIONS.filter((s) => s.title !== 'Capture').flatMap((s) =>
    s.items.map(itemToNode),
  );
}

export default function SidebarTree() {
  const { launchView, navigateToScreen } = useLayout();
  const tree = useMemo(() => categoryNodes(), []);

  const activate = (node: FileNode) => {
    const item = node.data as SidebarItem | undefined;
    if (!item) return;
    if (item.mode === 'screen' && item.screenType) {
      navigateToScreen(item.screenType);
    } else if (item.viewType) {
      launchView(item.viewType, item.viewContext);
    }
  };

  return (
    <div className="mt-3 mb-1">
      <FileTree data={tree} variant="rail" label="" onActivate={activate} />
    </div>
  );
}
