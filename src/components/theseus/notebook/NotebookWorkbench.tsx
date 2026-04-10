'use client';

import { useState } from 'react';
import NotebookGraph from './NotebookGraph';
import type { RelatedObject } from './NotebookGraph';
import ClaimsPanel from './ClaimsPanel';
import TensionsPanel from './TensionsPanel';
import GapsPanel from './GapsPanel';
import AlgorithmSettings from './AlgorithmSettings';
import TheseusThread from '@/components/theseus/chat/TheseusThread';
import { useChatHistory } from '@/components/theseus/chat/useChatHistory';

type WorkbenchTab = 'graph' | 'chat' | 'claims' | 'tensions' | 'gaps' | 'settings';

interface NotebookWorkbenchProps {
  documentContent: string;
  relatedObjects?: RelatedObject[];
}

/**
 * NotebookWorkbench: right-side modular tab panel.
 *
 * All 6 tabs render real components (no placeholders):
 *   - Graph: NotebookGraph (scoped reactive graph)
 *   - Chat: TheseusThread (embedded ask with note context)
 *   - Claims: ClaimsPanel (claims from current note)
 *   - Tensions: TensionsPanel (conflicts with graph)
 *   - Gaps: GapsPanel (missing connections)
 *   - Settings: AlgorithmSettings (tuning sliders)
 */
export default function NotebookWorkbench({
  documentContent,
  relatedObjects = [],
}: NotebookWorkbenchProps) {
  const [tab, setTab] = useState<WorkbenchTab>('graph');

  const tabs: Array<{ id: WorkbenchTab; label: string }> = [
    { id: 'graph', label: 'Graph' },
    { id: 'chat', label: 'Chat' },
    { id: 'claims', label: 'Claims' },
    { id: 'tensions', label: 'Tensions' },
    { id: 'gaps', label: 'Gaps' },
    { id: 'settings', label: 'Settings' },
  ];

  return (
    <div className="notebook-workbench-inner">
      {/* Tab bar */}
      <div className="notebook-workbench-tabs">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`notebook-workbench-tab${tab === t.id ? ' is-active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="notebook-workbench-body">
        {tab === 'graph' && (
          <NotebookGraph relatedObjects={relatedObjects} />
        )}

        {tab === 'chat' && (
          <NotebookChatTab documentContent={documentContent} />
        )}

        {tab === 'claims' && (
          <ClaimsPanel documentContent={documentContent} />
        )}

        {tab === 'tensions' && (
          <TensionsPanel documentContent={documentContent} />
        )}

        {tab === 'gaps' && (
          <GapsPanel documentContent={documentContent} />
        )}

        {tab === 'settings' && (
          <AlgorithmSettings />
        )}
      </div>
    </div>
  );
}

/**
 * Embedded chat tab scoped to the current note's context.
 * Prepends note content to every query.
 */
function NotebookChatTab({ documentContent }: { documentContent: string }) {
  const { messages, isAsking, ask } = useChatHistory();

  // Wrap the ask function to prepend note context
  const askWithContext = (query: string) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(documentContent, 'text/html');
    const noteText = doc.body.textContent?.trim() ?? '';
    const contextPrefix = noteText.length > 100
      ? `Context from my note: "${noteText.slice(0, 500)}..."\n\nQuestion: `
      : '';
    ask(contextPrefix + query);
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <TheseusThread
        messages={messages}
        isAsking={isAsking}
        onSubmit={askWithContext}
      />
    </div>
  );
}
