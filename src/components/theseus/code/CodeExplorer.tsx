'use client';

import { useCallback } from 'react';
import { useCodeExplorer } from './useCodeExplorer';
import CodeExplorerToolbar from './CodeExplorerToolbar';
import ImpactView from './ImpactView';
import DriftPanel from './DriftPanel';
import PatternMemoryPanel from './PatternMemoryPanel';
import RepoConnectFlow from './RepoConnectFlow';

/**
 * CodeExplorer: top-level graph-intelligence view of an ingested
 * codebase. Renders at /theseus/code.
 *
 * The existing Code Workshop (editor UI) remains accessible via
 * /theseus?view=code. These two surfaces coexist.
 */
export default function CodeExplorer() {
  const state = useCodeExplorer();

  const handleExplain = useCallback((symbolName: string) => {
    // Placeholder: explain drawer will live here once the design lands.
    // For now, log the symbol so the hook point is verified in dev.
    if (typeof window !== 'undefined') {
      console.info('[CodeExplorer] explain requested for', symbolName);
    }
  }, []);

  return (
    <div
      className="ce-root"
      data-drift-open={state.driftOpen ? 'true' : undefined}
      data-patterns-open={state.patternsOpen ? 'true' : undefined}
    >
      <CodeExplorerToolbar
        searchQuery={state.searchQuery}
        onSearchChange={state.setSearchQuery}
        languageFilter={state.languageFilter}
        onLanguageChange={state.setLanguageFilter}
        entityTypeFilter={state.entityTypeFilter}
        onEntityTypeChange={state.setEntityTypeFilter}
        symbols={state.symbols}
        onSymbolSelect={state.setFocalSymbol}
        onRepoConnect={() => state.setRepoConnectOpen(true)}
        onDriftToggle={() => state.setDriftOpen(!state.driftOpen)}
        driftCount={state.drift.length}
        driftOpen={state.driftOpen}
        onPatternsToggle={() => state.setPatternsOpen(!state.patternsOpen)}
        patternCount={state.patterns.length}
        patternsOpen={state.patternsOpen}
      />

      <div className="ce-main">
        <ImpactView
          focalSymbol={state.focalSymbol}
          impact={state.impact}
          context={state.context}
          loading={state.impactLoading}
          symbols={state.symbols}
          symbolsLoading={state.symbolsLoading}
          onSymbolSelect={state.setFocalSymbol}
          onRepoConnect={() => state.setRepoConnectOpen(true)}
          onExplain={handleExplain}
        />

        <DriftPanel
          open={state.driftOpen}
          drift={state.drift}
          onResolve={state.resolveDrift}
          onClose={() => state.setDriftOpen(false)}
        />

        <PatternMemoryPanel
          open={state.patternsOpen}
          patterns={state.patterns}
          onSubmit={state.submitPattern}
          onClose={() => state.setPatternsOpen(false)}
        />
      </div>

      {state.error && (
        <div className="ce-error-toast" role="alert">
          <span className="ce-error-toast-message">{state.error}</span>
          <button
            type="button"
            className="ce-error-toast-dismiss"
            onClick={state.clearError}
            aria-label="Dismiss error"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      )}

      <RepoConnectFlow
        open={state.repoConnectOpen}
        onClose={() => state.setRepoConnectOpen(false)}
        onIngest={state.ingestRepo}
      />
    </div>
  );
}
