'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { Editor as TiptapEditorType } from '@tiptap/react';
import type { StudioContentItem } from '@/lib/studio';
import { getContentTypeIdentity, studioMix } from '@/lib/studio';

const STORAGE_KEY = 'studio-workbench-open';
const STORAGE_MODE_KEY = 'studio-workbench-mode';

/* Word count targets by content type */
const WORD_TARGETS: Record<string, number> = {
  essay: 3000,
  'field-note': 500,
  shelf: 300,
  video: 1500,
  project: 800,
  toolkit: 400,
};

interface HeadingItem {
  level: number;
  text: string;
  pos: number;
}

interface TodoItem {
  text: string;
  done: boolean;
}

type SaveState = 'idle' | 'saving' | 'success' | 'error';
type AutosaveState = 'idle' | 'saved';

/**
 * Editor toolbox: right panel (280px) with Outline and Notes modes.
 *
 * Outline mode:
 *   Document outline (headings from Tiptap JSON),
 *   word count with target progress bar,
 *   save button with last saved timestamp,
 *   export dropdown.
 *
 * Notes mode:
 *   Sources placeholder, links placeholder, notes placeholder,
 *   todo list persisted to localStorage by content slug.
 *
 * Toggle: Cmd+. / Ctrl+. keyboard shortcut.
 * Hidden below 1024px via CSS.
 */
export default function WorkbenchPanel({
  editor,
  contentItem,
  onSave,
  lastSaved,
  saveState = 'idle',
  autosaveState = 'idle',
}: {
  editor: TiptapEditorType | null;
  contentItem: StudioContentItem | null;
  onSave?: () => void;
  lastSaved: string | null;
  saveState?: SaveState;
  autosaveState?: AutosaveState;
}) {
  const [open, setOpen] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [mode, setMode] = useState<'outline' | 'notes'>('outline');

  /* Read persisted state after hydration */
  useEffect(() => {
    const storedOpen = localStorage.getItem(STORAGE_KEY);
    if (storedOpen !== null) setOpen(storedOpen === 'true');
    const storedMode = localStorage.getItem(STORAGE_MODE_KEY);
    if (storedMode === 'outline' || storedMode === 'notes') setMode(storedMode);
    setMounted(true);
  }, []);

  /* Persist toggle */
  const toggle = useCallback(() => {
    setOpen((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  }, []);

  /* Persist mode */
  const switchMode = useCallback((m: 'outline' | 'notes') => {
    setMode(m);
    localStorage.setItem(STORAGE_MODE_KEY, m);
  }, []);

  /* Keyboard shortcut: Cmd+. or Ctrl+. */
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === '.' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        toggle();
      }
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [toggle]);

  if (!mounted) return null;

  return (
    <aside
      className="studio-workbench studio-scrollbar"
      data-open={open ? 'true' : undefined}
      style={{
        width: open ? '280px' : '0px',
        minWidth: open ? '280px' : '0px',
        overflow: 'hidden',
        flexShrink: 0,
        backgroundColor: 'var(--studio-bg-sidebar)',
        borderLeft: open ? '1px solid var(--studio-border)' : 'none',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        transition: 'width 0.2s ease, min-width 0.2s ease',
      }}
    >
      {/* Toggle button */}
      <button
        type="button"
        onClick={toggle}
        aria-label={open ? 'Close toolbox' : 'Open toolbox'}
        title="Toggle toolbox (Cmd+.)"
        style={{
          position: 'absolute',
          left: '-28px',
          top: '12px',
          width: '24px',
          height: '24px',
          backgroundColor: 'var(--studio-surface)',
          border: '1px solid var(--studio-border)',
          borderRadius: '4px',
          color: 'var(--studio-text-3)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10,
          transition: 'all 0.1s ease',
        }}
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        >
          {open ? (
            <polyline points="8,2 4,6 8,10" />
          ) : (
            <polyline points="4,2 8,6 4,10" />
          )}
        </svg>
      </button>

      {open && (
        <div
          className="studio-scrollbar"
          style={{
            padding: '16px 14px',
            overflowY: 'auto',
            flex: 1,
            opacity: 1,
            transition: 'opacity 0.15s ease 0.05s',
          }}
        >
          {/* Mode tabs */}
          <div
            style={{
              display: 'flex',
              gap: '2px',
              marginBottom: '16px',
              borderBottom: '1px solid var(--studio-border)',
              paddingBottom: '8px',
            }}
          >
            {(['outline', 'notes'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => switchMode(m)}
                style={{
                  flex: 1,
                  padding: '5px 0',
                  fontFamily: 'var(--studio-font-mono)',
                  fontSize: '9.5px',
                  fontWeight: 700,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase' as const,
                  color:
                    mode === m
                      ? 'var(--studio-text-bright)'
                      : 'var(--studio-text-3)',
                  backgroundColor: 'transparent',
                  border: 'none',
                  borderBottom:
                    mode === m
                      ? '2px solid var(--studio-tc)'
                      : '2px solid transparent',
                  cursor: 'pointer',
                  transition: 'all 0.12s ease',
                }}
              >
                {m === 'outline' ? 'Outline' : 'Notes'}
              </button>
            ))}
          </div>

          {mode === 'outline' ? (
            <OutlineMode
              editor={editor}
              contentItem={contentItem}
              onSave={onSave}
              lastSaved={lastSaved}
              saveState={saveState}
              autosaveState={autosaveState}
            />
          ) : (
            <NotesMode contentItem={contentItem} />
          )}
        </div>
      )}
    </aside>
  );
}

