'use client';

import { useCallback, useState } from 'react';

export type HighlightMode = 'none' | 'reasoning' | 'contradictions' | 'provenance' | 'recent';

export interface ExplorerSelectionState {
  /** Currently selected node ID (null = nothing selected) */
  selectedNodeId: string | null;
  /** Whether the structure panel is open */
  structurePanelOpen: boolean;
  /** Active highlight mode for the graph */
  highlightMode: HighlightMode;
  /** Current visualization mode */
  vizMode: 'force' | 'face' | 'cluster';
}

export interface ExplorerSelectionActions {
  selectNode: (nodeId: string | null) => void;
  toggleStructurePanel: () => void;
  setHighlightMode: (mode: HighlightMode) => void;
  setVizMode: (mode: 'force' | 'face' | 'cluster') => void;
  clearSelection: () => void;
}

/**
 * Manages Explorer selection state: which node is selected, which
 * panels are open, highlight mode, and visualization mode.
 *
 * Context panel opens automatically when a node is selected and
 * closes when the selection is cleared.
 */
export function useExplorerSelection(): ExplorerSelectionState & ExplorerSelectionActions {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [structurePanelOpen, setStructurePanelOpen] = useState(false);
  const [highlightMode, setHighlightMode] = useState<HighlightMode>('none');
  const [vizMode, setVizMode] = useState<'force' | 'face' | 'cluster'>('face');

  const selectNode = useCallback((nodeId: string | null) => {
    setSelectedNodeId(nodeId);
  }, []);

  const toggleStructurePanel = useCallback(() => {
    setStructurePanelOpen((prev) => !prev);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedNodeId(null);
  }, []);

  return {
    selectedNodeId,
    structurePanelOpen,
    highlightMode,
    vizMode,
    selectNode,
    toggleStructurePanel,
    setHighlightMode,
    setVizMode,
    clearSelection,
  };
}
