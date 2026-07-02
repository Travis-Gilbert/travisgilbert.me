'use client';

/**
 * CodeOmnibox (HANDOFF-CODE-SURFACE-UI D9): cmdk command dialog for the code
 * surface. Opens on mod+k (react-hotkeys-hook) or store.omniboxOpen.
 *
 * Groups: Files (changed files -> open as center tab), Sessions (store.runs
 * -> activate conversation + scroll intent event), Commands (panel/terminal/
 * developer toggles, open browser tab, run task). "Run task" prefills the
 * conversation composer by dispatching the CustomEvent 'cp-code-omnibox-task'
 * that the conversation column listens for; the scroll intent uses
 * 'cp-code-scroll-to-run'.
 *
 * Keyboard contract: cmdk defaults (arrows move selection, Enter selects,
 * Escape closes). The dialog is a Radix Dialog underneath, which restores
 * focus to the previously focused element on close.
 */

import { useCallback, useState } from 'react';
import { Command } from 'cmdk';
import { useHotkeys } from 'react-hotkeys-hook';
import { useCodeSurfaceStore } from '@/lib/code-surface-store';

export default function CodeOmnibox() {
  const open = useCodeSurfaceStore((s) => s.omniboxOpen);
  const status = useCodeSurfaceStore((s) => s.status);
  const runs = useCodeSurfaceStore((s) => s.runs);
  const rightPanelOpen = useCodeSurfaceStore((s) => s.rightPanelOpen);
  const terminalOpen = useCodeSurfaceStore((s) => s.terminalOpen);
  const devToggle = useCodeSurfaceStore((s) => s.devToggle);
  const setOmniboxOpen = useCodeSurfaceStore((s) => s.setOmniboxOpen);
  const setRightPanelOpen = useCodeSurfaceStore((s) => s.setRightPanelOpen);
  const setTerminalOpen = useCodeSurfaceStore((s) => s.setTerminalOpen);
  const setDevToggle = useCodeSurfaceStore((s) => s.setDevToggle);
  const openTab = useCodeSurfaceStore((s) => s.openTab);
  const activateTab = useCodeSurfaceStore((s) => s.activateTab);

  const [search, setSearch] = useState('');

  const handleOpenChange = useCallback(
    (next: boolean) => {
      setOmniboxOpen(next);
      if (!next) setSearch('');
    },
    [setOmniboxOpen],
  );

  useHotkeys(
    'mod+k',
    () => {
      const state = useCodeSurfaceStore.getState();
      state.setOmniboxOpen(!state.omniboxOpen);
    },
    { enableOnFormTags: true, enableOnContentEditable: true, preventDefault: true },
    [],
  );

  const close = useCallback(() => handleOpenChange(false), [handleOpenChange]);

  const changedFiles = status?.git.changedFiles ?? [];
  const task = search.trim();

  return (
    <Command.Dialog
      open={open}
      onOpenChange={handleOpenChange}
      label="Code surface omnibox"
      overlayClassName="cpcs-omnibox-overlay"
      contentClassName="cpcs-omnibox-content"
      className="cpcs-omnibox"
    >
      <Command.Input
        value={search}
        onValueChange={setSearch}
        placeholder="Search files, sessions, commands"
      />
      <Command.List>
        <Command.Empty>No matches.</Command.Empty>

        {changedFiles.length > 0 ? (
          <Command.Group heading="Files">
            {changedFiles.map((file) => (
              <Command.Item
                key={file.path}
                value={`file ${file.path}`}
                onSelect={() => {
                  openTab({ id: file.path, kind: 'file', label: basename(file.path) });
                  close();
                }}
              >
                <span className="cpcs-mono">{file.path}</span>
              </Command.Item>
            ))}
          </Command.Group>
        ) : null}

        {runs.length > 0 ? (
          <Command.Group heading="Sessions">
            {runs.map((run) => (
              <Command.Item
                key={run.id}
                value={`session ${run.task} ${run.id}`}
                onSelect={() => {
                  activateTab('conversation');
                  window.dispatchEvent(
                    new CustomEvent('cp-code-scroll-to-run', { detail: { runId: run.id } }),
                  );
                  close();
                }}
              >
                <span>{run.task}</span>
              </Command.Item>
            ))}
          </Command.Group>
        ) : null}

        <Command.Group heading="Commands">
          <Command.Item
            value="toggle right panel environment"
            onSelect={() => {
              setRightPanelOpen(!rightPanelOpen);
              close();
            }}
          >
            Toggle right panel
          </Command.Item>
          <Command.Item
            value="toggle terminal drawer"
            onSelect={() => {
              setTerminalOpen(!terminalOpen);
              close();
            }}
          >
            Toggle terminal
          </Command.Item>
          <Command.Item
            value="toggle developer plumbing"
            onSelect={() => {
              setDevToggle(!devToggle);
              close();
            }}
          >
            Toggle developer toggle
          </Command.Item>
          <Command.Item
            value="open browser tab"
            onSelect={() => {
              openTab({ id: 'browser', kind: 'browser', label: 'Browser' });
              close();
            }}
          >
            Open browser tab
          </Command.Item>
          <Command.Item
            /* value tracks the query so the item stays matchable while typing a task */
            value={task ? `run task ${task}` : 'run task'}
            onSelect={() => {
              activateTab('conversation');
              window.dispatchEvent(
                new CustomEvent('cp-code-omnibox-task', { detail: { task } }),
              );
              close();
            }}
          >
            {task ? `Run task: ${task}` : 'Run task'}
          </Command.Item>
        </Command.Group>
      </Command.List>
    </Command.Dialog>
  );
}

function basename(path: string): string {
  const segments = path.split('/');
  return segments[segments.length - 1] || path;
}
