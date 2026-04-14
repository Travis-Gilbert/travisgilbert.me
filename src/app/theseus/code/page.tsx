import type { Metadata } from 'next';
import { Suspense } from 'react';
import CodeExplorer from '@/components/theseus/code/CodeExplorer';

export const metadata: Metadata = {
  title: 'Code Explorer | Theseus',
  description:
    'Graph-native code intelligence: impact analysis, drift detection, and fix patterns across your codebase.',
};

/**
 * /theseus/code renders CodeExplorer.
 *
 * The existing Code Workshop (editor UI) is still available at
 * /theseus?view=code via PanelManager. These two surfaces coexist:
 * CodeExplorer is the graph-intelligence view, CodeWorkshop is the
 * editor view. The sidebar entry "Code" navigates here.
 */
export default function CodeExplorerPage() {
  return (
    <Suspense>
      <CodeExplorer />
    </Suspense>
  );
}
