'use client';

import Link from 'next/link';
import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import type { Editor as TiptapEditorType } from '@tiptap/react';
import type {
  StudioContentItem,
  StudioPulseInsight,
  StudioContentItemWithMetrics,
} from '@/lib/studio';
import { getContentTypeIdentity, studioMix } from '@/lib/studio';
import {
  getMockContentItems,
  getMockStudioPulse,
  getMockWorkbenchData,
  computeItemMetrics,
} from '@/lib/studio-mock-data';
import NewContentModal from './NewContentModal';

const STORAGE_KEY = 'studio-workbench-open';
const STORAGE_EDITOR_MODE_KEY = 'studio-workbench-editor-mode';
const STORAGE_WIDTH_KEY = 'studio-workbench-width';

const MIN_WORKBENCH_WIDTH = 240;
const MAX_WORKBENCH_WIDTH = 480;
const DEFAULT_WORKBENCH_WIDTH = 320;

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
}

interface TodoItem {
  text: string;
  done: boolean;
}

type SaveState = 'idle' | 'saving' | 'success' | 'error';
type AutosaveState = 'idle' | 'saved';

type WorkbenchMode = 'editor' | 'dashboard';
type EditorPanelMode = 'outline' | 'notes';

function clampWidth(width: number): number {
  return Math.min(Math.max(width, MIN_WORKBENCH_WIDTH), MAX_WORKBENCH_WIDTH);
}

/**
 * Shared right-side workbench shown across all Studio pages.
 *
 * Modes:
 * - editor: Outline and Notes for active editor content
 * - dashboard: Studio Pulse, Quiet/Stuck, and Quick Capture
 */
