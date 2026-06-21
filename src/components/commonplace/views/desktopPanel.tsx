'use client';

/**
 * Shared chrome for the desktop-only CommonPlace panels (SPEC-9 D5):
 * co-browser, coordination, receiver. `DesktopOnly` renders an honest empty
 * state in the web build so these surfaces never call Tauri outside the shell.
 * Styling uses the CommonPlace design tokens (--cp-*, --font-*) so the panels
 * adopt the workspace's visual language rather than generic chrome.
 */

import type { CSSProperties, ReactNode } from 'react';
import { isTauri } from '@/lib/desktop';

export const panel: Record<string, CSSProperties> = {
  wrap: {
    height: '100%',
    overflow: 'auto',
    padding: 24,
    fontFamily: 'var(--font-metadata)',
    color: 'var(--cp-text, inherit)',
  },
  title: { fontSize: 15, fontWeight: 600, marginBottom: 4 },
  sub: { fontSize: 13, color: 'var(--cp-text-dim)', marginBottom: 20, maxWidth: 560 },
  card: {
    border: '1px solid var(--cp-border, rgba(0,0,0,.1))',
    borderRadius: 10,
    padding: 16,
    marginBottom: 12,
    background: 'var(--cp-surface, transparent)',
  },
  row: { display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' },
  input: {
    flex: 1,
    minWidth: 160,
    padding: '8px 10px',
    borderRadius: 8,
    border: '1px solid var(--cp-border, rgba(0,0,0,.15))',
    background: 'var(--cp-surface, transparent)',
    color: 'inherit',
    font: 'inherit',
  },
  button: {
    padding: '8px 14px',
    borderRadius: 8,
    border: '1px solid var(--cp-border, rgba(0,0,0,.2))',
    background: 'var(--cp-accent, #d9a65d)',
    color: 'var(--cp-on-accent, #21170c)',
    fontWeight: 600,
    cursor: 'pointer',
  },
  dim: { color: 'var(--cp-text-dim)', fontSize: 13 },
};

export function DesktopOnly({ children }: { children: ReactNode }) {
  if (!isTauri()) {
    return (
      <div
        style={{
          ...panel.wrap,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          ...panel.dim,
        }}
      >
        Available in the CommonPlace desktop app.
      </div>
    );
  }
  return <>{children}</>;
}
