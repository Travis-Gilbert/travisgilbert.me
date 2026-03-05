'use client';

import { useState, useCallback } from 'react';
import type { Editor as TiptapEditorType } from '@tiptap/react';
import type { StudioContentItem } from '@/lib/studio';
import StageBar from './StageBar';
import EditorToolbar from './EditorToolbar';
import TiptapEditor from './TiptapEditor';
import WordCountBand from './WordCountBand';
import WorkbenchPanel from './WorkbenchPanel';

/**
 * Main editor view: composes StageBar, Toolbar, TiptapEditor, WordCountBand,
 * and WorkbenchPanel (toolbox).
 *
 * Horizontal flex: writing column (flex: 1) + toolbox (280px, right).
 * Owns the editor instance ref (passed up from TiptapEditor via onEditorReady).
 * Manages stage state and auto-save timestamp locally.
 */
export default function Editor({
  slug,
  contentType,
  title,
  initialContent,
  initialStage,
  contentItem,
}: {
  slug: string;
  contentType: string;
  title: string;
  initialContent?: string;
  initialStage: string;
  contentItem?: StudioContentItem | null;
}) {
  const [editor, setEditor] = useState<TiptapEditorType | null>(null);
  const [currentTitle, setCurrentTitle] = useState(title);
  const [stage, setStage] = useState(initialStage);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [, setForceRender] = useState(0);

  const handleEditorReady = useCallback((ed: TiptapEditorType) => {
    setEditor(ed);
    /* Re-render on every transaction so toolbar active states update */
    ed.on('transaction', () => {
      setForceRender((n) => n + 1);
    });
  }, []);

  const handleUpdate = useCallback((html: string) => {
    /* Mock save: just update timestamp. Real API call comes later. */
    void html;
    const now = new Date();
    setLastSaved(
      now.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      }),
    );
  }, []);

  const handleSave = useCallback(() => {
    const now = new Date();
    setLastSaved(
      now.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      }),
    );
  }, []);

  const handleStageChange = useCallback((newStage: string) => {
    setStage(newStage);
  }, []);

  return (
    <div style={{ display: 'flex', height: '100vh', maxHeight: '100vh' }}>
      {/* Writing column */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
        }}
      >
        {/* Stage pipeline bar */}
        <StageBar
          stage={stage}
          contentType={contentType}
          lastSaved={lastSaved}
          onStageChange={handleStageChange}
        />

        {/* Editable title */}
        <div
          style={{
            padding: '20px 20px 0',
            backgroundColor: 'var(--studio-surface)',
          }}
        >
          <input
            type="text"
            value={currentTitle}
            onChange={(e) => setCurrentTitle(e.target.value)}
            placeholder="Untitled"
            spellCheck={false}
            style={{
              display: 'block',
              width: '100%',
              fontFamily: 'var(--studio-font-title)',
              fontSize: '28px',
              fontWeight: 700,
              color: 'var(--studio-text-bright)',
              background: 'none',
              border: 'none',
              outline: 'none',
              margin: 0,
              padding: '0 20px 16px',
              borderBottom: '1px solid var(--studio-border)',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Formatting toolbar */}
        <EditorToolbar editor={editor} />

        {/* Writing surface */}
        <TiptapEditor
          initialContent={initialContent}
          onUpdate={handleUpdate}
          onEditorReady={handleEditorReady}
        />

        {/* Word count band */}
        <WordCountBand editor={editor} />
      </div>

      {/* Toolbox (hidden below 1024px via CSS) */}
      <WorkbenchPanel
        editor={editor}
        contentItem={contentItem ?? null}
        onSave={handleSave}
        lastSaved={lastSaved}
      />
    </div>
  );
}
