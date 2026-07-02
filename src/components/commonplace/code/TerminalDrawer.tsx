'use client';

/**
 * TerminalDrawer (HANDOFF-CODE-SURFACE-UI D8): xterm over the desktop
 * runtime's PTY bridge (POST /v1/pty then a WebSocket carrying binary io and
 * JSON resize frames). The shell opens and closes the drawer via
 * store.terminalOpen; this component owns the terminal lifecycle.
 *
 * Absence rule: when the runtime is not available the body is ONE quiet mono
 * line, never a boxed empty state or a fake prompt.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { SearchAddon } from '@xterm/addon-search';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { WebglAddon } from '@xterm/addon-webgl';
import '@xterm/xterm/css/xterm.css';
import { useCodeSurfaceStore } from '@/lib/code-surface-store';
import { createPty, killPty, ptyResizeFrame } from '@/lib/commonplace-runtime';
import { tokenColorHex, tokenFontSizePx, tokenValue } from './token-resolve';

const quietLine: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--text--1)',
  color: 'var(--text-faint)',
  padding: 'var(--space-3)',
};

const quietButton: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--text--1)',
  color: 'var(--text-dim)',
  background: 'none',
  border: 'none',
  padding: 0,
  cursor: 'pointer',
  textDecoration: 'underline',
};

export default function TerminalDrawer() {
  const terminalOpen = useCodeSurfaceStore((s) => s.terminalOpen);
  const runtimeAvailable = useCodeSurfaceStore((s) => s.runtimeAvailable);

  const hostRef = useRef<HTMLDivElement | null>(null);
  // Bumping the session number tears the effect down and starts a fresh PTY.
  const [session, setSession] = useState(0);
  const [ended, setEnded] = useState(false);

  const restart = useCallback(() => {
    setEnded(false);
    setSession((n) => n + 1);
  }, []);

  useEffect(() => {
    if (!terminalOpen || runtimeAvailable !== true) return;
    const host = hostRef.current;
    if (!host) return;

    let disposed = false;
    let socket: WebSocket | null = null;
    let ptyId: string | null = null;

    // Theme and metrics resolve from the mounted container's computed tokens;
    // xterm wants literal colors and a numeric fontSize, so nothing is
    // hardcoded in source (check-raw-values stays clean).
    const theme: Record<string, string> = {};
    const putColor = (key: string, token: string) => {
      const hex = tokenColorHex(token, host);
      if (hex) theme[key] = hex;
    };
    putColor('background', '--surface-0');
    putColor('foreground', '--text');
    putColor('cursor', '--accent');
    putColor('cursorAccent', '--surface-0');
    putColor('selectionBackground', '--accent-soft');

    const term = new Terminal({
      fontFamily: tokenValue('--font-mono', host) || undefined,
      fontSize: tokenFontSizePx('--text--1', host),
      theme,
      convertEol: false,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.loadAddon(new SearchAddon());
    term.loadAddon(new WebLinksAddon());
    term.open(host);
    fit.fit();

    // WebGL renderer with the documented context-loss fallback: try it, and
    // if the browser drops the context, dispose the addon and let xterm
    // continue on the DOM renderer.
    try {
      const webgl = new WebglAddon();
      webgl.onContextLoss(() => {
        webgl.dispose();
      });
      term.loadAddon(webgl);
    } catch {
      // WebGL unavailable: the DOM renderer is already active.
    }

    const sendResize = () => {
      fit.fit();
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(ptyResizeFrame(term.cols, term.rows));
      }
    };
    const observer = new ResizeObserver(sendResize);
    observer.observe(host);

    (async () => {
      const pty = await createPty({ workspaceRoot: null, cols: term.cols, rows: term.rows });
      if (!pty) {
        if (!disposed) {
          term.writeln('terminal needs the desktop runtime');
          setEnded(true);
        }
        return;
      }
      if (disposed) {
        pty.socket.close();
        void killPty(pty.ptyId);
        return;
      }
      ptyId = pty.ptyId;
      socket = pty.socket;
      socket.onmessage = (event) => {
        if (typeof event.data === 'string') term.write(event.data);
        else term.write(new Uint8Array(event.data as ArrayBuffer));
      };
      socket.onclose = () => {
        if (disposed) return;
        term.write('\r\nsession ended\r\n');
        setEnded(true);
      };
      term.onData((data) => {
        if (socket?.readyState === WebSocket.OPEN) socket.send(data);
      });
    })();

    return () => {
      disposed = true;
      observer.disconnect();
      socket?.close();
      if (ptyId) void killPty(ptyId);
      term.dispose();
    };
  }, [terminalOpen, runtimeAvailable, session]);

  if (!terminalOpen) return null;

  // Absent runtime collapses to one quiet line: no boxes, no fake prompt.
  if (runtimeAvailable !== true) {
    return <div style={quietLine}>terminal needs the desktop runtime</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div ref={hostRef} style={{ flex: 1, minHeight: 0 }} />
      {ended && (
        <div style={quietLine}>
          <button type="button" style={quietButton} onClick={restart}>
            restart session
          </button>
        </div>
      )}
    </div>
  );
}
