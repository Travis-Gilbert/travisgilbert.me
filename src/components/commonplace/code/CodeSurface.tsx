'use client';

/**
 * CodeSurface (HANDOFF-CODE-SURFACE-UI D2): the four-region shell.
 *
 * Archetype: authoring. Primary = the conversation column (reading width,
 * dominates). Secondary = left rail, right environment panel, bottom terminal
 * drawer, all collapsible. Plumbing renders only behind the dev toggle
 * (see EnvironmentPanel).
 *
 * react-resizable-panels v4 replaced the v3 `PanelGroup autoSaveId` API with
 * `Group`/`Panel`/`Separator` + `useDefaultLayout`; layout persistence keyed
 * "cp-code-shell" / "cp-code-vert" satisfies "sizes survive reload".
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import { Drawer } from 'vaul';
import { Group, Panel, Separator, useDefaultLayout } from 'react-resizable-panels';
import { FileTree, useFileTree } from '@pierre/trees/react';
import type { GitStatus, GitStatusEntry } from '@pierre/trees';
import { PanelLeft, PanelRight, Search, Terminal, X } from 'lucide-react';
import { useOwner } from '@/components/OwnerProvider';
import { useCodeSurfaceStore, type CenterTab } from '@/lib/code-surface-store';
import type { CommonPlaceCodeChangedFile, CommonPlaceCodeStatus } from '@/lib/commonplace-code';
import { probeRuntime } from '@/lib/commonplace-runtime';
import ConversationColumn from './ConversationColumn';
import EditorTabs from './EditorTabs';
import BrowserToolSlot from './BrowserToolSlot';
import TerminalDrawer from './TerminalDrawer';
import EnvironmentPanel from './EnvironmentPanel';
import CodeOmnibox from './CodeOmnibox';

const STATUS_ENDPOINT = '/api/commonplace/code/status';
/** Spec: refresh workspace status every 30 seconds. */
const STATUS_POLL_INTERVAL = 30_000;
/** Spec-mandated breakpoint: below this the shell swaps panels for vaul drawers. */
const MOBILE_MEDIA_QUERY = '(max-width: 760px)';
const SESSION_TREE_PREFIX = 'sessions/';