/* ── Outline Mode ────────────────────────────── */

function OutlineMode({
  editor,
  contentItem,
  onSave,
  lastSaved,
  saveState,
  autosaveState,
}: {
  editor: TiptapEditorType | null;
  contentItem: StudioContentItem | null;
  onSave?: () => void;
  lastSaved: string | null;
  saveState: SaveState;
  autosaveState: AutosaveState;
}) {
  /* Extract headings from ProseMirror document tree */
  const headings = useMemo<HeadingItem[]>(() => {
    if (!editor) return [];
    const result: HeadingItem[] = [];
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === 'heading' && node.textContent.trim()) {
        result.push({
          level: (node.attrs.level as number) ?? 1,
          text: node.textContent,
          pos,
        });
      }
    });
    return result;
  }, [editor]);

  /* Word count and target */
  const wordCount = useMemo(() => {
    if (!editor) return 0;
    return editor.storage.characterCount?.words?.() ?? 0;
  }, [editor]);

  const contentType = contentItem?.contentType ?? 'essay';
  const target = WORD_TARGETS[contentType] ?? 1500;
  const progress = Math.min((wordCount / target) * 100, 100);
  const typeInfo = getContentTypeIdentity(contentType);

  const scrollToHeading = useCallback(
    (text: string) => {
      if (!editor) return;
      /* Find heading node and focus it */
      const doc = editor.state.doc;
      let targetPos = 0;
      doc.descendants((node, pos) => {
        if (
          node.type.name === 'heading' &&
          node.textContent === text &&
          targetPos === 0
        ) {
          targetPos = pos;
          return false;
        }
      });
      if (targetPos > 0) {
        editor.commands.focus();
        editor.commands.setTextSelection(targetPos + 1);
        /* Scroll the editor view to the selection */
        const domAtPos = editor.view.domAtPos(targetPos + 1);
        if (domAtPos.node instanceof HTMLElement) {
          domAtPos.node.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else if (domAtPos.node.parentElement) {
          domAtPos.node.parentElement.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
          });
        }
      }
    },
    [editor],
  );

  const [exportOpen, setExportOpen] = useState(false);

  const handleExportMarkdown = useCallback(() => {
    if (!editor) return;
    /* Convert editor HTML to a simple markdown-ish export */
    const html = editor.getHTML();
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${contentItem?.slug ?? 'export'}.html`;
    a.click();
    URL.revokeObjectURL(url);
    setExportOpen(false);
  }, [editor, contentItem]);

  const saveLabel =
    saveState === 'saving'
      ? 'Saving...'
      : saveState === 'error'
        ? 'Save failed'
        : saveState === 'success'
          ? 'Saved'
          : 'Save';

  const saveColor =
    saveState === 'success'
      ? '#5A7A4A'
      : saveState === 'error'
        ? '#A44A3A'
        : typeInfo.color;

  return (
    <>
      {/* Document outline */}
      <div style={{ marginBottom: '20px' }}>
        <ToolboxLabel>Document outline</ToolboxLabel>
        {headings.length === 0 ? (
          <p
            style={{
              fontFamily: 'var(--studio-font-body)',
              fontSize: '12px',
              color: 'var(--studio-text-3)',
              fontStyle: 'italic',
              margin: '8px 0 0',
            }}
          >
            No headings yet. Add headings to see an outline.
          </p>
        ) : (
          <div style={{ marginTop: '6px' }}>
            {headings.map((h, i) => (
              <button
                key={`${h.text}-${i}`}
                type="button"
                onClick={() => scrollToHeading(h.text)}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left' as const,
                  padding: '3px 0',
                  paddingLeft: `${(h.level - 1) * 12}px`,
                  fontFamily: 'var(--studio-font-body)',
                  fontSize: h.level === 1 ? '13px' : '12px',
                  fontWeight: h.level <= 2 ? 600 : 400,
                  color:
                    h.level === 1
                      ? 'var(--studio-text-bright)'
                      : 'var(--studio-text-2)',
                  backgroundColor: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  lineHeight: 1.4,
                  transition: 'color 0.1s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = typeInfo.color;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color =
                    h.level === 1
                      ? 'var(--studio-text-bright)'
                      : 'var(--studio-text-2)';
                }}
              >
                {h.text}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Word count + target */}
      <div style={{ marginBottom: '20px' }}>
        <ToolboxLabel>Word count</ToolboxLabel>
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: '6px',
            marginTop: '6px',
          }}
        >
          <span
            style={{
              fontFamily: 'var(--studio-font-mono)',
              fontSize: '22px',
              fontWeight: 700,
              color: 'var(--studio-text-bright)',
            }}
          >
            {wordCount.toLocaleString()}
          </span>
          <span
            style={{
              fontFamily: 'var(--studio-font-mono)',
              fontSize: '10px',
              color: 'var(--studio-text-3)',
            }}
          >
            / {target.toLocaleString()} target
          </span>
        </div>
        {/* Progress bar */}
        <div
          style={{
            width: '100%',
            height: '4px',
            backgroundColor: 'rgba(237, 231, 220, 0.08)',
            borderRadius: '2px',
            marginTop: '6px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${progress}%`,
              height: '100%',
              backgroundColor:
                progress >= 100
                  ? '#5A7A4A'
                  : typeInfo.color,
              borderRadius: '2px',
              transition: 'width 0.3s ease',
            }}
          />
        </div>
      </div>

      {/* Save button */}
      <div style={{ marginBottom: '20px' }}>
        <button
          type="button"
          onClick={onSave}
          className={saveState === 'saving' ? 'studio-save-pulse' : undefined}
          style={{
            width: '100%',
            padding: '8px 12px',
            fontFamily: 'var(--studio-font-mono)',
            fontSize: '10px',
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase' as const,
            color: 'var(--studio-text-bright)',
            backgroundColor: studioMix(saveColor, 16),
            border: `1px solid ${studioMix(saveColor, 35)}`,
            borderRadius: '4px',
            cursor: 'pointer',
            transition: 'all 0.12s ease',
            boxShadow:
              saveState === 'success' || saveState === 'error'
                ? `0 0 14px ${studioMix(saveColor, 35)}`
                : undefined,
          }}
        >
          {saveLabel}
        </button>
        {autosaveState === 'saved' && (
          <p
            style={{
              fontFamily: 'var(--studio-font-mono)',
              fontSize: '9px',
              color: 'var(--studio-text-3)',
              marginTop: '4px',
              textAlign: 'center' as const,
            }}
          >
            Saved
          </p>
        )}
        {lastSaved && (
          <p
            style={{
              fontFamily: 'var(--studio-font-mono)',
              fontSize: '9px',
              color: 'var(--studio-text-3)',
              marginTop: '4px',
              textAlign: 'center' as const,
            }}
          >
            Last saved {lastSaved}
          </p>
        )}
      </div>

      {/* Export dropdown */}
      <div style={{ position: 'relative' }}>
        <ToolboxLabel>Export</ToolboxLabel>
        <div
          style={{
            display: 'flex',
            gap: '6px',
            marginTop: '6px',
          }}
        >
          <ExportButton label="HTML" onClick={handleExportMarkdown} />
          <ExportButton
            label="PDF"
            onClick={() => setExportOpen(false)}
            disabled
            tooltip="Coming soon"
          />
          <ExportButton
            label="TXT"
            onClick={() => setExportOpen(false)}
            disabled
            tooltip="Coming soon"
          />
        </div>
      </div>
    </>
  );
}

