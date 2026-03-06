'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';
import type { Editor as TiptapEditorType } from '@tiptap/react';
import type { StudioContentItem } from '@/lib/studio';
import { normalizeStudioContentType } from '@/lib/studio';
import { saveContentItem, updateStage } from '@/lib/studio-api';
import {
  useStudioWorkbench,
  type WorkbenchAutosaveState,
  type WorkbenchSaveState,
} from './WorkbenchContext';
import StageStepper from './StageStepper';
import EditorToolbar from './EditorToolbar';
import TiptapEditor from './TiptapEditor';
import type { TiptapUpdatePayload } from './TiptapEditor';
import WordCountBand from './WordCountBand';
import { useStudioView } from './StudioViewContext';

type SaveState = WorkbenchSaveState;
type SaveMode = 'manual' | 'autosave';
type AutosaveState = WorkbenchAutosaveState;
type EditorContentFormat = 'html' | 'markdown';
type ReadingFontPreset = 'writing-serif' | 'clean-sans' | 'mono';
type ReadingParagraphSpacing = 'normal' | 'relaxed';

type ReadingSettings = {
  fontPreset: ReadingFontPreset;
  fontSize: number;
  lineHeight: number;
  paragraphSpacing: ReadingParagraphSpacing;
};

const READING_SETTINGS_STORAGE_KEY = 'studio-reading-settings-v2';
const TYPEWRITER_MODE_STORAGE_KEY = 'studio-typewriter-mode-v1';