export default function CodeSurface() {
  const { isOwner } = useOwner();
  const status = useCodeSurfaceStore((s) => s.status);
  const statusError = useCodeSurfaceStore((s) => s.statusError);
  const runs = useCodeSurfaceStore((s) => s.runs);
  const rightPanelOpen = useCodeSurfaceStore((s) => s.rightPanelOpen);
  const terminalOpen = useCodeSurfaceStore((s) => s.terminalOpen);
  const centerTabs = useCodeSurfaceStore((s) => s.centerTabs);
  const activeCenterTab = useCodeSurfaceStore((s) => s.activeCenterTab);
  const setStatus = useCodeSurfaceStore((s) => s.setStatus);
  const setRuntimeAvailable = useCodeSurfaceStore((s) => s.setRuntimeAvailable);
  const setRightPanelOpen = useCodeSurfaceStore((s) => s.setRightPanelOpen);
  const setTerminalOpen = useCodeSurfaceStore((s) => s.setTerminalOpen);
  const setOmniboxOpen = useCodeSurfaceStore((s) => s.setOmniboxOpen);
  const openTab = useCodeSurfaceStore((s) => s.openTab);
  const closeTab = useCodeSurfaceStore((s) => s.closeTab);
  const activateTab = useCodeSurfaceStore((s) => s.activateTab);

  const isMobile = useIsMobile();
  const [railDrawerOpen, setRailDrawerOpen] = useState(false);

  /* ---- status fetch (moved here from the CommonPlaceCodeView prototype) ---- */

  const loadStatus = useCallback(
    async (signal?: AbortSignal) => {
      if (!isOwner) {
        setStatus(null, 'Owner sign in is required for the code workspace.');
        return;
      }
      try {
        const response = await fetch(STATUS_ENDPOINT, { cache: 'no-store', signal });
        if (response.status === 401) {
          setStatus(null, 'Owner sign in is required for the code workspace.');
          return;
        }
        const payload = (await response.json()) as CommonPlaceCodeStatus | { error?: string };
        if (!response.ok || !('workspace' in payload)) {
          const message =
            'error' in payload && payload.error
              ? payload.error
              : `Status request failed with ${response.status}`;
          throw new Error(message);
        }
        setStatus(payload);
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setStatus(null, error instanceof Error ? error.message : String(error));
      }
    },
    [isOwner, setStatus],
  );

  useEffect(() => {
    const controller = new AbortController();
    void loadStatus(controller.signal);
    const timer = window.setInterval(() => void loadStatus(), STATUS_POLL_INTERVAL);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [loadStatus]);

  useEffect(() => {
    let cancelled = false;
    void probeRuntime().then((available) => {
      if (!cancelled) setRuntimeAvailable(available);
    });
    return () => {
      cancelled = true;
    };
  }, [setRuntimeAvailable]);

  /* ---- rail tree: real data only (changed files + session nodes) ---- */

  const changedFiles = useMemo(() => status?.git.changedFiles ?? [], [status]);

  const sessionEntries = useMemo(() => {
    const seen = new Map<string, number>();
    return runs.map((run, index) => {
      const base = sessionTreeLabel(run.task) || `session ${index + 1}`;
      const count = seen.get(base) ?? 0;
      seen.set(base, count + 1);
      const label = count === 0 ? base : `${base} (${count + 1})`;
      return { runId: run.id, path: `${SESSION_TREE_PREFIX}${label}` };
    });
  }, [runs]);

  const treePaths = useMemo(
    () => [...sessionEntries.map((entry) => entry.path), ...changedFiles.map((file) => file.path)],
    [sessionEntries, changedFiles],
  );

  const gitEntries = useMemo<GitStatusEntry[]>(
    () =>
      changedFiles.map((file) => ({
        path: file.path,
        status: toTreeGitStatus(file),
      })),
    [changedFiles],
  );

  const sessionByPathRef = useRef(new Map<string, string>());
  const filePathsRef = useRef(new Set<string>());
  useEffect(() => {
    sessionByPathRef.current = new Map(sessionEntries.map((entry) => [entry.path, entry.runId]));
    filePathsRef.current = new Set(changedFiles.map((file) => file.path));
  }, [sessionEntries, changedFiles]);

  const handleTreeSelection = useCallback(
    (selected: readonly string[]) => {
      const path = selected[selected.length - 1];
      if (!path) return;
      const runId = sessionByPathRef.current.get(path);
      if (runId) {
        activateTab('conversation');
        window.dispatchEvent(new CustomEvent('cp-code-scroll-to-run', { detail: { runId } }));
        return;
      }
      if (filePathsRef.current.has(path)) {
        openTab({ id: path, kind: 'file', label: pathBasename(path) });
      }
    },
    [activateTab, openTab],
  );
  const handleTreeSelectionRef = useRef(handleTreeSelection);
  useEffect(() => {
    handleTreeSelectionRef.current = handleTreeSelection;
  }, [handleTreeSelection]);

  const { model } = useFileTree({
    paths: [],
    initialExpansion: 'open',
    onSelectionChange: (selected) => handleTreeSelectionRef.current(selected),
  });

  useEffect(() => {
    model.resetPaths(treePaths);
    model.setGitStatus(gitEntries);
  }, [model, treePaths, gitEntries]);

  /* ---- layout persistence (react-resizable-panels v4) ---- */

  const shellLayout = useDefaultLayout({
    id: 'cp-code-shell',
    panelIds: ['cp-code-rail', 'cp-code-center', 'cp-code-right'],
    onlySaveAfterUserInteractions: true,
  });
  const vertLayout = useDefaultLayout({
    id: 'cp-code-vert',
    panelIds: ['cp-code-main', 'cp-code-terminal'],
    onlySaveAfterUserInteractions: true,
  });

  const project = status?.workspace.project ?? null;
  const hasRailContent = Boolean(project || treePaths.length > 0);

  /* ---- shared regions ---- */

  const railContent = hasRailContent ? (
    <div className="cpcs-rail-inner">
      {project ? <div className="cpcs-rail-project">{project}</div> : null}
      {treePaths.length > 0 ? (
        <div className="cpcs-rail-tree">
          <FileTree
            model={model}
            aria-label="Workspace files and sessions"
            style={{
              blockSize: '100%',
              ['--trees-selected-bg-override' as string]: 'var(--accent-soft)',
              ['--trees-border-color-override' as string]: 'var(--border)',
            }}
          />
        </div>
      ) : null}
    </div>
  ) : null;

  const terminalContent = (
    <div className="cpcs-terminal-inner">
      <div className="cpcs-terminal-head">
        <span className="cpcs-mono-label">terminal</span>
        <button
          type="button"
          className="cpcs-icon-btn"
          aria-label="Close terminal"
          onClick={() => setTerminalOpen(false)}
        >
          <X className="cpcs-icon" aria-hidden />
        </button>
      </div>
      <div className="cpcs-terminal-body">
        <TerminalDrawer />
      </div>
    </div>
  );

  const controls = (
    <div className="cpcs-controls" role="toolbar" aria-label="Surface controls">
      {isMobile && hasRailContent ? (
        <button
          type="button"
          className="cpcs-icon-btn"
          aria-label="Open workspace rail"
          onClick={() => setRailDrawerOpen(true)}
        >
          <PanelLeft className="cpcs-icon" aria-hidden />
        </button>
      ) : null}
      <button
        type="button"
        className="cpcs-icon-btn"
        aria-label="Open omnibox"
        onClick={() => setOmniboxOpen(true)}
      >
        <Search className="cpcs-icon" aria-hidden />
      </button>
      <button
        type="button"
        className="cpcs-icon-btn"
        aria-label={rightPanelOpen ? 'Collapse environment panel' : 'Expand environment panel'}
        aria-pressed={rightPanelOpen}
        onClick={() => setRightPanelOpen(!rightPanelOpen)}
      >
        <PanelRight className="cpcs-icon" aria-hidden />
      </button>
      <button
        type="button"
        className="cpcs-icon-btn"
        aria-label={terminalOpen ? 'Close terminal drawer' : 'Open terminal drawer'}
        aria-pressed={terminalOpen}
        onClick={() => setTerminalOpen(!terminalOpen)}
      >
        <Terminal className="cpcs-icon" aria-hidden />
      </button>
    </div>
  );

  const centerColumn = (
    <div className="cpcs-center">
      <Tabs.Root
        className="cpcs-tabs"
        value={activeCenterTab}
        onValueChange={activateTab}
        activationMode="automatic"
      >
        <div className="cpcs-topbar">
          {centerTabs.length > 1 ? (
            <Tabs.List className="cpcs-tabstrip" aria-label="Open tabs" loop>
              {centerTabs.map((tab) => (
                <div className="cpcs-tab" key={tab.id}>
                  <Tabs.Trigger className="cpcs-tab-trigger" value={tab.id}>
                    {tab.label}
                    {tab.dirty ? <span className="cpcs-dirty-dot" aria-label="Unsaved changes" /> : null}
                  </Tabs.Trigger>
                  {tab.id !== 'conversation' ? (
                    <button
                      type="button"
                      className="cpcs-icon-btn cpcs-tab-close"
                      aria-label={`Close ${tab.label}`}
                      onClick={() => closeTab(tab.id)}
                    >
                      <X className="cpcs-icon" aria-hidden />
                    </button>
                  ) : null}
                </div>
              ))}
            </Tabs.List>
          ) : (
            <div className="cpcs-topbar-spacer" />
          )}
          {controls}
        </div>
        {statusError && !status ? <p className="cpcs-quiet-line cpcs-status-line">{statusError}</p> : null}
        {centerTabs.map((tab) => (
          <Tabs.Content className="cpcs-tab-content" key={tab.id} value={tab.id}>
            {renderCenterTab(tab)}
          </Tabs.Content>
        ))}
      </Tabs.Root>
    </div>
  );

  return (
    <div className="cpcs-root">
      <style>{SURFACE_CSS}</style>
      <CodeOmnibox />
      {isMobile ? (
        <div className="cpcs-mobile">
          {centerColumn}
          {railContent ? (
            <SurfaceDrawer
              title="Workspace rail"
              direction="left"
              className="cpcs-drawer cpcs-drawer-left"
              open={railDrawerOpen}
              onOpenChange={setRailDrawerOpen}
            >
              {railContent}
            </SurfaceDrawer>
          ) : null}
          <SurfaceDrawer
            title="Environment"
            direction="right"
            className="cpcs-drawer cpcs-drawer-right"
            open={rightPanelOpen}
            onOpenChange={setRightPanelOpen}
          >
            <EnvironmentPanel />
          </SurfaceDrawer>
          <SurfaceDrawer
            title="Terminal"
            direction="bottom"
            className="cpcs-drawer cpcs-drawer-bottom"
            open={terminalOpen}
            onOpenChange={setTerminalOpen}
          >
            {terminalContent}
          </SurfaceDrawer>
        </div>
      ) : (
        <Group
          orientation="vertical"
          id="cp-code-vert"
          className="cpcs-vert"
          defaultLayout={vertLayout.defaultLayout}
          onLayoutChanged={vertLayout.onLayoutChanged}
        >
          <Panel id="cp-code-main" minSize="40%" className="cpcs-main-panel">
            <Group
              orientation="horizontal"
              id="cp-code-shell"
              className="cpcs-shell"
              defaultLayout={shellLayout.defaultLayout}
              onLayoutChanged={shellLayout.onLayoutChanged}
            >
              {railContent ? (
                <>
                  <Panel
                    id="cp-code-rail"
                    collapsible
                    defaultSize="18%"
                    minSize="12%"
                    maxSize="32%"
                    className="cpcs-panel-surface"
                  >
                    {railContent}
                  </Panel>
                  <Separator className="cpcs-sep-v" aria-label="Resize workspace rail" />
                </>
              ) : null}
              <Panel id="cp-code-center" minSize="36%" className="cpcs-center-panel">
                {centerColumn}
              </Panel>
              {rightPanelOpen ? (
                <>
                  <Separator className="cpcs-sep-v" aria-label="Resize environment panel" />
                  <Panel
                    id="cp-code-right"
                    collapsible
                    defaultSize="24%"
                    minSize="16%"
                    maxSize="40%"
                    className="cpcs-panel-surface"
                  >
                    <EnvironmentPanel />
                  </Panel>
                </>
              ) : null}
            </Group>
          </Panel>
          {terminalOpen ? (
            <>
              <Separator className="cpcs-sep-h" aria-label="Resize terminal drawer" />
              <Panel
                id="cp-code-terminal"
                collapsible
                defaultSize="28%"
                minSize="12%"
                maxSize="60%"
                className="cpcs-panel-surface"
              >
                {terminalContent}
              </Panel>
            </>
          ) : null}
        </Group>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- helpers */

function renderCenterTab(tab: CenterTab): ReactNode {
  if (tab.kind === 'conversation') {
    return (
      <div className="cpcs-measure">
        <ConversationColumn />
      </div>
    );
  }
  if (tab.kind === 'file') return <EditorTabs />;
  return <BrowserToolSlot />;
}

function SurfaceDrawer({
  title,
  direction,
  className,
  open,
  onOpenChange,
  children,
}: {
  title: string;
  direction: 'left' | 'right' | 'bottom';
  className: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}) {
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange} direction={direction}>
      <Drawer.Portal>
        <Drawer.Overlay className="cpcs-drawer-overlay" />
        <Drawer.Content className={className} aria-describedby={undefined}>
          <Drawer.Title className="cpcs-vh">{title}</Drawer.Title>
          {children}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

function useIsMobile(): boolean {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const query = window.matchMedia(MOBILE_MEDIA_QUERY);
    const update = () => setMobile(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return mobile;
}

function pathBasename(path: string): string {
  const segments = path.split('/');
  return segments[segments.length - 1] || path;
}

function sessionTreeLabel(task: string): string {
  return task
    .replace(/[/\\]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 42);
}

function toTreeGitStatus(file: CommonPlaceCodeChangedFile): GitStatus {
  if (file.untracked) return 'untracked';
  switch (file.status) {
    case 'renamed':
      return 'renamed';
    case 'deleted':
      return 'deleted';
    case 'added':
      return 'added';
    default:
      return 'modified';
  }
}

/**
 * Surface-scoped stylesheet. Tokens only; rendered once from the surface
 * root as a global <style> tag so portal content (omnibox, drawers) is
 * covered too. Motion uses the token trio, which zeroes itself under
 * reduced motion.
 */
const SURFACE_CSS = `
.cpcs-root {
  block-size: 100%;
  min-block-size: 0;
  inline-size: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background-color: var(--surface-0);
  background-image: var(--canvas-strata);
  background-attachment: fixed;
  color: var(--text);
  font-family: var(--font-body);
}
.cpcs-root .cpcs-vert { flex: 1; min-block-size: 0; }
.cpcs-mobile { flex: 1; min-block-size: 0; display: flex; flex-direction: column; }

.cpcs-panel-surface {
  background: var(--surface-translucent);
  backdrop-filter: blur(calc(var(--space-unit) * 2));
  -webkit-backdrop-filter: blur(calc(var(--space-unit) * 2));
  min-block-size: 0;
  block-size: 100%;
}
.cpcs-sep-v { inline-size: var(--hairline-w); background: var(--border); transition: background var(--motion-fast) var(--ease); }
.cpcs-sep-h { block-size: var(--hairline-w); background: var(--border); transition: background var(--motion-fast) var(--ease); }
.cpcs-sep-v:hover, .cpcs-sep-h:hover, .cpcs-sep-v[data-resizing], .cpcs-sep-h[data-resizing] { background: var(--accent); }
.cpcs-sep-v:focus-visible, .cpcs-sep-h:focus-visible { outline: var(--focus-ring); outline-offset: var(--focus-ring-offset); }

.cpcs-rail-inner { block-size: 100%; display: flex; flex-direction: column; min-block-size: 0; }
.cpcs-rail-project {
  font-family: var(--font-mono);
  font-size: var(--text--2);
  color: var(--text-faint);
  padding: var(--space-3) var(--space-3) var(--space-2);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cpcs-rail-tree { flex: 1; min-block-size: 0; padding-inline: var(--space-1); }

.cpcs-center, .cpcs-center-panel { block-size: 100%; min-block-size: 0; display: flex; flex-direction: column; flex: 1; }
.cpcs-tabs { flex: 1; min-block-size: 0; display: flex; flex-direction: column; }
.cpcs-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  padding-inline: var(--space-3);
  border-block-end: var(--hairline);
}
.cpcs-topbar-spacer { flex: 1; }
.cpcs-tabstrip { display: flex; align-items: center; gap: var(--space-1); overflow-x: auto; }
.cpcs-tab { display: flex; align-items: center; }
.cpcs-tab-trigger {
  appearance: none;
  background: none;
  border: none;
  border-block-end: calc(var(--hairline-w) * 2) solid transparent;
  color: var(--text-faint);
  font-family: var(--font-body);
  font-size: var(--text--1);
  padding: var(--space-2) var(--space-3);
  cursor: pointer;
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  transition: color var(--motion-fast) var(--ease), border-color var(--motion-fast) var(--ease);
}
.cpcs-tab-trigger:hover { color: var(--text-dim); }
.cpcs-tab-trigger[data-state='active'] { color: var(--text); border-block-end-color: var(--accent); }
.cpcs-tab-trigger:focus-visible { outline: var(--focus-ring); outline-offset: calc(var(--focus-ring-offset) * -1); }
.cpcs-dirty-dot {
  inline-size: var(--space-2);
  block-size: var(--space-2);
  border-radius: 50%;
  background: var(--accent-agent);
  flex: none;
}
.cpcs-tab-close { margin-inline-start: calc(var(--space-1) * -1); }
.cpcs-tab-content { flex: 1; min-block-size: 0; overflow: auto; display: flex; flex-direction: column; }
.cpcs-tab-content[data-state='inactive'] { display: none; }
.cpcs-measure {
  inline-size: 100%;
  max-inline-size: var(--measure, 68ch);
  margin-inline: auto;
  padding: var(--space-4) var(--space-4) var(--space-6);
  flex: 1;
  min-block-size: 0;
  display: flex;
  flex-direction: column;
}

.cpcs-controls { display: flex; align-items: center; gap: var(--space-1); padding-block: var(--space-1); }
.cpcs-icon-btn {
  appearance: none;
  background: none;
  border: none;
  color: var(--text-faint);
  padding: var(--space-1);
  border-radius: var(--radius-sm);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: color var(--motion-fast) var(--ease), background var(--motion-fast) var(--ease);
}
.cpcs-icon-btn:hover { color: var(--text-dim); }
.cpcs-icon-btn[aria-pressed='true'] { color: var(--accent); }
.cpcs-icon-btn:focus-visible { outline: var(--focus-ring); outline-offset: var(--focus-ring-offset); }
.cpcs-icon { inline-size: var(--space-4); block-size: var(--space-4); }

.cpcs-quiet-line {
  font-family: var(--font-mono);
  font-size: var(--text--2);
  color: var(--text-faint);
  margin: 0;
}
.cpcs-status-line { padding: var(--space-2) var(--space-4); }
.cpcs-mono-label {
  font-family: var(--font-mono);
  font-size: var(--text--2);
  letter-spacing: 0.08em;
  text-transform: lowercase;
  color: var(--text-faint);
}

.cpcs-terminal-inner {
  block-size: 100%;
  min-block-size: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4) var(--space-4);
  font-family: var(--font-mono);
}
.cpcs-terminal-head { display: flex; align-items: center; justify-content: space-between; }
.cpcs-terminal-body { flex: 1; min-block-size: 0; display: flex; flex-direction: column; }
.cpcs-terminal-body > * { flex: 1; min-block-size: 0; }

.cpcs-drawer-overlay { position: fixed; inset: 0; background: var(--surface-translucent); }
.cpcs-drawer {
  position: fixed;
  background: var(--surface-1);
  display: flex;
  flex-direction: column;
  min-block-size: 0;
  z-index: 40;
}
.cpcs-drawer-left { inset-block: 0; inset-inline-start: 0; inline-size: min(80vw, calc(var(--space-unit) * 90)); border-inline-end: var(--hairline); }
.cpcs-drawer-right { inset-block: 0; inset-inline-end: 0; inline-size: min(88vw, calc(var(--space-unit) * 100)); border-inline-start: var(--hairline); overflow-y: auto; }
.cpcs-drawer-bottom {
  inset-inline: 0;
  inset-block-end: 0;
  max-block-size: 60vh;
  border-block-start: var(--hairline);
  border-start-start-radius: var(--radius-lg);
  border-start-end-radius: var(--radius-lg);
}
.cpcs-vh {
  position: absolute;
  inline-size: var(--hairline-w);
  block-size: var(--hairline-w);
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

/* Environment panel (D6) */
.cpcs-env { block-size: 100%; min-block-size: 0; display: flex; flex-direction: column; overflow-y: auto; padding: var(--space-3) var(--space-4) var(--space-4); }
.cpcs-env-section { border-block-end: var(--hairline); padding-block-end: var(--space-2); margin-block-end: var(--space-2); }
.cpcs-env-section:last-of-type { border-block-end: none; }
.cpcs-env-head {
  appearance: none;
  background: none;
  border: none;
  display: flex;
  align-items: center;
  gap: var(--space-1);
  inline-size: 100%;
  text-align: start;
  padding: var(--space-2) 0;
  font-family: var(--font-mono);
  font-size: var(--text--2);
  letter-spacing: 0.08em;
  text-transform: lowercase;
  color: var(--text-faint);
  cursor: pointer;
  transition: color var(--motion-fast) var(--ease);
}
.cpcs-env-head:hover { color: var(--text-dim); }
.cpcs-env-head:focus-visible { outline: var(--focus-ring); outline-offset: calc(var(--focus-ring-offset) * -1); }
.cpcs-env-chevron { transition: transform var(--motion-fast) var(--ease); }
.cpcs-env-head[data-state='open'] .cpcs-env-chevron { transform: rotate(90deg); }
.cpcs-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding-block: var(--space-1);
  font-size: var(--text--1);
  color: var(--text-dim);
  min-inline-size: 0;
}
.cpcs-row-btn {
  appearance: none;
  background: none;
  border: none;
  inline-size: 100%;
  text-align: start;
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: background var(--motion-fast) var(--ease);
}
.cpcs-row-btn:hover { background: var(--accent-soft); }
.cpcs-row-btn:focus-visible { outline: var(--focus-ring); outline-offset: calc(var(--focus-ring-offset) * -1); }
.cpcs-row-dim { color: var(--text-faint); }
.cpcs-dot { inline-size: var(--space-2); block-size: var(--space-2); border-radius: 50%; flex: none; }
.cpcs-mono { font-family: var(--font-mono); font-size: var(--text--2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cpcs-commit-input {
  inline-size: 100%;
  background: transparent;
  border: none;
  border-block-end: var(--hairline);
  font-family: var(--font-mono);
  font-size: var(--text--2);
  color: var(--text);
  padding-block: var(--space-1);
}
.cpcs-commit-input:focus-visible { outline: none; border-block-end-color: var(--accent); }
.cpcs-quiet-btn {
  appearance: none;
  background: none;
  border: none;
  font-family: var(--font-mono);
  font-size: var(--text--2);
  color: var(--text-faint);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: color var(--motion-fast) var(--ease), background var(--motion-fast) var(--ease);
}
.cpcs-quiet-btn:hover:not(:disabled) { color: var(--text); background: var(--accent-soft); }
.cpcs-quiet-btn:disabled { cursor: default; opacity: 0.5; }
.cpcs-quiet-btn:focus-visible { outline: var(--focus-ring); outline-offset: var(--focus-ring-offset); }
.cpcs-quiet-btn[aria-pressed='true'] { color: var(--accent); }
.cpcs-env-foot { margin-block-start: auto; padding-block-start: var(--space-3); }
.cpcs-plumbing {
  font-family: var(--font-mono);
  font-size: var(--text--2);
  color: var(--text-faint);
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding-block-start: var(--space-2);
  overflow-wrap: anywhere;
}

/* Omnibox (D9) */
.cpcs-omnibox-overlay { position: fixed; inset: 0; background: var(--surface-translucent); z-index: 50; }
.cpcs-omnibox-content {
  position: fixed;
  inset-block-start: 18vh;
  inset-inline-start: 50%;
  transform: translateX(-50%);
  inline-size: min(calc(var(--space-unit) * 160), 92vw);
  z-index: 51;
}
.cpcs-omnibox {
  background: var(--surface-2);
  border: var(--hairline);
  border-radius: var(--radius-lg);
  overflow: hidden;
  font-family: var(--font-body);
}
.cpcs-omnibox [cmdk-input] {
  inline-size: 100%;
  padding: var(--space-4);
  font-family: var(--font-body);
  font-size: var(--text-0);
  background: transparent;
  border: none;
  border-block-end: var(--hairline);
  color: var(--text);
}
.cpcs-omnibox [cmdk-input]:focus-visible { outline: none; border-block-end-color: var(--accent); }
.cpcs-omnibox [cmdk-list] { max-block-size: 44vh; overflow: auto; padding: var(--space-2); }
.cpcs-omnibox [cmdk-group-heading] {
  font-family: var(--font-mono);
  font-size: var(--text--2);
  letter-spacing: 0.08em;
  text-transform: lowercase;
  color: var(--text-faint);
  padding: var(--space-2) var(--space-2) var(--space-1);
}
.cpcs-omnibox [cmdk-item] {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-sm);
  font-size: var(--text--1);
  color: var(--text-dim);
  cursor: pointer;
}
.cpcs-omnibox [cmdk-item][data-selected='true'] { background: var(--accent-soft); color: var(--text); }
.cpcs-omnibox [cmdk-empty] { padding: var(--space-4); font-size: var(--text--1); color: var(--text-faint); }
`;