/* ── Notes Mode ──────────────────────────────── */

function NotesMode({
  contentItem,
}: {
  contentItem: StudioContentItem | null;
}) {
  const slug = contentItem?.slug ?? 'unsaved';
  const storageKey = `studio-todos-${slug}`;
  const metrics = contentItem
    ? { sources: Math.floor((contentItem.wordCount ?? 0) / 300), links: 2 }
    : { sources: 0, links: 0 };

  /* Todo list state */
  const [todos, setTodos] = useState<TodoItem[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const stored = localStorage.getItem(storageKey);
      return stored ? (JSON.parse(stored) as TodoItem[]) : [];
    } catch {
      return [];
    }
  });

  const [newTodo, setNewTodo] = useState('');

  /* Persist todos */
  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(todos));
  }, [todos, storageKey]);

  const addTodo = useCallback(() => {
    const text = newTodo.trim();
    if (!text) return;
    setTodos((prev) => [...prev, { text, done: false }]);
    setNewTodo('');
  }, [newTodo]);

  const toggleTodo = useCallback((index: number) => {
    setTodos((prev) =>
      prev.map((t, i) => (i === index ? { ...t, done: !t.done } : t)),
    );
  }, []);

  const removeTodo = useCallback((index: number) => {
    setTodos((prev) => prev.filter((_, i) => i !== index));
  }, []);

  return (
    <>
      {/* Sources placeholder */}
      <div style={{ marginBottom: '20px' }}>
        <ToolboxLabel>Sources</ToolboxLabel>
        <p
          style={{
            fontFamily: 'var(--studio-font-body)',
            fontSize: '12px',
            color: 'var(--studio-text-3)',
            margin: '6px 0 0',
          }}
        >
          {metrics.sources} source{metrics.sources !== 1 ? 's' : ''} referenced
        </p>
      </div>

      {/* Links placeholder */}
      <div style={{ marginBottom: '20px' }}>
        <ToolboxLabel>Links</ToolboxLabel>
        <p
          style={{
            fontFamily: 'var(--studio-font-body)',
            fontSize: '12px',
            color: 'var(--studio-text-3)',
            margin: '6px 0 0',
          }}
        >
          {metrics.links} internal link{metrics.links !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Notes placeholder */}
      <div style={{ marginBottom: '20px' }}>
        <ToolboxLabel>Notes</ToolboxLabel>
        <p
          style={{
            fontFamily: 'var(--studio-font-body)',
            fontSize: '12px',
            color: 'var(--studio-text-3)',
            fontStyle: 'italic',
            margin: '6px 0 0',
          }}
        >
          Session notes will appear here.
        </p>
      </div>

      {/* Todo list */}
      <div>
        <ToolboxLabel>Todos</ToolboxLabel>
        <div style={{ marginTop: '6px' }}>
          {/* Add input */}
          <div style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
            <input
              type="text"
              value={newTodo}
              onChange={(e) => setNewTodo(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') addTodo();
              }}
              placeholder="Add a todo..."
              style={{
                flex: 1,
                fontFamily: 'var(--studio-font-mono)',
                fontSize: '11px',
                color: 'var(--studio-text-bright)',
                backgroundColor: 'transparent',
                border: '1px solid var(--studio-tc)',
                borderRadius: '3px',
                padding: '5px 8px',
                outline: 'none',
              }}
            />
            <button
              type="button"
              onClick={addTodo}
              style={{
                fontFamily: 'var(--studio-font-mono)',
                fontSize: '11px',
                fontWeight: 700,
                color: 'var(--studio-tc)',
                backgroundColor: 'transparent',
                border: '1px solid var(--studio-tc)',
                borderRadius: '3px',
                padding: '5px 8px',
                cursor: 'pointer',
              }}
            >
              +
            </button>
          </div>

          {/* Todo items */}
          {todos.map((todo, i) => (
            <div
              key={`${todo.text}-${i}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 0',
              }}
            >
              <input
                type="checkbox"
                checked={todo.done}
                onChange={() => toggleTodo(i)}
                style={{
                  accentColor: 'var(--studio-tc)',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  flex: 1,
                  fontFamily: 'var(--studio-font-body)',
                  fontSize: '12px',
                  color: todo.done
                    ? 'var(--studio-text-3)'
                    : 'var(--studio-text-2)',
                  textDecoration: todo.done ? 'line-through' : 'none',
                  lineHeight: 1.3,
                }}
              >
                {todo.text}
              </span>
              <button
                type="button"
                onClick={() => removeTodo(i)}
                aria-label="Remove todo"
                style={{
                  fontFamily: 'var(--studio-font-mono)',
                  fontSize: '10px',
                  color: 'var(--studio-text-3)',
                  backgroundColor: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '0 2px',
                  opacity: 0.5,
                }}
              >
                &times;
              </button>
            </div>
          ))}

          {todos.length === 0 && (
            <p
              style={{
                fontFamily: 'var(--studio-font-body)',
                fontSize: '12px',
                color: 'var(--studio-text-3)',
                fontStyle: 'italic',
              }}
            >
              No todos yet.
            </p>
          )}
        </div>
      </div>
    </>
  );
}

/* ── Shared small components ─────────────────── */

function ToolboxLabel({ children }: { children: string }) {
  return (
    <div
      style={{
        fontFamily: 'var(--studio-font-mono)',
        fontSize: '8.5px',
        fontWeight: 700,
        letterSpacing: '0.12em',
        textTransform: 'uppercase' as const,
        color: 'var(--studio-text-3)',
      }}
    >
      {children}
    </div>
  );
}

function ExportButton({
  label,
  onClick,
  disabled,
  tooltip,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tooltip?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={tooltip}
      style={{
        flex: 1,
        padding: '5px 0',
        fontFamily: 'var(--studio-font-mono)',
        fontSize: '10px',
        fontWeight: 600,
        letterSpacing: '0.06em',
        textTransform: 'uppercase' as const,
        color: disabled ? 'var(--studio-text-3)' : 'var(--studio-text-2)',
        backgroundColor: 'var(--studio-surface)',
        border: '1px solid var(--studio-border)',
        borderRadius: '3px',
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'all 0.1s ease',
      }}
    >
      {label}
    </button>
  );
}
