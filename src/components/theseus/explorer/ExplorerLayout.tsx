'use client';

import { useCallback, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useExplorerSelection } from './useExplorerSelection';
import type { HighlightMode } from './useExplorerSelection';
import StructurePanel from './StructurePanel';
import ContextPanel from './ContextPanel';
import ControlDock from './ControlDock';
import StatusStrip from './StatusStrip';

interface ExplorerLayoutProps {
  children: React.ReactNode;
  /** Called when a node is selected via the graph. The graph renderers
   *  call this; the Explorer layout manages the panel state. */
  onNodeSelect?: (nodeId: string | null) => void;
}

/**
 * ExplorerLayout: three-panel progressive reveal container.
 *
 * Default: graph canvas fills the viewport. Structure panel (left)
 * slides in on demand. Context panel (right) slides in when a node
 * is selected. Both can be open simultaneously; the graph canvas
 * takes the remaining center space.
 *
 * Keyboard: Escape clears selection and closes context panel.
 */
export default function ExplorerLayout({ children, onNodeSelect }: ExplorerLayoutProps) {
  const explorer = useExplorerSelection();
  const searchParams = useSearchParams();

  // Read scene params from URL (set by chat visual preview cards).
  // ?focus=id1,id2,id3  -> pre-select first node, store focused set
  // ?highlight=reasoning -> set highlight mode
  useEffect(() => {
    const focusParam = searchParams?.get('focus');
    const highlightParam = searchParams?.get('highlight');

    if (highlightParam) {
      const valid: HighlightMode[] = ['reasoning', 'contradictions', 'provenance', 'recent'];
      if (valid.includes(highlightParam as HighlightMode)) {
        explorer.setHighlightMode(highlightParam as HighlightMode);
      }
    }

    if (focusParam) {
      const ids = focusParam.split(',').filter(Boolean);
      if (ids.length > 0) {
        // Select the first focused node to open the context panel
        explorer.selectNode(ids[0]);
        // Broadcast all focused IDs so renderers can highlight them
        window.dispatchEvent(
          new CustomEvent('explorer:focus-nodes', { detail: { nodeIds: ids } }),
        );
      }
    }
    // Only run on mount (search params don't change within a session)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Forward selection changes to parent (so graph renderers can dim nodes)
  const handleNodeSelect = useCallback((nodeId: string | null) => {
    explorer.selectNode(nodeId);
    onNodeSelect?.(nodeId);
  }, [explorer, onNodeSelect]);

  // Escape key clears selection
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (explorer.selectedNodeId) {
          handleNodeSelect(null);
        } else if (explorer.structurePanelOpen) {
          explorer.toggleStructurePanel();
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [explorer, handleNodeSelect]);

  // Expose selectNode globally so graph renderers (which live outside
  // this component tree) can trigger selection via DOM events.
  useEffect(() => {
    function handler(event: Event) {
      const detail = (event as CustomEvent<{ nodeId: string | null }>).detail;
      if (detail) handleNodeSelect(detail.nodeId);
    }
    window.addEventListener('explorer:select-node', handler);
    return () => window.removeEventListener('explorer:select-node', handler);
  }, [handleNodeSelect]);

  const contextPanelOpen = explorer.selectedNodeId !== null;

  return (
    <div
      className={[
        'explorer-layout',
        explorer.structurePanelOpen ? 'structure-open' : '',
        contextPanelOpen ? 'context-open' : '',
      ].filter(Boolean).join(' ')}
    >
      {/* Structure panel (left) */}
      <StructurePanel
        isOpen={explorer.structurePanelOpen}
        onClose={explorer.toggleStructurePanel}
      />

      {/* Graph canvas area */}
      <div className="explorer-graph-area">
        {children}

        {/* Control dock (floating, bottom-right of graph) */}
        <ControlDock
          structurePanelOpen={explorer.structurePanelOpen}
          onToggleStructure={explorer.toggleStructurePanel}
          highlightMode={explorer.highlightMode}
          onSetHighlightMode={explorer.setHighlightMode}
          vizMode={explorer.vizMode}
          onSetVizMode={explorer.setVizMode}
          onResetView={() => {
            handleNodeSelect(null);
            explorer.setHighlightMode('none');
          }}
        />

        {/* Status strip (bottom of graph) */}
        <StatusStrip
          highlightMode={explorer.highlightMode}
          selectedNodeId={explorer.selectedNodeId}
          vizMode={explorer.vizMode}
        />
      </div>

      {/* Context panel (right) */}
      <ContextPanel
        nodeId={explorer.selectedNodeId}
        onClose={() => handleNodeSelect(null)}
      />
    </div>
  );
}
