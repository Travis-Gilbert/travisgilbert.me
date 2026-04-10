'use client';

import { useState, useCallback } from 'react';
import DocumentList from './DocumentList';
import NotebookEditor from './NotebookEditor';
import NotebookWorkbench from './NotebookWorkbench';

export interface NotebookDocument {
  id: string;
  title: string;
  content: string;
  status: 'draft' | 'captured' | 'in-graph';
  updatedAt: number;
}

/**
 * NotebookLayout: three-panel layout forked from StudioLayout concept.
 *
 * Left: collapsible document list
 * Center: Tiptap editor surface (light paper aesthetic)
 * Right: modular workbench tabs (dark Theseus chrome)
 */
export default function NotebookLayout() {
  const [documents, setDocuments] = useState<NotebookDocument[]>([
    {
      id: 'welcome',
      title: 'Welcome to Notebook',
      content: '<p>Start writing. Use <code>/</code> for commands.</p>',
      status: 'draft',
      updatedAt: Date.now(),
    },
  ]);
  const [activeDocId, setActiveDocId] = useState<string>('welcome');
  const [docListOpen, setDocListOpen] = useState(true);
  const [workbenchOpen, setWorkbenchOpen] = useState(true);

  const activeDoc = documents.find((d) => d.id === activeDocId) ?? documents[0];

  const handleNewDocument = useCallback(() => {
    const id = `doc-${Date.now()}`;
    const newDoc: NotebookDocument = {
      id,
      title: 'Untitled',
      content: '<p></p>',
      status: 'draft',
      updatedAt: Date.now(),
    };
    setDocuments((prev) => [newDoc, ...prev]);
    setActiveDocId(id);
  }, []);

  const handleUpdateContent = useCallback((docId: string, html: string) => {
    setDocuments((prev) =>
      prev.map((d) =>
        d.id === docId ? { ...d, content: html, updatedAt: Date.now() } : d,
      ),
    );
  }, []);

  const handleUpdateTitle = useCallback((docId: string, title: string) => {
    setDocuments((prev) =>
      prev.map((d) => (d.id === docId ? { ...d, title } : d)),
    );
  }, []);

  return (
    <div className="notebook-layout studio-theme">
      {/* Left: notes list (always in DOM for grid positioning) */}
      <div className="notebook-doclist" data-open={docListOpen}>
        {docListOpen && (
          <DocumentList
            documents={documents}
            activeDocId={activeDocId}
            onSelect={setActiveDocId}
            onNew={handleNewDocument}
          />
        )}
      </div>

      {/* Center: editor */}
      <div className="notebook-editor-area">
        <div className="notebook-editor-toolbar">
          <button
            type="button"
            className={`notebook-toolbar-btn${docListOpen ? ' is-active' : ''}`}
            onClick={() => setDocListOpen((v) => !v)}
            aria-label={docListOpen ? 'Hide notes' : 'Show notes'}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" strokeWidth="1.5" aria-hidden="true">
              <path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" strokeLinecap="round" />
            </svg>
          </button>
          <span className="notebook-doc-status" data-status={activeDoc.status}>
            {activeDoc.status}
          </span>
          <div style={{ flex: 1 }} />
          <button
            type="button"
            className={`notebook-toolbar-btn${workbenchOpen ? ' is-active' : ''}`}
            onClick={() => setWorkbenchOpen((v) => !v)}
            aria-label={workbenchOpen ? 'Hide workbench' : 'Show workbench'}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" strokeWidth="1.5" aria-hidden="true">
              <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" />
              <path d="M15 3v18" stroke="currentColor" />
            </svg>
          </button>
        </div>

        <NotebookEditor
          key={activeDoc.id}
          document={activeDoc}
          onUpdate={(html) => handleUpdateContent(activeDoc.id, html)}
          onTitleChange={(title) => handleUpdateTitle(activeDoc.id, title)}
        />
      </div>

      {/* Right: workbench (always in DOM for grid positioning) */}
      <div className="notebook-workbench" data-open={workbenchOpen}>
        {workbenchOpen && (
          <NotebookWorkbench documentContent={activeDoc.content} />
        )}
      </div>
    </div>
  );
}
