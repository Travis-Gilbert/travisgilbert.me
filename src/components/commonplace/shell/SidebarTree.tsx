'use client';

/**
 * The sidebar's Files drawer: the category file tree. It renders the file-tree
 * taxonomy as folders/leaves while the product sidebar remains the icon-first
 * domain navigator.
 */

import { useMemo } from 'react';
import { FileTree, type FileNode } from '@/components/ui/file-tree';
import { FILE_TREE_SECTIONS, type SidebarItem } from '@/lib/commonplace';
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
  return FILE_TREE_SECTIONS.filter((s) => s.title !== 'Capture').flatMap((s) =>
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
