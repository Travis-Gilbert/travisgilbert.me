'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import CodeFileTree from './CodeFileTree';
import CodeTabs from './CodeTabs';
import CodeEditor from './CodeEditor';
import CodeIntelPanel from './CodeIntelPanel';
import PluginRibbon from './PluginRibbon';
import AgentDot from './AgentDot';
import CodeTerminal from './CodeTerminal';
import { useCodeSession } from './useCodeSession';

const FILE_DEFAULT = 210;
const FILE_MIN = 140;
const FILE_MAX = 320;
const INTEL_DEFAULT = 380;
const INTEL_MIN = 280;
const INTEL_MAX = 520;

export default function CodeWorkshop() {
  const session = useCodeSession();
  const [filesOpen, setFilesOpen] = useState(true);
  const [intelOpen, setIntelOpen] = useState(true);
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [fileWidth, setFileWidth] = useState(FILE_DEFAULT);
  const [intelWidth, setIntelWidth] = useState(INTEL_DEFAULT);

  const dragging = useRef<'file' | 'intel' | null>(null);
  const dragStartX = useRef(0);
  const dragStartW = useRef(0);

  const toggleFiles = useCallback(() => setFilesOpen((p) => !p), []);
  const toggleIntel = useCallback(() => setIntelOpen((p) => !p), []);
  const toggleTerminal = useCallback(() => setTerminalOpen((p) => !p), []);
  const closeTerminal = useCallback(() => setTerminalOpen(false), []);

  const handleResizeDown = useCallback(
    (side: 'file' | 'intel', e: React.MouseEvent) => {
      e.preventDefault();
      dragging.current = side;
      dragStartX.current = e.clientX;
      dragStartW.current = side === 'file' ? fileWidth : intelWidth;
    },
    [fileWidth, intelWidth],
  );

  useEffect(() => {
    function handleMove(e: MouseEvent) {
      if (!dragging.current) return;
      const delta = e.clientX - dragStartX.current;
      if (dragging.current === 'file') {
        setFileWidth(Math.max(FILE_MIN, Math.min(FILE_MAX, dragStartW.current + delta)));
      } else {
        setIntelWidth(Math.max(INTEL_MIN, Math.min(INTEL_MAX, dragStartW.current - delta)));
      }
    }
    function handleUp() { dragging.current = null; }
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
    return () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
    };
  }, []);

  return (
    <div className="cw-root" data-interactive>
      {/* Top bar */}
      <div className="cw-topbar">
        <div className="cw-topbar-left">
          <button
            type="button"
            className="cw-topbar-toggle"
            onClick={toggleFiles}
            aria-label={filesOpen ? 'Collapse file tree' : 'Expand file tree'}
            title={filesOpen ? 'Collapse files' : 'Show files'}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
          <span className="cw-topbar-brand">THESEUS</span>
          <span className="cw-topbar-sep">/</span>
          <span className="cw-topbar-repo">index-api</span>
          <PluginRibbon plugins={session.plugins} onToggle={session.togglePlugin} />
        </div>
        <div className="cw-topbar-right">
          {session.activeAgents.length > 0 && (
            <div className="cw-topbar-agents">
              {session.activeAgents.map((ak) => (
                <AgentDot key={ak} agent={ak} active showLabel={false} size="sm" />
              ))}
            </div>
          )}
          <div className="cw-topbar-model">
            <span className="cw-topbar-model-dot" />
            <span className="cw-topbar-model-label">GL-Fusion 31B</span>
          </div>
          <button
            type="button"
            className={`cw-topbar-toggle${terminalOpen ? ' is-active' : ''}`}
            onClick={toggleTerminal}
            aria-label={terminalOpen ? 'Close terminal' : 'Open terminal'}
            title={terminalOpen ? 'Close terminal' : 'Terminal'}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M4 5.5L7 8L4 10.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M8.5 10.5H12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              <rect x="1" y="1" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.2" />
            </svg>
          </button>
          <button
            type="button"
            className="cw-topbar-toggle"
            onClick={toggleIntel}
            aria-label={intelOpen ? 'Collapse Theseus panel' : 'Expand Theseus panel'}
            title={intelOpen ? 'Collapse panel' : 'Show panel'}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <rect x="1.5" y="1.5" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="1.2" />
              <path d="M10 1.5v13" stroke="currentColor" strokeWidth="1.2" />
            </svg>
          </button>
        </div>
      </div>

      {/* Main layout */}
      <div className="cw-main">
        <div
          className={`cw-file-tree-wrap${filesOpen ? '' : ' is-collapsed'}`}
          style={filesOpen ? { width: fileWidth } : undefined}
        >
          <CodeFileTree
            files={session.files}
            activeFile={session.activeFile}
            onSelect={session.selectFile}
          />
        </div>
        {filesOpen && (
          <div className="cw-resize-handle" onMouseDown={(e) => handleResizeDown('file', e)} />
        )}

        <div className="cw-center">
          <CodeTabs
            active={session.activeFile}
            files={session.openFiles}
            onSelect={session.selectFile}
          />
          <CodeEditor
            code={session.code}
            onCodeChange={session.setCode}
            language="python"
          />
        </div>

        {intelOpen && (
          <div className="cw-resize-handle" onMouseDown={(e) => handleResizeDown('intel', e)} />
        )}
        <div
          className={`cw-intel-wrap${intelOpen ? '' : ' is-collapsed'}`}
          style={intelOpen ? { width: intelWidth } : undefined}
        >
          <CodeIntelPanel
            suggestions={session.suggestions}
            messages={session.messages}
            activeAgents={session.activeAgents}
            isEditing={session.isEditing}
            editProgress={session.editProgress}
            totalEdits={session.streamingEdits.length}
            onSend={session.sendMessage}
            onAction={session.handleSuggestionAction}
          />
        </div>
      </div>

      {/* Terminal: full-width bottom drawer with TerminalCanvas background */}
      <CodeTerminal
        open={terminalOpen}
        onClose={closeTerminal}
        messages={session.messages}
        activeAgents={session.activeAgents}
        onSend={session.sendMessage}
      />
    </div>
  );
}
