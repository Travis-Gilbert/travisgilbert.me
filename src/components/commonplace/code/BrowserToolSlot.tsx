'use client';

/**
 * BrowserToolSlot (HANDOFF-CODE-SURFACE-UI D10): the browser surface as a
 * center tab. In the Tauri desktop shell the page renders in the shell's
 * webview stage; this slot is its control surface, reusing the existing
 * browser-tab commands (tab_create / tab_navigate / tab_set_active via
 * src/lib/desktop.ts, same mount pattern as CoBrowserView). Outside the
 * desktop shell the slot collapses to one quiet line.
 *
 * In agent mode the pre-action preview strip renders beneath the slot,
 * showing the pending action from a clearly labeled fixture.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { isTauri, tabCreate, tabNavigate, tabSetActive } from '@/lib/desktop';
import { useCodeSurfaceStore } from '@/lib/code-surface-store';
import PreActionPreview from './PreActionPreview';

const quietLine: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--text--1)',
  color: 'var(--text-faint)',
  padding: 'var(--space-3)',
};

const urlRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-2)',
  padding: 'var(--space-2) var(--space-3)',
  borderBottom: 'var(--hairline)',
};

const urlInput: React.CSSProperties = {
  flex: 1,
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--text--1)',
  color: 'var(--text)',
  background: 'var(--surface-1)',
  border: 'var(--hairline)',
  borderRadius: 'var(--radius-sm)',
  padding: 'var(--space-1) var(--space-2)',
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

function newTabId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `tab-${Date.now()}`;
}

export default function BrowserToolSlot() {
  const mode = useCodeSurfaceStore((s) => s.mode);

  // isTauri() reads window, so decide after mount to keep hydration stable.
  const [desktop, setDesktop] = useState<boolean | null>(null);
  const [url, setUrl] = useState('https://');
  const [error, setError] = useState<string | null>(null);
  const tabIdRef = useRef<string | null>(null);

  useEffect(() => {
    setDesktop(isTauri());
  }, []);

  // Release the shell stage when the slot unmounts (the webview lives in the
  // Rust shell, not in this DOM tree).
  useEffect(() => {
    if (desktop !== true) return;
    return () => {
      tabIdRef.current = null;
      void tabSetActive(null).catch(() => {});
    };
  }, [desktop]);

  const open = useCallback(async () => {
    const target = url.trim();
    if (!target) return;
    try {
      if (tabIdRef.current) {
        await tabNavigate(tabIdRef.current, target);
      } else {
        const id = newTabId();
        await tabCreate(id, target);
        await tabSetActive(id);
        tabIdRef.current = id;
      }
      setError(null);
    } catch (err) {
      setError(String(err));
    }
  }, [url]);

  if (desktop === null) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {desktop ? (
        <>
          <div style={urlRow}>
            <input
              style={urlInput}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void open();
              }}
              placeholder="https://example.com"
              aria-label="browser address"
            />
            <button type="button" style={quietButton} onClick={() => void open()}>
              open
            </button>
          </div>
          {error && <div style={quietLine}>{error}</div>}
          {/* The page itself renders in the desktop shell's webview stage. */}
          <div style={{ flex: 1, minHeight: 0 }}>
            {!tabIdRef.current && !error && (
              <div style={quietLine}>pages render in the desktop shell stage</div>
            )}
          </div>
        </>
      ) : (
        <div style={quietLine}>browser runs in the desktop shell</div>
      )}
      {mode === 'agent' && <PreActionPreview />}
    </div>
  );
}
