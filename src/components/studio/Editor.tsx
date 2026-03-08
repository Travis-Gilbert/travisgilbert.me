'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';
import type { Editor as TiptapEditorType } from '@tiptap/react';
import type { StudioContentItem } from '@/lib/studio';
import { normalizeStudioContentType, getStage, getContentTypeIdentity } from '@/lib/studio';
import {
  saveContentItem,
  updateStage,
  publishContentItem,
  fetchStash,
  createStashItem,
  deleteStashItem,
  fetchTasks,
  createTask,
  updateTask,
  deleteTask,
  createRevision,
} from '@/lib/studio-api';
import { useDraftBuffer } from '@/lib/studio-draft-buffer';
import type { ApiStashItem, ApiContentTask } from '@/lib/studio-api';
import { StudioApiError } from '@/lib/studio-api';
import {
  useStudioWorkbench,
  type WorkbenchAutosaveState,
  type WorkbenchSaveState,
  type StashTask,
} from './WorkbenchContext';
import StageStepper from './StageStepper';
import EditorToolbar from './EditorToolbar';
import TiptapEditor from './TiptapEditor';
import type { TiptapUpdatePayload } from './TiptapEditor';
import WordCountBand from './WordCountBand';
import EditorContextMenu from './EditorContextMenu';
import ExportMenu from './ExportMenu';
import DeskLamp from './DeskLamp';
import PaperWeathering from './PaperWeathering';
import { useStudioView } from './StudioViewContext';

type SaveState = WorkbenchSaveState;
type SaveMode = 'manual' | 'autosave';
type AutosaveState = WorkbenchAutosaveState;
type EditorContentFormat = 'html' | 'markdown';
type ReadingFontPreset = 'writing-serif' | 'archivist' | 'cabin' | 'plex' | 'clean-sans' | 'mono';
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
  const validPresets: ReadingFontPreset[] = ['writing-serif', 'archivist', 'cabin', 'plex', 'clean-sans', 'mono'];
  const fontPreset: ReadingFontPreset =
    validPresets.includes(input?.fontPreset as ReadingFontPreset)
      ? (input!.fontPreset as ReadingFontPreset)
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

const FONT_PRESET_FAMILIES: Record<ReadingFontPreset, string> = {
  'writing-serif': "var(--studio-font-writing), 'Iowan Old Style', Georgia, 'Times New Roman', serif",
  'archivist': "var(--studio-font-archivist), 'Palatino Linotype', 'Book Antiqua', serif",
  'cabin': "var(--studio-font-body), 'Avenir Next', system-ui, sans-serif",
  'plex': "var(--studio-font-plex), 'Segoe UI', sans-serif",
  'clean-sans': "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  'mono': "var(--studio-font-mono), 'JetBrains Mono', monospace",
};