const DEFAULT_READING_SETTINGS: ReadingSettings = {
  fontPreset: 'writing-serif',
  fontSize: 19,
  lineHeight: 1.75,
  paragraphSpacing: 'normal',
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeReadingSettings(
  input: Partial<ReadingSettings> | null | undefined,
): ReadingSettings {
  const fontPreset: ReadingFontPreset =
    input?.fontPreset === 'clean-sans' || input?.fontPreset === 'mono'
      ? input.fontPreset
      : 'writing-serif';

  const paragraphSpacing: ReadingParagraphSpacing =
    input?.paragraphSpacing === 'relaxed' ? 'relaxed' : 'normal';

  const fontSize = clamp(
    Number.isFinite(input?.fontSize) ? Number(input?.fontSize) : DEFAULT_READING_SETTINGS.fontSize,
    16,
    22,
  );
  const lineHeight = clamp(
    Number.isFinite(input?.lineHeight)
      ? Number(input?.lineHeight)
      : DEFAULT_READING_SETTINGS.lineHeight,
    1.5,
    2,
  );

  return {
    fontPreset,
    fontSize: Math.round(fontSize),
    lineHeight: Math.round(lineHeight * 100) / 100,
    paragraphSpacing,
  };
}

function readingFontFamily(fontPreset: ReadingFontPreset): string {
  if (fontPreset === 'clean-sans') {
    return "var(--studio-font-body), 'Avenir Next', 'Segoe UI', sans-serif";
  }
  if (fontPreset === 'mono') {
    return "var(--studio-font-mono), 'JetBrains Mono', monospace";
  }
  return "var(--studio-font-writing), 'Iowan Old Style', Georgia, 'Times New Roman', serif";
}

function detectEditorContentFormat(content: string): EditorContentFormat {
  if (!content.trim()) return 'markdown';
  return /<\/?[a-z][\s\S]*>/i.test(content) ? 'html' : 'markdown';
}

function getEditorMarkdown(editor: TiptapEditorType | null): string | null {
  if (!editor) return null;
  const candidate = editor as TiptapEditorType & {
    getMarkdown?: () => string;
  };
  if (typeof candidate.getMarkdown !== 'function') return null;
  return candidate.getMarkdown();
}

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

function excerptFromContent(content: string): string {
  const plain = content
    .replace(/<[^>]+>/g, ' ')
    .replace(/[#>*_[\]`~-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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
  const { zenMode, setZenMode } = useStudioView();
  const normalizedContentType = normalizeStudioContentType(contentType);

  const [editor, setEditor] = useState<TiptapEditorType | null>(null);
  const [currentTitle, setCurrentTitle] = useState(title);
  const [currentBody, setCurrentBody] = useState(initialContent ?? '');
  const [contentFormat, setContentFormat] = useState<EditorContentFormat>(
    detectEditorContentFormat(initialContent ?? ''),
  );
  const [stage, setStage] = useState(initialStage);
  const [lastSaved, setLastSaved] = useState<string | null>(
    contentItem?.updatedAt ? formatSavedTime(contentItem.updatedAt) : null,
  );
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [autosaveState, setAutosaveState] = useState<AutosaveState>('idle');
  const [isWritingFocused, setIsWritingFocused] = useState(false);
  const [isReadingPanelOpen, setIsReadingPanelOpen] = useState(false);
  const [showMarkdownView, setShowMarkdownView] = useState(false);
  const [typewriterMode, setTypewriterMode] = useState(true);
  const [readingSettings, setReadingSettings] = useState<ReadingSettings>(
    DEFAULT_READING_SETTINGS,
  );
  const [, setForceRender] = useState(0);

  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveStateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentTitleRef = useRef(currentTitle);
  const snapshotRef = useRef(
    JSON.stringify({
      title,
      body: initialContent ?? '',
    }),
  );

  useEffect(() => {
    currentTitleRef.current = currentTitle;
  }, [currentTitle]);

  useEffect(() => {
    const detectedFormat = detectEditorContentFormat(initialContent ?? '');
    setCurrentTitle(title);
    setCurrentBody(initialContent ?? '');
    setContentFormat(detectedFormat);
    setStage(initialStage);
    setLastSaved(contentItem?.updatedAt ? formatSavedTime(contentItem.updatedAt) : null);
    setSaveState('idle');
    setAutosaveState('idle');
    setShowMarkdownView(false);
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

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(READING_SETTINGS_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<ReadingSettings>;
      setReadingSettings(normalizeReadingSettings(parsed));
    } catch {
      setReadingSettings(DEFAULT_READING_SETTINGS);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(
      READING_SETTINGS_STORAGE_KEY,
      JSON.stringify(readingSettings),
    );
  }, [readingSettings]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(TYPEWRITER_MODE_STORAGE_KEY);
      if (!raw) return;
      setTypewriterMode(raw !== 'false');
    } catch {
      setTypewriterMode(true);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(
      TYPEWRITER_MODE_STORAGE_KEY,
      String(typewriterMode),
    );
  }, [typewriterMode]);

  const handleEditorReady = useCallback((ed: TiptapEditorType) => {
    const markdown = getEditorMarkdown(ed);

    setEditor(ed);
    ed.on('transaction', () => {
      setForceRender((n) => n + 1);
    });
    if (markdown !== null) {
      setCurrentBody(markdown);
      snapshotRef.current = JSON.stringify({
        title: currentTitleRef.current,
        body: markdown,
      });
    }
  }, []);

  const persistChanges = useCallback(
    async (mode: SaveMode) => {
      if (saveStateTimerRef.current) {
        clearTimeout(saveStateTimerRef.current);
      }

      setSaveState('saving');
      setAutosaveState('idle');
      const serializedBody = getEditorMarkdown(editor) ?? currentBody;

      const payload = {
        title: currentTitle.trim() || 'Untitled',
        body: serializedBody,
        excerpt: excerptFromContent(serializedBody),
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
    [contentItem?.tags, currentBody, currentTitle, editor, normalizedContentType, slug],
  );

  const handleUpdate = useCallback((payload: TiptapUpdatePayload) => {
    setCurrentBody(payload.markdown);
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

  const writingSurfaceStyle = {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
    ['--studio-reading-font-family' as '--studio-reading-font-family']: readingFontFamily(
      readingSettings.fontPreset,
    ),
    ['--studio-reading-font-size' as '--studio-reading-font-size']: `${readingSettings.fontSize}px`,
    ['--studio-reading-line-height' as '--studio-reading-line-height']: String(
      readingSettings.lineHeight,
    ),
    ['--studio-reading-paragraph-gap' as '--studio-reading-paragraph-gap']:
      readingSettings.paragraphSpacing === 'relaxed' ? '1.55em' : '1.18em',
  } as CSSProperties;

  const updateReadingSettings = (patch: Partial<ReadingSettings>) => {
    setReadingSettings((prev) => normalizeReadingSettings({ ...prev, ...patch }));
  };
  const markdownPreview = getEditorMarkdown(editor) ?? currentBody;

  return (
    <div style={{ display: 'flex', height: '100vh', maxHeight: '100vh' }}>
      <div
        className="studio-writing-surface studio-editor-shell"
        data-writing-focused={isWritingFocused ? 'true' : 'false'}
        style={writingSurfaceStyle}
      >
        <StageStepper
          stage={stage}
          contentType={normalizedContentType}
          lastSaved={lastSaved}
          saveState={saveState}
          autosaveState={autosaveState}
          onStageChange={handleStageChange}
        />

        <div className="studio-editor-header studio-editor-chrome">
          <div className="studio-editor-column">
            <div className="studio-editor-title-row">
              <input
                type="text"
                value={currentTitle}
                onChange={(e) => setCurrentTitle(e.target.value)}
                placeholder="Untitled"
                spellCheck={false}
                className="studio-editor-title"
              />
              <button
                type="button"
                className="studio-reading-toggle"
                onClick={() => setIsReadingPanelOpen((open) => !open)}
                aria-expanded={isReadingPanelOpen}
                aria-controls="studio-reading-panel"
              >
                Reading
              </button>
            </div>

            {isReadingPanelOpen && (
              <div id="studio-reading-panel" className="studio-reading-panel">
                <div className="studio-reading-control">
                  <span className="studio-reading-label">Font</span>
                  <div className="studio-reading-options" role="radiogroup" aria-label="Reading font">
                    <button
                      type="button"
                      className={`studio-reading-option ${readingSettings.fontPreset === 'writing-serif' ? 'is-active' : ''}`}
                      onClick={() => updateReadingSettings({ fontPreset: 'writing-serif' })}
                      role="radio"
                      aria-checked={readingSettings.fontPreset === 'writing-serif'}
                    >
                      Writing Serif
                    </button>
                    <button
                      type="button"
                      className={`studio-reading-option ${readingSettings.fontPreset === 'clean-sans' ? 'is-active' : ''}`}
                      onClick={() => updateReadingSettings({ fontPreset: 'clean-sans' })}
                      role="radio"
                      aria-checked={readingSettings.fontPreset === 'clean-sans'}
                    >
                      Clean Sans
                    </button>
                    <button
                      type="button"
                      className={`studio-reading-option ${readingSettings.fontPreset === 'mono' ? 'is-active' : ''}`}
                      onClick={() => updateReadingSettings({ fontPreset: 'mono' })}
                      role="radio"
                      aria-checked={readingSettings.fontPreset === 'mono'}
                    >
                      Mono
                    </button>
                  </div>
                </div>

                <label className="studio-reading-control">
                  <span className="studio-reading-label">
                    Font Size: {readingSettings.fontSize}px
                  </span>
                  <input
                    type="range"
                    min={16}
                    max={22}
                    step={1}
                    value={readingSettings.fontSize}
                    onChange={(event) =>
                      updateReadingSettings({
                        fontSize: Number(event.target.value),
                      })
                    }
                  />
                </label>

                <label className="studio-reading-control">
                  <span className="studio-reading-label">
                    Line Height: {readingSettings.lineHeight.toFixed(2)}
                  </span>
                  <input
                    type="range"
                    min={1.5}
                    max={2}
                    step={0.05}
                    value={readingSettings.lineHeight}
                    onChange={(event) =>
                      updateReadingSettings({
                        lineHeight: Number(event.target.value),
                      })
                    }
                  />
                </label>

                <div className="studio-reading-control">
                  <span className="studio-reading-label">Paragraph Spacing</span>
                  <div className="studio-reading-options" role="radiogroup" aria-label="Paragraph spacing">
                    <button
                      type="button"
                      className={`studio-reading-option ${readingSettings.paragraphSpacing === 'normal' ? 'is-active' : ''}`}
                      onClick={() =>
                        updateReadingSettings({ paragraphSpacing: 'normal' })
                      }
                      role="radio"
                      aria-checked={readingSettings.paragraphSpacing === 'normal'}
                    >
                      Normal
                    </button>
                    <button
                      type="button"
                      className={`studio-reading-option ${readingSettings.paragraphSpacing === 'relaxed' ? 'is-active' : ''}`}
                      onClick={() =>
                        updateReadingSettings({ paragraphSpacing: 'relaxed' })
                      }
                      role="radio"
                      aria-checked={readingSettings.paragraphSpacing === 'relaxed'}
                    >
                      Relaxed
                    </button>
                  </div>
                </div>

                <div className="studio-reading-control">
                  <span className="studio-reading-label">Focus Tools</span>
                  <div className="studio-reading-options">
                    <button
                      type="button"
                      className={`studio-reading-option ${zenMode ? 'is-active' : ''}`}
                      onClick={() => setZenMode(!zenMode)}
                      aria-pressed={zenMode}
                      title="Toggle Zen mode (Cmd+Shift+Z)"
                    >
                      Zen {zenMode ? 'On' : 'Off'}
                    </button>
                    <button
                      type="button"
                      className={`studio-reading-option ${typewriterMode ? 'is-active' : ''}`}
                      onClick={() => setTypewriterMode((enabled) => !enabled)}
                      aria-pressed={typewriterMode}
                    >
                      Typewriter {typewriterMode ? 'On' : 'Off'}
                    </button>
                  </div>
                </div>

                <div className="studio-reading-control">
                  <span className="studio-reading-label">Markdown</span>
                  <div className="studio-reading-options">
                    <button
                      type="button"
                      className={`studio-reading-option ${showMarkdownView ? 'is-active' : ''}`}
                      onClick={() => setShowMarkdownView((open) => !open)}
                      aria-pressed={showMarkdownView}
                    >
                      Markdown View {showMarkdownView ? 'On' : 'Off'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="studio-editor-chrome">
          <EditorToolbar editor={editor} />
        </div>

        {showMarkdownView && (
          <div className="studio-editor-column studio-markdown-view-wrap">
            <pre className="studio-markdown-view">{markdownPreview}</pre>
          </div>
        )}

        <TiptapEditor
          key={slug}
          initialContent={currentBody}
          initialContentFormat={contentFormat}
          onUpdate={handleUpdate}
          onEditorReady={handleEditorReady}
          onFocusChange={setIsWritingFocused}
          typewriterMode={typewriterMode}
        />

        <div className="studio-editor-chrome">
          <WordCountBand editor={editor} />
        </div>
      </div>
    </div>
  );
}
