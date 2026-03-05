'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import type { Editor as TiptapEditorType } from '@tiptap/react';
import type { StudioContentItem } from '@/lib/studio';
import { normalizeStudioContentType } from '@/lib/studio';
import { saveContentItem, updateStage } from '@/lib/studio-api';
import {
  useStudioWorkbench,
  type WorkbenchAutosaveState,
  type WorkbenchSaveState,
} from './WorkbenchContext';
import StageBar from './StageBar';
import EditorToolbar from './EditorToolbar';
import TiptapEditor from './TiptapEditor';
import WordCountBand from './WordCountBand';

type SaveState = WorkbenchSaveState;
type SaveMode = 'manual' | 'autosave';
type AutosaveState = WorkbenchAutosaveState;

function formatSavedTime(input: string): string {
  const dt = new Date(input);
  if (Number.isNaN(dt.getTime())) {
    return '';
  }
  return dt.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function excerptFromHtml(html: string): string {
  const plain = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return plain.slice(0, 220);
}

/**
 * Main editor view: stage bar, toolbar, writing area, word count band,
 * and workbench panel.
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
  const { setEditorState, resetEditorState } = useStudioWorkbench();
  const normalizedContentType = normalizeStudioContentType(contentType);

  const [editor, setEditor] = useState<TiptapEditorType | null>(null);
  const [currentTitle, setCurrentTitle] = useState(title);
  const [currentBody, setCurrentBody] = useState(initialContent ?? '');
  const [stage, setStage] = useState(initialStage);
  const [lastSaved, setLastSaved] = useState<string | null>(
    contentItem?.updatedAt ? formatSavedTime(contentItem.updatedAt) : null,
  );
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [autosaveState, setAutosaveState] = useState<AutosaveState>('idle');
  const [, setForceRender] = useState(0);

  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveStateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const snapshotRef = useRef(
    JSON.stringify({
      title,
      body: initialContent ?? '',
    }),
  );

  useEffect(() => {
    setCurrentTitle(title);
    setCurrentBody(initialContent ?? '');
    setStage(initialStage);
    setLastSaved(contentItem?.updatedAt ? formatSavedTime(contentItem.updatedAt) : null);
    setSaveState('idle');
    setAutosaveState('idle');
    snapshotRef.current = JSON.stringify({
      title,
      body: initialContent ?? '',
    });
  }, [title, initialContent, initialStage, contentItem?.updatedAt, slug]);

  useEffect(() => {
    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
      if (saveStateTimerRef.current) clearTimeout(saveStateTimerRef.current);
    };
  }, []);

  const handleEditorReady = useCallback((ed: TiptapEditorType) => {
    setEditor(ed);
    ed.on('transaction', () => {
      setForceRender((n) => n + 1);
    });
  }, []);

  const persistChanges = useCallback(
    async (mode: SaveMode) => {
      if (saveStateTimerRef.current) {
        clearTimeout(saveStateTimerRef.current);
      }

      setSaveState('saving');
      setAutosaveState('idle');

      const payload = {
        title: currentTitle.trim() || 'Untitled',
        body: currentBody,
        excerpt: excerptFromHtml(currentBody),
        tags: contentItem?.tags ?? [],
      };

      try {
        const saved = await saveContentItem(normalizedContentType, slug, payload);

        const snapshot = JSON.stringify({
          title: payload.title,
          body: payload.body,
        });
        snapshotRef.current = snapshot;

        setCurrentTitle(saved.title);
        setLastSaved(formatSavedTime(saved.updatedAt));
        setSaveState('success');

        if (mode === 'autosave') {
          setAutosaveState('saved');
        }

        saveStateTimerRef.current = setTimeout(() => {
          setSaveState('idle');
        }, 1500);
      } catch {
        setSaveState('error');
        setAutosaveState('idle');

        saveStateTimerRef.current = setTimeout(() => {
          setSaveState('idle');
        }, 3000);
      }
    },
    [contentItem?.tags, currentBody, currentTitle, normalizedContentType, slug],
  );

  const handleUpdate = useCallback((html: string) => {
    setCurrentBody(html);
  }, []);

  const handleSave = useCallback(() => {
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }
    void persistChanges('manual');
  }, [persistChanges]);

  useEffect(() => {
    const nextSnapshot = JSON.stringify({
      title: currentTitle,
      body: currentBody,
    });

    if (nextSnapshot === snapshotRef.current) {
      return;
    }

    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }

    autosaveTimerRef.current = setTimeout(() => {
      void persistChanges('autosave');
    }, 3000);

    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
    };
  }, [currentBody, currentTitle, persistChanges]);

  const handleStageChange = useCallback(
    (newStage: string) => {
      const previousStage = stage;
      setStage(newStage);

      void updateStage(normalizedContentType, slug, newStage)
        .then((updated) => {
          setStage(updated.stage);
        })
        .catch(() => {
          setStage(previousStage);
        });
    },
    [normalizedContentType, slug, stage],
  );

  useEffect(() => {
    setEditorState({
      editor,
      contentItem: contentItem ?? null,
      onSave: handleSave,
      lastSaved,
      saveState,
      autosaveState,
    });
  }, [
    autosaveState,
    contentItem,
    editor,
    handleSave,
    lastSaved,
    saveState,
    setEditorState,
  ]);

  useEffect(() => {
    return () => {
      resetEditorState();
    };
  }, [resetEditorState]);

  return (
    <div style={{ display: 'flex', height: '100vh', maxHeight: '100vh' }}>
      <div
        className="studio-writing-surface"
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
        }}
      >
        <StageBar
          stage={stage}
          contentType={normalizedContentType}
          lastSaved={lastSaved}
          onStageChange={handleStageChange}
        />

        <div
          style={{
            padding: '20px 40px 0',
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
              padding: '0 0 16px',
              lineHeight: 1.2,
              borderBottom: '1px solid var(--studio-border)',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <EditorToolbar editor={editor} />

        <TiptapEditor
          key={slug}
          initialContent={initialContent}
          onUpdate={handleUpdate}
          onEditorReady={handleEditorReady}
        />

        <WordCountBand editor={editor} />
      </div>
    </div>
  );
}