function readingFontFamily(fontPreset: ReadingFontPreset): string {
  return FONT_PRESET_FAMILIES[fontPreset] ?? FONT_PRESET_FAMILIES['writing-serif'];
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
  let md = candidate.getMarkdown();

  /*
   * Post-process containBlock nodes into :::type fences.
   * If the Markdown extension's addStorage serializer handled them, this is a
   * no-op (the nodes are already serialized). Otherwise, containBlock nodes
   * may appear as bare text. We walk the ProseMirror doc to produce the
   * canonical fenced representation.
   */
  const doc = editor.state.doc;
  const fenced: string[] = [];
  let hasContainBlocks = false;

  doc.forEach((node) => {
    if (node.type.name === 'containBlock') {
      hasContainBlocks = true;
      const containType = (node.attrs as { containType?: string }).containType ?? 'observation';
      fenced.push(`:::${containType}`);
      node.forEach((child) => {
        fenced.push(child.textContent);
      });
      fenced.push(':::');
      fenced.push('');
    } else {
      /* Keep original markdown for non-contain blocks */
    }
  });

  /*
   * Only replace the markdown if the doc actually has containBlock nodes AND
   * the serialized markdown does NOT already include ::: fences (meaning the
   * addStorage serializer did its job).
   */
  if (hasContainBlocks && !md.includes(':::')) {
    /* Rebuild: non-contain blocks keep their existing serialized lines,
     * contain blocks get fenced. This is a simplified pass that works for
     * top-level contain blocks. */
    const rebuilt: string[] = [];
    let mdLines = md.split('\n');
    let mdIdx = 0;

    doc.forEach((node) => {
      if (node.type.name === 'containBlock') {
        const containType = (node.attrs as { containType?: string }).containType ?? 'observation';
        rebuilt.push(`:::${containType}`);
        node.forEach((child) => {
          rebuilt.push(child.textContent);
        });
        rebuilt.push(':::');
        rebuilt.push('');
        /* Skip corresponding lines in original markdown (best effort) */
        const textContent = node.textContent.trim();
        while (mdIdx < mdLines.length) {
          const line = mdLines[mdIdx];
          mdIdx++;
          if (line.trim() === textContent || textContent.startsWith(line.trim())) {
            break;
          }
        }
      } else {
        /* Emit lines until next block boundary */
        const textContent = node.textContent.trim();
        let found = false;
        while (mdIdx < mdLines.length) {
          rebuilt.push(mdLines[mdIdx]);
          if (mdLines[mdIdx].trim().includes(textContent.slice(0, 20))) {
            found = true;
          }
          mdIdx++;
          if (found && mdIdx < mdLines.length && mdLines[mdIdx]?.trim() === '') {
            rebuilt.push(mdLines[mdIdx]);
            mdIdx++;
            break;
          }
        }
      }
    });

    /* Append any remaining lines */
    while (mdIdx < mdLines.length) {
      rebuilt.push(mdLines[mdIdx]);
      mdIdx++;
    }

    md = rebuilt.join('\n');
  }

  return md;
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
  const { zenMode, setZenMode, themeMode, toggleThemeMode } = useStudioView();
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
  const [stash, setStash] = useState<Array<{ id: string; text: string; savedAt: string }>>([]);
  const [tasks, setTasks] = useState<StashTask[]>([]);

  /* Draft buffer: localStorage crash recovery */
  const {
    hasRecoverableDraft,
    recoverableDraft,
    restoreDraft,
    discardDraft,
    bufferContent,
    clearBuffer,
  } = useDraftBuffer(normalizedContentType, slug, contentItem?.updatedAt);

  /* Fetch persisted stash and tasks from Django on mount / slug change */
  useEffect(() => {
    let cancelled = false;
    fetchStash(normalizedContentType, slug).then((items) => {
      if (cancelled) return;
      setStash(
        items.map((i) => ({
          id: String(i.id),
          text: i.text,
          savedAt: new Date(i.created_at).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
          }),
        })),
      );
    });
    fetchTasks(normalizedContentType, slug).then((apiTasks) => {
      if (cancelled) return;
      setTasks(
        apiTasks.map((t) => ({
          id: String(t.id),
          text: t.text,
          done: t.done,
          createdAt: t.created_at,
          contentSlug: slug,
          contentType: normalizedContentType,
        })),
      );
    });
    return () => { cancelled = true; };
  }, [normalizedContentType, slug]);

  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveStateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentTitleRef = useRef(currentTitle);
  const contentItemRef = useRef(contentItem);
  const readingPanelRef = useRef<HTMLDivElement>(null);
  const readingToggleRef = useRef<HTMLButtonElement>(null);
  const snapshotRef = useRef<string | null>(null);
  const lastRevisionAtRef = useRef<number>(0);

  useEffect(() => {
    currentTitleRef.current = currentTitle;
  }, [currentTitle]);

  useEffect(() => {
    contentItemRef.current = contentItem;
  }, [contentItem]);

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
    /* Snapshot is set to null until handleEditorReady fires with the
     * markdown-converted content. This prevents phantom autosaves caused
     * by comparing raw initialContent with the markdown serialization. */
    snapshotRef.current = null;
  }, [title, initialContent, initialStage, contentItem?.updatedAt, slug]);

  useEffect(() => {
    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
      if (saveStateTimerRef.current) clearTimeout(saveStateTimerRef.current);
    };
  }, []);

  /* Close reading panel on click-outside or Escape */
  useEffect(() => {
    if (!isReadingPanelOpen) return;

    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (
        readingPanelRef.current?.contains(target) ||
        readingToggleRef.current?.contains(target)
      ) return;
      setIsReadingPanelOpen(false);
    }

    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setIsReadingPanelOpen(false);
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isReadingPanelOpen]);

  /* Listen for command palette dispatched events */
  useEffect(() => {
    function handleStudioCommand(e: Event) {
      const id = (e as CustomEvent<{ id: string }>).detail?.id;
      if (id === 'typewriter-mode') setTypewriterMode((prev) => !prev);
      if (id === 'reading-panel') setIsReadingPanelOpen((prev) => !prev);
    }

    window.addEventListener('studio:command', handleStudioCommand);
    return () =>
      window.removeEventListener('studio:command', handleStudioCommand);
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

      const RETRY_DELAYS = [1000, 2000, 4000]; // exponential backoff
      let lastError: unknown = null;

      for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
        /* Re-serialize on every attempt so retries send the freshest content */
        const serializedBody = getEditorMarkdown(editor) ?? currentBody;
        const payload = {
          title: currentTitle.trim() || 'Untitled',
          body: serializedBody,
          excerpt: excerptFromContent(serializedBody),
          tags: contentItemRef.current?.tags ?? [],
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
          clearBuffer();

          if (mode === 'autosave') {
            setAutosaveState('saved');
          }

          /* Create revision: manual saves always, autosaves throttled to 10min */
          const REVISION_THROTTLE_MS = 10 * 60 * 1000;
          const now = Date.now();
          const shouldCreateRevision =
            mode === 'manual' ||
            now - lastRevisionAtRef.current >= REVISION_THROTTLE_MS;
          if (shouldCreateRevision) {
            lastRevisionAtRef.current = now;
            void createRevision(normalizedContentType, slug, {
              title: payload.title,
              body: payload.body,
              source: mode === 'autosave' ? 'autosave' : 'manual',
            }).catch(() => {
              /* Revision creation is best-effort; don't block save flow */
            });
          }

          saveStateTimerRef.current = setTimeout(() => {
            setSaveState('idle');
          }, 1500);
          return; // success, exit retry loop
        } catch (err) {
          lastError = err;

          /* Only retry on network errors; server errors (4xx/5xx) fail immediately */
          const isNetwork = err instanceof StudioApiError && err.isNetworkError;
          if (!isNetwork || attempt >= RETRY_DELAYS.length) {
            break;
          }

          setSaveState('retrying');
          await new Promise((r) => setTimeout(r, RETRY_DELAYS[attempt]));
        }
      }

      /* All attempts exhausted */
      setSaveState('error');
      setAutosaveState('idle');

      saveStateTimerRef.current = setTimeout(() => {
        setSaveState('idle');
      }, 5000);
    },
    [currentBody, currentTitle, editor, normalizedContentType, slug, clearBuffer],
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

  const handleRestoreDraft = useCallback(() => {
    const draft = restoreDraft();
    if (!draft) return;
    setCurrentTitle(draft.title);
    if (editor) {
      editor.commands.setContent(draft.body);
    }
    setCurrentBody(draft.body);
  }, [restoreDraft, editor]);

  useEffect(() => {
    /* snapshotRef is null until handleEditorReady fires. Skip dirty
     * checks until the editor has initialized and set the baseline
     * snapshot. This prevents phantom autosaves on first load. */
    if (snapshotRef.current === null) {
      return;
    }

    const nextSnapshot = JSON.stringify({
      title: currentTitle,
      body: currentBody,
    });

    if (nextSnapshot === snapshotRef.current) {
      return;
    }

    /* Buffer to localStorage for crash recovery (1s debounce inside hook) */
    bufferContent(currentTitle, currentBody);

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
  }, [currentBody, currentTitle, persistChanges, bufferContent]);

  const handleStageChange = useCallback(
    (newStage: string) => {
      setStage(newStage);

      void updateStage(normalizedContentType, slug, newStage)
        .then((updated) => {
          setStage(updated.stage);
        })
        .catch(() => {
          /* Keep local stage; API sync is best-effort.
           * Without this, the stage reverts on every failed API call
           * (e.g., Django not running) and appears "stuck." */
        });
    },
    [normalizedContentType, slug],
  );

  const handlePublish = useCallback(async () => {
    /* Save first, then publish via Django publisher (commits to GitHub) */
    const serializedBody = getEditorMarkdown(editor) ?? currentBody;
    await saveContentItem(normalizedContentType, slug, {
      title: currentTitle.trim() || 'Untitled',
      body: serializedBody,
      excerpt: excerptFromContent(serializedBody),
      tags: contentItemRef.current?.tags ?? [],
    });
    const published = await publishContentItem(normalizedContentType, slug);
    setStage(published.stage);
    setLastSaved(formatSavedTime(published.updatedAt));
  }, [currentBody, currentTitle, editor, normalizedContentType, slug]);

  const handleStash = useCallback(
    (text: string) => {
      const tempId = `stash-${Date.now()}`;
      const savedAt = new Date().toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
      /* Optimistic: add immediately */
      setStash((prev) => [{ id: tempId, text, savedAt }, ...prev]);
      /* Persist to API */
      createStashItem(normalizedContentType, slug, text).then((item) => {
        if (!item) return;
        setStash((prev) =>
          prev.map((s) => (s.id === tempId ? { ...s, id: String(item.id) } : s)),
        );
      });
    },
    [normalizedContentType, slug],
  );

  const handleAddTask = useCallback(
    (text: string) => {
      const tempId = `task-${Date.now()}`;
      setTasks((prev) => [
        {
          id: tempId,
          text,
          done: false,
          createdAt: new Date().toISOString(),
          contentSlug: slug,
          contentType: normalizedContentType,
        },
        ...prev,
      ]);
      createTask(normalizedContentType, slug, text).then((task) => {
        if (!task) return;
        setTasks((prev) =>
          prev.map((t) => (t.id === tempId ? { ...t, id: String(task.id) } : t)),
        );
      });
    },
    [slug, normalizedContentType],
  );

  const handleToggleTask = useCallback(
    (id: string) => {
      setTasks((prev) =>
        prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
      );
      const numId = Number(id);
      if (!Number.isNaN(numId)) {
        const task = tasks.find((t) => t.id === id);
        if (task) {
          updateTask(normalizedContentType, slug, numId, { done: !task.done });
        }
      }
    },
    [normalizedContentType, slug, tasks],
  );

  const handleDeleteTask = useCallback(
    (id: string) => {
      setTasks((prev) => prev.filter((t) => t.id !== id));
      const numId = Number(id);
      if (!Number.isNaN(numId)) {
        deleteTask(normalizedContentType, slug, numId);
      }
    },
    [normalizedContentType, slug],
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'S' && event.shiftKey && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        if (!editor) return;
        const { from, to } = editor.state.selection;
        if (from === to) return;
        const text = editor.state.doc.textBetween(from, to, '\n');
        editor.chain().focus().deleteSelection().run();
        handleStash(text);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [editor, handleStash]);

  useEffect(() => {
    setEditorState({
      editor,
      contentItem: contentItem ?? null,
      onSave: handleSave,
      lastSaved,
      saveState,
      autosaveState,
      stash,
      onRestoreStash: (id: string) => {
        const item = stash.find((s) => s.id === id);
        if (!item || !editor) return;
        editor.chain().focus().insertContent(item.text).run();
        setStash((prev) => prev.filter((s) => s.id !== id));
        deleteStashItem(normalizedContentType, slug, Number(id)).catch(() => {
          /* restore already happened in editor; server cleanup is best effort */
        });
      },
      onDeleteStash: (id: string) => {
        setStash((prev) => prev.filter((s) => s.id !== id));
        deleteStashItem(normalizedContentType, slug, Number(id)).catch(() => {
          /* best effort server cleanup */
        });
      },
      tasks,
      onAddTask: handleAddTask,
      onToggleTask: handleToggleTask,
      onDeleteTask: handleDeleteTask,
    });
  }, [
    autosaveState,
    contentItem,
    editor,
    handleSave,
    lastSaved,
    saveState,
    setEditorState,
    stash,
    tasks,
    handleAddTask,
    handleToggleTask,
    handleDeleteTask,
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
  const saveButtonLabel =
    saveState === 'saving' ? 'Saving...'
    : saveState === 'retrying' ? 'Retrying...'
    : 'Save';

  return (
    <div style={{ display: 'flex', height: '100vh', maxHeight: '100vh' }}>
      <div
        className="studio-writing-surface studio-editor-shell"
        data-writing-focused={isWritingFocused ? 'true' : 'false'}
        style={writingSurfaceStyle}
      >
        <DeskLamp stage={stage} />
        {hasRecoverableDraft && (
          <div className="studio-draft-recovery-banner">
            <span className="studio-draft-recovery-text">
              Unsaved draft found from{' '}
              {recoverableDraft
                ? new Date(recoverableDraft.savedAt).toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true,
                  })
                : 'earlier'}
            </span>
            <button
              type="button"
              className="studio-draft-recovery-btn studio-draft-recovery-restore"
              onClick={handleRestoreDraft}
            >
              Restore
            </button>
            <button
              type="button"
              className="studio-draft-recovery-btn studio-draft-recovery-discard"
              onClick={discardDraft}
            >
              Discard
            </button>
          </div>
        )}

        <StageStepper
          stage={stage}
          contentType={normalizedContentType}
          lastSaved={lastSaved}
          saveState={saveState}
          autosaveState={autosaveState}
          onStageChange={handleStageChange}
          onPublish={handlePublish}
        />

        <div className="studio-editor-header studio-editor-chrome">
          <div className="studio-editor-column">
            <div className="studio-editor-title-row">
              <div className="studio-editor-title-actions">
                <button
                  ref={readingToggleRef}
                  type="button"
                  className="studio-reading-toggle"
                  onClick={() => setIsReadingPanelOpen((open) => !open)}
                  aria-expanded={isReadingPanelOpen}
                  aria-controls="studio-reading-panel"
                >
                  Reading
                </button>
                <ExportMenu
                  title={currentTitle}
                  slug={slug}
                  markdown={markdownPreview}
                />
              </div>
            </div>

            {isReadingPanelOpen && (
              <div ref={readingPanelRef} id="studio-reading-panel" className="studio-reading-panel">
                <div className="studio-reading-control">
                  <span className="studio-reading-label">Font</span>
                  <div className="studio-font-grid" role="radiogroup" aria-label="Reading font">
                    {([
                      { preset: 'writing-serif' as const, label: 'Amarna', family: FONT_PRESET_FAMILIES['writing-serif'] },
                      { preset: 'archivist' as const, label: 'Archivist', family: FONT_PRESET_FAMILIES['archivist'] },
                      { preset: 'cabin' as const, label: 'Cabin', family: FONT_PRESET_FAMILIES['cabin'] },
                      { preset: 'plex' as const, label: 'Plex', family: FONT_PRESET_FAMILIES['plex'] },
                      { preset: 'clean-sans' as const, label: 'System', family: FONT_PRESET_FAMILIES['clean-sans'] },
                      { preset: 'mono' as const, label: 'Mono', family: FONT_PRESET_FAMILIES['mono'] },
                    ]).map(({ preset, label, family }) => (
                      <button
                        key={preset}
                        type="button"
                        className={`studio-font-preview ${readingSettings.fontPreset === preset ? 'is-active' : ''}`}
                        onClick={() => updateReadingSettings({ fontPreset: preset })}
                        role="radio"
                        aria-checked={readingSettings.fontPreset === preset}
                        aria-label={label}
                      >
                        <span className="studio-font-preview-sample" style={{ fontFamily: family }}>
                          Aa
                        </span>
                        <span className="studio-font-preview-label">{label}</span>
                      </button>
                    ))}
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
                  <span className="studio-reading-label">Appearance</span>
                  <div className="studio-reading-options">
                    <button
                      type="button"
                      className={`studio-reading-option ${themeMode === 'dark' ? 'is-active' : ''}`}
                      onClick={() => { if (themeMode !== 'dark') toggleThemeMode(); }}
                      aria-pressed={themeMode === 'dark'}
                      title="Dark mode"
                    >
                      Dark
                    </button>
                    <button
                      type="button"
                      className={`studio-reading-option ${themeMode === 'light' ? 'is-active' : ''}`}
                      onClick={() => { if (themeMode !== 'light') toggleThemeMode(); }}
                      aria-pressed={themeMode === 'light'}
                      title="Light mode (Cmd+Shift+T)"
                    >
                      Light
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

        <div className="studio-mobile-editor-actions studio-editor-column">
          <button
            type="button"
            className={`studio-mobile-action-btn ${saveState === 'error' ? 'is-error' : ''}`}
            onClick={handleSave}
            disabled={saveState === 'saving'}
          >
            {saveButtonLabel}
          </button>
          <ExportMenu
            title={currentTitle}
            slug={slug}
            markdown={markdownPreview}
            className="studio-mobile-export"
          />
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
          stage={stage}
          stageColor={getStage(stage).color}
          titleZone={
            <div className="studio-title-zone">
              <div className="studio-title-meta">
                <span style={{ color: getContentTypeIdentity(normalizedContentType).color }}>
                  {getContentTypeIdentity(normalizedContentType).label}
                </span>
                {' / '}
                <span style={{ color: getStage(stage).color }}>
                  {getStage(stage).label}
                </span>
              </div>
              <input
                type="text"
                value={currentTitle}
                onChange={(e) => setCurrentTitle(e.target.value)}
                placeholder="Untitled"
                spellCheck={false}
                className="studio-title-input"
              />
            </div>
          }
          toolbar={<EditorToolbar editor={editor} />}
          paperOverlay={<PaperWeathering stage={stage} slug={slug} />}
        />

        {editor && (
          <EditorContextMenu editor={editor} onStash={handleStash} onAddTask={handleAddTask} />
        )}

        <div className="studio-editor-chrome">
          <WordCountBand editor={editor} stageColor={getStage(stage).color} />
        </div>
      </div>
    </div>
  );
}
