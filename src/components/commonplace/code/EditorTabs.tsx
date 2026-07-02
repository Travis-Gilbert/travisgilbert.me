'use client';

/**
 * EditorTabs (HANDOFF-CODE-SURFACE-UI D7): the center editor for the active
 * FILE tab in the code surface. The shell decides when this is visible and
 * owns the tab strip (including its keyboard contract); this component owns
 * the buffer: load on activation, dirty tracking, mod+s save through the
 * file API, and token-derived theming for both editor hosts.
 *
 * Desktop (fine pointer + wide viewport): Monaco via @monaco-editor/react,
 * dynamically imported with ssr:false (Next 16: client-only mount).
 * Mobile: CodeMirror 6 wired raw (EditorView + basicSetup + lang-*).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useHotkeys } from 'react-hotkeys-hook';
import { toast } from 'sonner';
import { EditorView } from '@codemirror/view';
import { EditorState, type Extension } from '@codemirror/state';
import { basicSetup } from 'codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { json } from '@codemirror/lang-json';
import { markdown } from '@codemirror/lang-markdown';
import { python } from '@codemirror/lang-python';
import { useCodeSurfaceStore } from '@/lib/code-surface-store';
import { tokenColorHex, tokenFontSizePx, tokenValue } from './token-resolve';

// Monaco mounts client-only; the loader touches window at init time.
const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false });

interface LoadedDoc {
  path: string;
  content: string;
  truncated: boolean;
}

/** The minimal Monaco surface this component touches (monaco-editor types are not installed). */
interface MonacoThemeHost {
  editor: {
    defineTheme: (
      name: string,
      data: { base: string; inherit: boolean; rules: unknown[]; colors: Record<string, string> },
    ) => void;
  };
}

const THEME_NAME = 'commonplace-code';

const quietLine: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--text--1)',
  color: 'var(--text-faint)',
  padding: 'var(--space-3)',
};

