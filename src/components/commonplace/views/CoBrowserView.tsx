'use client';

/**
 * CoBrowserView (SPEC-9 D5): the human + agent co-browser. Opens pages in the
 * shell's webview (tab_create / tab_set_active), extracts the visible text, and
 * captures the page into the workspace (agent_tab_ingest) as open_web_unverified.
 * The webview itself renders in the Rust shell stage; this panel is its control
 * surface and the capture path.
 */

import { useCallback, useState } from 'react';
import {
  agentTabIngest,
  browseWithMe,
  extractVisibleText,
  tabCreate,
  tabSetActive,
  type AgentIngestionReceipt,
  type PageContext,
} from '@/lib/desktop';
import { DesktopOnly, panel } from './desktopPanel';

function newTabId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `tab-${Date.now()}`;
}

export default function CoBrowserView() {
  const [url, setUrl] = useState('https://');
  const [tabId, setTabId] = useState<string | null>(null);
  const [page, setPage] = useState<PageContext | null>(null);
  const [receipt, setReceipt] = useState<AgentIngestionReceipt | null>(null);
  const [agentTask, setAgentTask] = useState('');
  const [agentResult, setAgentResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const open = useCallback(async () => {
    const target = url.trim();
    if (!target) return;
    const id = newTabId();
    try {
      await tabCreate(id, target);
      await tabSetActive(id);
      setTabId(id);
      setPage(null);
      setReceipt(null);
      setError(null);
    } catch (err) {
      setError(String(err));
    }
  }, [url]);

  const extract = useCallback(async () => {
    if (!tabId) return;
    try {
      setPage(await extractVisibleText(tabId));
      setError(null);
    } catch (err) {
      setError(String(err));
    }
  }, [tabId]);

  const ingest = useCallback(async () => {
    if (!tabId || !page) return;
    try {
      setReceipt(
        await agentTabIngest({ tabId, url: page.url, title: page.title, text: page.text }),
      );
      setError(null);
    } catch (err) {
      setError(String(err));
    }
  }, [tabId, page]);

  // Agent-collaborative path (pair co-browsing). HTTP to the local node, so the
  // node must allow the desktop origin (CORS) — see the file header note.
  const browseAgent = useCallback(async () => {
    try {
      const result = await browseWithMe({
        url: page?.url ?? url,
        nextAction: agentTask.trim() || undefined,
      });
      setAgentResult(JSON.stringify(result, null, 2));
      setError(null);
    } catch (err) {
      setError(String(err));
    }
  }, [page, url, agentTask]);

  return (
    <DesktopOnly>
      <div style={panel.wrap}>
        <div style={panel.title}>Co-browser</div>
        <div style={panel.sub}>
          Browse the web alongside an agent. Pages render in the shell; capture them into the
          workspace.
        </div>
        <div style={panel.row}>
          <input
            style={panel.input}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void open();
            }}
            placeholder="https://example.com"
          />
          <button style={panel.button} onClick={() => void open()}>
            Open
          </button>
          <button style={panel.button} onClick={() => void extract()} disabled={!tabId}>
            Extract
          </button>
          <button style={panel.button} onClick={() => void ingest()} disabled={!page}>
            Ingest
          </button>
        </div>
        <div style={panel.row}>
          <input
            style={panel.input}
            value={agentTask}
            onChange={(e) => setAgentTask(e.target.value)}
            placeholder="ask the agent to act on this page (pair mode)..."
          />
          <button style={panel.button} onClick={() => void browseAgent()}>
            Browse with agent
          </button>
        </div>
        {error && <div style={{ ...panel.card, color: 'crimson' }}>{error}</div>}
        {agentResult && (
          <div style={panel.card}>
            <div style={{ fontWeight: 600 }}>Agent perception</div>
            <div style={{ marginTop: 8, whiteSpace: 'pre-wrap', maxHeight: 280, overflow: 'auto', fontSize: 12 }}>
              {agentResult}
            </div>
          </div>
        )}
        {receipt && (
          <div style={panel.card}>
            Ingested {receipt.url} → {receipt.status} ({receipt.message})
          </div>
        )}
        {page && (
          <div style={panel.card}>
            <div style={{ fontWeight: 600 }}>{page.title}</div>
            <div style={panel.dim}>{page.url}</div>
            <div style={{ marginTop: 8, whiteSpace: 'pre-wrap', maxHeight: 280, overflow: 'auto' }}>
              {page.text}
            </div>
          </div>
        )}
      </div>
    </DesktopOnly>
  );
}