export default function WorkbenchPanel({
  mode,
  editor,
  contentItem,
  onSave,
  lastSaved,
  saveState = 'idle',
  autosaveState = 'idle',
}: {
  mode: WorkbenchMode;
  editor?: TiptapEditorType | null;
  contentItem?: StudioContentItem | null;
  onSave?: () => void;
  lastSaved?: string | null;
  saveState?: SaveState;
  autosaveState?: AutosaveState;
}) {
  const [open, setOpen] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [editorPanelMode, setEditorPanelMode] = useState<EditorPanelMode>('outline');
  const [width, setWidth] = useState(DEFAULT_WORKBENCH_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  const resizeStateRef = useRef<{ startX: number; startWidth: number } | null>(null);

  /* Read persisted state after hydration */
  useEffect(() => {
    const storedOpen = localStorage.getItem(STORAGE_KEY);
    if (storedOpen !== null) {
      setOpen(storedOpen === 'true');
    }

    const storedMode = localStorage.getItem(STORAGE_EDITOR_MODE_KEY);
    if (storedMode === 'outline' || storedMode === 'notes') {
      setEditorPanelMode(storedMode);
    }

    const storedWidth = localStorage.getItem(STORAGE_WIDTH_KEY);
    if (storedWidth) {
      const parsed = Number.parseInt(storedWidth, 10);
      if (!Number.isNaN(parsed)) {
        setWidth(clampWidth(parsed));
      }
    }

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

  /* Persist editor tab mode */
  const switchEditorMode = useCallback((nextMode: EditorPanelMode) => {
    setEditorPanelMode(nextMode);
    localStorage.setItem(STORAGE_EDITOR_MODE_KEY, nextMode);
  }, []);

  const stopResize = useCallback(() => {
    setIsResizing(false);
    resizeStateRef.current = null;
  }, []);

  const onMouseMove = useCallback((event: MouseEvent) => {
    const state = resizeStateRef.current;
    if (!state) {
      return;
    }

    const delta = state.startX - event.clientX;
    const nextWidth = clampWidth(state.startWidth + delta);
    setWidth(nextWidth);
    localStorage.setItem(STORAGE_WIDTH_KEY, String(nextWidth));
  }, []);

  useEffect(() => {
    if (!isResizing) {
      return;
    }

    const handleMouseUp = () => {
      stopResize();
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, onMouseMove, stopResize]);

  const startResize = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      if (!open) {
        return;
      }
      event.preventDefault();
      resizeStateRef.current = { startX: event.clientX, startWidth: width };
      setIsResizing(true);
    },
    [open, width],
  );

  /* Keyboard shortcut: Cmd+. or Ctrl+. */
  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === '.' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        toggle();
      }
    }

    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [toggle]);

  if (!mounted) {
    return null;
  }

  return (
    <aside
      className="studio-workbench studio-workbench-grid studio-scrollbar"
      data-open={open ? 'true' : undefined}
      style={{
        width: open ? `${width}px` : '0px',
        minWidth: open ? `${width}px` : '0px',
        flexShrink: 0,
        backgroundColor: 'var(--studio-bg-sidebar)',
        borderLeft: open ? '1px solid var(--studio-border)' : 'none',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'visible',
        transition: isResizing ? 'none' : 'width 0.2s ease, min-width 0.2s ease',
      }}
    >
      {open && (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize workbench"
          onMouseDown={startResize}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: '10px',
            transform: 'translateX(-50%)',
            cursor: 'col-resize',
            zIndex: 12,
          }}
        />
      )}

      <button
        type="button"
        onClick={toggle}
        aria-label={open ? 'Close workbench' : 'Open workbench'}
        title="Toggle workbench (Cmd+.)"
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
          zIndex: 13,
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
          {mode === 'editor' ? (
            <>
              <div
                style={{
                  display: 'flex',
                  gap: '2px',
                  marginBottom: '16px',
                  borderBottom: '1px solid var(--studio-border)',
                  paddingBottom: '8px',
                }}
              >
                {(['outline', 'notes'] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => switchEditorMode(tab)}
                    style={{
                      flex: 1,
                      padding: '5px 0',
                      fontFamily: 'var(--studio-font-mono)',
                      fontSize: '9.5px',
                      fontWeight: 700,
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase' as const,
                      color:
                        editorPanelMode === tab
                          ? 'var(--studio-text-bright)'
                          : 'var(--studio-text-3)',
                      backgroundColor: 'transparent',
                      border: 'none',
                      borderBottom:
                        editorPanelMode === tab
                          ? '2px solid var(--studio-tc)'
                          : '2px solid transparent',
                      cursor: 'pointer',
                      transition: 'all 0.12s ease',
                    }}
                  >
                    {tab === 'outline' ? 'Outline' : 'Notes'}
                  </button>
                ))}
              </div>

              {editorPanelMode === 'outline' ? (
                <OutlineMode
                  editor={editor ?? null}
                  contentItem={contentItem ?? null}
                  onSave={onSave}
                  lastSaved={lastSaved ?? null}
                  saveState={saveState}
                  autosaveState={autosaveState}
                />
              ) : (
                <NotesMode contentItem={contentItem ?? null} />
              )}
            </>
          ) : (
            <DashboardWorkbench />
          )}
        </div>
      )}
    </aside>
  );
}

/* ── Dashboard mode ──────────────────────────── */

const PULSE_ICONS: Record<StudioPulseInsight['type'], string> = {
  momentum: '\u2191',
  simmering: '\u25CB',
  quiet: '\u2026',
  ready: '\u2192',
  rich: '\u25C7',
};

const PULSE_COLORS: Record<StudioPulseInsight['type'], string> = {
  momentum: '#6A9A5A',
  simmering: '#D4AA4A',
  quiet: '#9A8E82',
  ready: '#3A8A9A',
  rich: '#B45A2D',
};

const PULSE_LABELS: Record<StudioPulseInsight['type'], string> = {
  momentum: 'MOMENTUM',
  simmering: 'SIMMERING',
  quiet: 'QUIET',
  ready: 'READY',
  rich: 'RESEARCH RICH',
};

