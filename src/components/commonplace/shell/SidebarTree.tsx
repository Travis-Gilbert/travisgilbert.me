'use client';

/**
 * The sidebar's Files drawer: the same literal file tree used by the full
 * Files view, rendered compactly inside the icon-first product sidebar.
 */

import { useMemo } from 'react';
import { FileTree, buildItemTree } from '@/components/ui/file-tree';
import { useApiData } from '@/lib/commonplace-api';
import { gqlItems } from '@/lib/commonplace-graphql';
import { useCapture } from '@/lib/providers/capture-provider';
import { useDrawer } from '@/lib/providers/drawer-provider';

export default function SidebarTree() {
  const { captureVersion } = useCapture();
  const { openDrawer } = useDrawer();
  const { data: items } = useApiData(() => gqlItems(), [captureVersion]);
  const tree = useMemo(() => buildItemTree(items ?? []), [items]);

  return (
    <div className="mt-3 mb-1">
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
  );
}
