'use client';

/**
 * Files (full-pane): a filesystem view of the CommonPlace, derived from each
 * item's auto-structured `path`. The same tree also lives in the sidebar as the
 * primary navigator (SidebarTree); this card variant is the expanded pane view.
 */

import { useMemo } from 'react';
import { FileTree, buildItemTree } from '@/components/ui/file-tree';
import { useApiData } from '@/lib/commonplace-api';
import { gqlItems } from '@/lib/commonplace-graphql';
import { useCapture } from '@/lib/providers/capture-provider';
import { useDrawer } from '@/lib/providers/drawer-provider';

export default function FilesView() {
  const { captureVersion } = useCapture();
  const { openDrawer } = useDrawer();
  const { data: items } = useApiData(() => gqlItems(), [captureVersion]);
  const tree = useMemo(() => buildItemTree(items ?? []), [items]);

  return (
    <div className="h-full overflow-auto p-4">
      <div className="mx-auto max-w-2xl">
        <FileTree
          data={tree}
          label="commonplace"
          variant="card"
          emptyHint="No files yet. Capture something and it will be filed here."
          onActivate={(node) => {
            if (node.type === 'file' && node.id) openDrawer(node.id);
          }}
        />
      </div>
    </div>
  );
}