export default function EditorTabs() {
  const centerTabs = useCodeSurfaceStore((s) => s.centerTabs);
  const activeCenterTab = useCodeSurfaceStore((s) => s.activeCenterTab);
  const markTabDirty = useCodeSurfaceStore((s) => s.markTabDirty);

  const activeTab = centerTabs.find((t) => t.id === activeCenterTab && t.kind === 'file') ?? null;
  const activePath = activeTab?.id ?? null;

  const [host, setHost] = useState<'monaco' | 'cm' | null>(null);
  const [doc, setDoc] = useState<LoadedDoc | null>(null);
  const [loadState, setLoadState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [chrome, setChrome] = useState<{ fontFamily: string; fontSize: number } | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const cmHostRef = useRef<HTMLDivElement | null>(null);
  const activePathRef = useRef<string | null>(null);
  const buffersRef = useRef(new Map<string, string>()); // live text per path
  const loadedRef = useRef(new Map<string, string>()); // text at last load/save
  const truncatedRef = useRef(new Map<string, boolean>());
  const dirtyFlagsRef = useRef(new Map<string, boolean>());
  activePathRef.current = activePath;

  // Host selection: fine pointer + wide viewport gets Monaco, everything else
  // CodeMirror. Breakpoint is expressed in rem so no px literal enters source.
  useEffect(() => {
    const mq = window.matchMedia('(pointer: fine) and (min-width: 48rem)');
    const apply = () => setHost(mq.matches ? 'monaco' : 'cm');
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  // Resolve font tokens once the container exists (literals stay at runtime).
  useEffect(() => {
    if (!containerRef.current || host === null) return;
    setChrome({
      fontFamily: tokenValue('--font-mono', containerRef.current),
      fontSize: tokenFontSizePx('--text--1', containerRef.current),
    });
  }, [host]);

  const handleChange = useCallback(
    (path: string, text: string) => {
      buffersRef.current.set(path, text);
      const dirty = text !== loadedRef.current.get(path);
      if (dirtyFlagsRef.current.get(path) !== dirty) {
        dirtyFlagsRef.current.set(path, dirty);
        markTabDirty(path, dirty);
      }
    },
    [markTabDirty],
  );

  // Load content on tab activation. A dirty buffer wins over a refetch so
  // switching tabs never clobbers unsaved edits.
  useEffect(() => {
    if (!activePath) {
      setDoc(null);
      setLoadState('idle');
      return;
    }
    if (dirtyFlagsRef.current.get(activePath) && buffersRef.current.has(activePath)) {
      setDoc({
        path: activePath,
        content: buffersRef.current.get(activePath) ?? '',
        truncated: truncatedRef.current.get(activePath) ?? false,
      });
      setLoadState('idle');
      return;
    }
    let cancelled = false;
    setLoadState('loading');
    setLoadError(null);
    (async () => {
      try {
        const res = await fetch(
          `/api/commonplace/code/file?path=${encodeURIComponent(activePath)}`,
          { cache: 'no-store' },
        );
        const payload = (await res.json().catch(() => null)) as
          | { ok?: boolean; content?: string; truncated?: boolean; error?: string }
          | null;
        if (cancelled) return;
        if (!res.ok || !payload?.ok || typeof payload.content !== 'string') {
          setLoadState('error');
          setLoadError(payload?.error ?? `file read failed (${res.status})`);
          return;
        }
        loadedRef.current.set(activePath, payload.content);
        buffersRef.current.set(activePath, payload.content);
        truncatedRef.current.set(activePath, payload.truncated === true);
        setDoc({ path: activePath, content: payload.content, truncated: payload.truncated === true });
        setLoadState('idle');
      } catch (error) {
        if (cancelled) return;
        setLoadState('error');
        setLoadError(error instanceof Error ? error.message : String(error));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activePath]);

  const save = useCallback(async () => {
    const path = activePathRef.current;
    if (!path) return;
    if (truncatedRef.current.get(path)) {
      toast.error('read-only: file exceeds the editor read budget');
      return;
    }
    const content = buffersRef.current.get(path);
    if (content === undefined) return;
    try {
      const res = await fetch('/api/commonplace/code/file', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, content }),
      });
      const payload = (await res.json().catch(() => null)) as
        | { ok?: boolean; gitStatus?: string | null; path?: string; error?: string }
        | null;
      if (!res.ok || !payload?.ok) {
        toast.error(payload?.error ?? `save failed (${res.status})`);
        return;
      }
      loadedRef.current.set(path, content);
      dirtyFlagsRef.current.set(path, false);
      markTabDirty(path, false);
      const gitStatus = typeof payload.gitStatus === 'string' ? payload.gitStatus.trim() : null;
      toast.success(gitStatus ? gitStatus : `${payload.path ?? path} saved (clean)`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    }
  }, [markTabDirty]);

  // mod+s scoped to the editor container (not document-wide).
  const hotkeysRef = useHotkeys<HTMLDivElement>(
    'mod+s',
    () => void save(),
    { preventDefault: true, enableOnFormTags: true, enableOnContentEditable: true },
    [save],
  );
  const bindContainer = useCallback(
    (el: HTMLDivElement | null) => {
      containerRef.current = el;
      hotkeysRef.current = el;
    },
    [hotkeysRef],
  );

  // Theme Monaco from the mounted container's computed tokens; Monaco needs
  // literal colors at defineTheme time, so they are resolved, never authored.
  const defineEditorTheme = useCallback((monaco: unknown) => {
    const el = containerRef.current;
    const colors: Record<string, string> = {};
    const put = (key: string, token: string) => {
      const hex = tokenColorHex(token, el);
      if (hex) colors[key] = hex;
    };
    put('editor.background', '--surface-0');
    put('editor.foreground', '--text');
    put('editorCursor.foreground', '--accent');
    put('editor.lineHighlightBackground', '--surface-1');
    put('editor.selectionBackground', '--accent-soft');
    put('editorLineNumber.foreground', '--text-faint');
    put('editorLineNumber.activeForeground', '--text-dim');
    put('editorWidget.background', '--surface-2');
    put('editorWidget.border', '--border');
    (monaco as MonacoThemeHost).editor.defineTheme(THEME_NAME, {
      base: isDarkHex(colors['editor.background']) ? 'vs-dark' : 'vs',
      inherit: true,
      rules: [],
      colors,
    });
  }, []);

  // CodeMirror host: rebuilt per document. basicSetup deliberately excludes
  // indentWithTab, so Tab moves focus out of the editor by default (the
  // shell's tab strip owns tab-key navigation; nothing to escape here).
  useEffect(() => {
    if (host !== 'cm' || !doc || !cmHostRef.current) return;
    const view = new EditorView({
      parent: cmHostRef.current,
      state: EditorState.create({
        doc: buffersRef.current.get(doc.path) ?? doc.content,
        extensions: [
          basicSetup,
          cmLanguageFor(doc.path),
          EditorState.readOnly.of(doc.truncated),
          EditorView.lineWrapping,
          EditorView.updateListener.of((update) => {
            if (update.docChanged) handleChange(doc.path, update.state.doc.toString());
          }),
          // CodeMirror injects this as CSS, so var() tokens resolve directly;
          // no literal values are needed for the mobile host.
          EditorView.theme({
            '&': {
              backgroundColor: 'var(--surface-0)',
              color: 'var(--text)',
              height: '100%',
              fontSize: 'var(--text--1)',
            },
            '.cm-content': {
              fontFamily: 'var(--font-mono)',
              caretColor: 'var(--accent)',
            },
            '.cm-gutters': {
              backgroundColor: 'var(--surface-0)',
              color: 'var(--text-faint)',
              border: 'none',
            },
            '.cm-activeLine': { backgroundColor: 'var(--surface-1)' },
            '.cm-activeLineGutter': { backgroundColor: 'var(--surface-1)' },
            '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
              backgroundColor: 'var(--accent-soft)',
            },
          }),
        ],
      }),
    });
    return () => view.destroy();
  }, [host, doc, handleChange]);

  if (!activeTab) return null; // the shell only shows this for file tabs

  return (
    <div
      ref={bindContainer}
      style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}
    >
      {loadState === 'loading' && <div style={quietLine}>opening {activeTab.label}</div>}
      {loadState === 'error' && <div style={quietLine}>{loadError ?? 'file unavailable'}</div>}
      {loadState === 'idle' && doc && doc.truncated && (
        <div style={quietLine}>opened read-only: file exceeds the 2MB read budget</div>
      )}
      {loadState === 'idle' && doc && host === 'monaco' && chrome && (
        // Monaco note: Tab indents while editing, but focus is not trapped;
        // Monaco ships tabFocusMode as the user-controlled escape (Ctrl+M,
        // Ctrl+Shift+M on macOS) and we leave that default wiring intact.
        <div style={{ flex: 1, minHeight: 0 }}>
          <MonacoEditor
            path={doc.path}
            value={doc.content}
            language={monacoLanguageFor(doc.path)}
            theme={THEME_NAME}
            beforeMount={defineEditorTheme}
            onChange={(value) => handleChange(doc.path, value ?? '')}
            options={{
              readOnly: doc.truncated,
              fontFamily: chrome.fontFamily,
              fontSize: chrome.fontSize,
              minimap: { enabled: false },
              automaticLayout: true,
              scrollBeyondLastLine: false,
            }}
          />
        </div>
      )}
      {loadState === 'idle' && doc && host === 'cm' && (
        <div ref={cmHostRef} style={{ flex: 1, minHeight: 0, overflow: 'auto' }} />
      )}
    </div>
  );
}

function monacoLanguageFor(path: string): string {
  switch (extensionOf(path)) {
    case 'ts':
    case 'tsx':
      return 'typescript';
    case 'js':
    case 'jsx':
    case 'mjs':
    case 'cjs':
      return 'javascript';
    case 'json':
      return 'json';
    case 'md':
    case 'markdown':
      return 'markdown';
    case 'py':
      return 'python';
    case 'css':
      return 'css';
    case 'scss':
      return 'scss';
    case 'html':
      return 'html';
    case 'rs':
      return 'rust';
    case 'yaml':
    case 'yml':
      return 'yaml';
    case 'sh':
    case 'bash':
      return 'shell';
    default:
      return 'plaintext';
  }
}

function cmLanguageFor(path: string): Extension {
  switch (extensionOf(path)) {
    case 'ts':
    case 'tsx':
      return javascript({ typescript: true, jsx: true });
    case 'js':
    case 'jsx':
    case 'mjs':
    case 'cjs':
      return javascript({ jsx: true });
    case 'json':
      return json();
    case 'md':
    case 'markdown':
      return markdown();
    case 'py':
      return python();
    default:
      return [];
  }
}

function extensionOf(path: string): string {
  const dot = path.lastIndexOf('.');
  return dot >= 0 ? path.slice(dot + 1).toLowerCase() : '';
}

/** Rough luminance check on a resolved #rrggbb so Monaco's base matches the surface. */
function isDarkHex(hex: string | undefined): boolean {
  if (!hex || hex.length < 7) return false;
  const r = Number.parseInt(hex.slice(1, 3), 16);
  const g = Number.parseInt(hex.slice(3, 5), 16);
  const b = Number.parseInt(hex.slice(5, 7), 16);
  return (r + g + b) / 3 < 128;
}