const CAPTURE_TYPES = [
  { label: 'Note', type: 'field-note', color: '#3A8A9A' },
  { label: 'Source', type: 'shelf', color: '#D4AA4A' },
  { label: 'Idea', type: 'essay', color: '#B45A2D' },
  { label: 'Script Beat', type: 'video', color: '#6A9A5A' },
] as const;

function DashboardWorkbench() {
  const [modalType, setModalType] = useState<string | null>(null);

  const pulse = useMemo(() => getMockStudioPulse(), []);
  const workbench = useMemo(() => getMockWorkbenchData(), []);

  const items = useMemo<StudioContentItemWithMetrics[]>(
    () =>
      getMockContentItems().map((item) => ({
        ...item,
        metrics: computeItemMetrics(item),
      })),
    [],
  );

  const itemByTitle = useMemo(
    () => new Map(items.map((item) => [item.title, item])),
    [items],
  );

  const quietOrStuck = useMemo(() => {
    const stuck = items.filter(
      (item) =>
        item.metrics.stageAgeDays >= 14 &&
        !['idea', 'published'].includes(item.stage),
    );
    const quiet = items.filter(
      (item) =>
        item.metrics.daysSinceLastTouched >= 7 &&
        !['idea', 'published'].includes(item.stage),
    );

    const merged = new Map<string, StudioContentItemWithMetrics>();
    [...stuck, ...quiet].forEach((item) => {
      merged.set(item.id, item);
    });

    return Array.from(merged.values())
      .sort((a, b) => {
        const scoreA = Math.max(a.metrics.daysSinceLastTouched, a.metrics.stageAgeDays);
        const scoreB = Math.max(b.metrics.daysSinceLastTouched, b.metrics.stageAgeDays);
        return scoreB - scoreA;
      })
      .slice(0, 8);
  }, [items]);

  const resolveInsightHref = useCallback(
    (detail: string): string | null => {
      const titleMatch = detail.match(/"([^"]+)"/);
      if (!titleMatch) {
        return null;
      }

      const item = itemByTitle.get(titleMatch[1]);
      if (!item) {
        return null;
      }

      const type = getContentTypeIdentity(item.contentType);
      return `/studio/${type.route}/${item.slug}`;
    },
    [itemByTitle],
  );

  const drafting = workbench.pipelineBreakdown['drafting'] ?? 0;
  const revising = workbench.pipelineBreakdown['revising'] ?? 0;
  const published = workbench.pipelineBreakdown['published'] ?? 0;

  return (
    <>
      <div style={{ marginBottom: '22px' }}>
        <ToolboxLabel>Studio Pulse</ToolboxLabel>

        <div
          style={{
            marginTop: '8px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          {pulse.map((insight, index) => {
            const href = resolveInsightHref(insight.detail);

            return (
              <div key={`${insight.type}-${index}`} style={{ display: 'flex', gap: '10px' }}>
                <span
                  style={{
                    fontFamily: 'var(--studio-font-mono)',
                    fontSize: '14px',
                    color: PULSE_COLORS[insight.type],
                    flexShrink: 0,
                    width: '16px',
                    textAlign: 'center',
                  }}
                >
                  {PULSE_ICONS[insight.type]}
                </span>
                <div style={{ minWidth: 0 }}>
                  <span
                    style={{
                      fontFamily: 'var(--studio-font-mono)',
                      fontSize: '9px',
                      fontWeight: 700,
                      letterSpacing: '0.1em',
                      color: PULSE_COLORS[insight.type],
                      display: 'block',
                      marginBottom: '2px',
                    }}
                  >
                    {PULSE_LABELS[insight.type]}
                  </span>
                  <span
                    style={{
                      fontFamily: 'var(--studio-font-body)',
                      fontSize: '13px',
                      color: 'var(--studio-text-1)',
                      lineHeight: 1.4,
                      display: 'block',
                    }}
                  >
                    {insight.message}
                  </span>

                  {href ? (
                    <Link
                      href={href}
                      style={{
                        fontFamily: 'var(--studio-font-metadata)',
                        fontSize: '10px',
                        color: 'var(--studio-teal)',
                        display: 'inline-block',
                        marginTop: '2px',
                        textDecoration: 'none',
                      }}
                    >
                      {insight.detail}
                    </Link>
                  ) : (
                    <span
                      style={{
                        fontFamily: 'var(--studio-font-metadata)',
                        fontSize: '10px',
                        color: 'var(--studio-text-3)',
                        display: 'block',
                        marginTop: '2px',
                      }}
                    >
                      {insight.detail}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div
          style={{
            display: 'flex',
            gap: '8px',
            marginTop: '14px',
            paddingTop: '12px',
            borderTop: '1px solid var(--studio-border)',
          }}
        >
          <StatTile label="Drafting" count={drafting} color="#D4AA4A" />
          <StatTile label="Revising" count={revising} color="#8A6A9A" />
          <StatTile label="Published" count={published} color="#6A9A5A" />
        </div>
      </div>

      <div style={{ marginBottom: '22px' }}>
        <ToolboxLabel>Quiet / Stuck</ToolboxLabel>

        {quietOrStuck.length > 0 ? (
          <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {quietOrStuck.map((item) => {
              const type = getContentTypeIdentity(item.contentType);
              const daysQuiet = item.metrics.daysSinceLastTouched;
              const daysStuck = item.metrics.stageAgeDays;
              const status =
                daysStuck >= 14 && daysStuck >= daysQuiet
                  ? `${daysStuck}d in stage`
                  : `${daysQuiet}d quiet`;

              return (
                <Link
                  key={item.id}
                  href={`/studio/${type.route}/${item.slug}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    textDecoration: 'none',
                    color: 'inherit',
                    padding: '4px 0',
                  }}
                >
                  <span
                    style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      backgroundColor: type.color,
                      flexShrink: 0,
                    }}
                  />
                  <span
                    style={{
                      fontFamily: 'var(--studio-font-title)',
                      fontSize: '13px',
                      color: 'var(--studio-text-2)',
                      flex: 1,
                      minWidth: 0,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {item.title}
                  </span>
                  <span
                    style={{
                      fontFamily: 'var(--studio-font-mono)',
                      fontSize: '9px',
                      color: 'var(--studio-gold)',
                      flexShrink: 0,
                    }}
                  >
                    {status}
                  </span>
                </Link>
              );
            })}
          </div>
        ) : (
          <p
            style={{
              margin: '8px 0 0',
              fontFamily: 'var(--studio-font-body)',
              fontSize: '12px',
              color: 'var(--studio-text-3)',
              fontStyle: 'italic',
            }}
          >
            Nothing is stalled right now.
          </p>
        )}
      </div>

      <div>
        <ToolboxLabel>Quick Capture</ToolboxLabel>
        <div className="studio-capture-grid" style={{ marginTop: '8px' }}>
          {CAPTURE_TYPES.map((cap) => (
            <button
              key={cap.type}
              type="button"
              className="studio-capture-btn"
              style={{
                backgroundColor: studioMix(cap.color, 8),
                color: cap.color,
              }}
              onClick={() => setModalType(cap.type)}
            >
              {cap.label}
            </button>
          ))}
        </div>

        {modalType && (
          <NewContentModal
            defaultType={modalType}
            onClose={() => setModalType(null)}
          />
        )}
      </div>
    </>
  );
}

function StatTile({
  label,
  count,
  color,
}: {
  label: string;
  count: number;
  color: string;
}) {
  return (
    <div
      style={{
        flex: 1,
        textAlign: 'center',
        padding: '8px 4px',
        borderRadius: '4px',
        backgroundColor: studioMix(color, 6),
      }}
    >
      <div
        style={{
          fontFamily: 'var(--studio-font-mono)',
          fontSize: '18px',
          fontWeight: 700,
          color,
        }}
      >
        {count}
      </div>
      <div
        style={{
          fontFamily: 'var(--studio-font-mono)',
          fontSize: '8px',
          fontWeight: 600,
          letterSpacing: '0.1em',
          textTransform: 'uppercase' as const,
          color: 'var(--studio-text-3)',
          marginTop: '2px',
        }}
      >
        {label}
      </div>
    </div>
  );
}

/* ── Outline mode ────────────────────────────── */

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

    editor.state.doc.descendants((node) => {
      if (node.type.name === 'heading' && node.textContent.trim()) {
        result.push({
          level: (node.attrs.level as number) ?? 1,
          text: node.textContent,
        });
      }
      return true;
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
        return true;
      });

      if (targetPos > 0) {
        editor.commands.focus();
        editor.commands.setTextSelection(targetPos + 1);

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

  const handleExportHtml = useCallback(() => {
    if (!editor) return;

    const html = editor.getHTML();
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${contentItem?.slug ?? 'export'}.html`;
    anchor.click();
    URL.revokeObjectURL(url);
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
            {headings.map((heading, index) => (
              <button
                key={`${heading.text}-${index}`}
                type="button"
                onClick={() => scrollToHeading(heading.text)}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left' as const,
                  padding: '3px 0',
                  paddingLeft: `${(heading.level - 1) * 12}px`,
                  fontFamily: 'var(--studio-font-body)',
                  fontSize: heading.level === 1 ? '13px' : '12px',
                  fontWeight: heading.level <= 2 ? 600 : 400,
                  color:
                    heading.level === 1
                      ? 'var(--studio-text-bright)'
                      : 'var(--studio-text-2)',
                  backgroundColor: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  lineHeight: 1.4,
                  transition: 'color 0.1s',
                }}
                onMouseEnter={(event) => {
                  event.currentTarget.style.color = typeInfo.color;
                }}
                onMouseLeave={(event) => {
                  event.currentTarget.style.color =
                    heading.level === 1
                      ? 'var(--studio-text-bright)'
                      : 'var(--studio-text-2)';
                }}
              >
                {heading.text}
              </button>
            ))}
          </div>
        )}
      </div>

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
              backgroundColor: progress >= 100 ? '#5A7A4A' : typeInfo.color,
              borderRadius: '2px',
              transition: 'width 0.3s ease',
            }}
          />
        </div>
      </div>

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

      <div>
        <ToolboxLabel>Export</ToolboxLabel>
        <div
          style={{
            display: 'flex',
            gap: '6px',
            marginTop: '6px',
          }}
        >
          <ExportButton label="HTML" onClick={handleExportHtml} />
          <ExportButton
            label="PDF"
            onClick={() => undefined}
            disabled
            tooltip="Coming soon"
          />
          <ExportButton
            label="TXT"
            onClick={() => undefined}
            disabled
            tooltip="Coming soon"
          />
        </div>
      </div>
    </>
  );
}

/* ── Notes mode ──────────────────────────────── */

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
      prev.map((todo, currentIndex) =>
        currentIndex === index ? { ...todo, done: !todo.done } : todo,
      ),
    );
  }, []);

  const removeTodo = useCallback((index: number) => {
    setTodos((prev) => prev.filter((_, currentIndex) => currentIndex !== index));
  }, []);

  return (
    <>
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

      <div>
        <ToolboxLabel>Todos</ToolboxLabel>
        <div style={{ marginTop: '6px' }}>
          <div style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
            <input
              type="text"
              value={newTodo}
              onChange={(event) => setNewTodo(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  addTodo();
                }
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

          {todos.map((todo, index) => (
            <div
              key={`${todo.text}-${index}`}
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
                onChange={() => toggleTodo(index)}
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
                  color: todo.done ? 'var(--studio-text-3)' : 'var(--studio-text-2)',
                  textDecoration: todo.done ? 'line-through' : 'none',
                  lineHeight: 1.3,
                }}
              >
                {todo.text}
              </span>
              <button
                type="button"
                onClick={() => removeTodo(index)}
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
