'use client';

import { useMemo, useState } from 'react';
import { Check, Copy, CursorPointer, OpenNewWindow } from 'iconoir-react';
import {
  agentInstallSnippet,
  cursorInstallUrl,
  HARNESS_KEYS_URL,
  type AgentClient,
} from '@/lib/install-surfaces';

const TOKEN_MARKER = '<your-key>';

const CLIENTS: Array<{ kind: AgentClient; label: string; note: string }> = [
  { kind: 'claude-code', label: 'Claude Code', note: 'One terminal command registers the remote MCP endpoint.' },
  { kind: 'claude-desktop', label: 'Claude Desktop', note: 'Paste the remote MCP JSON entry into the connector config.' },
  { kind: 'cursor', label: 'Cursor', note: 'Paste JSON or use the generated install link after adding a real key.' },
  { kind: 'codex', label: 'Codex', note: 'Add the MCP server to the Codex config and export the key.' },
  { kind: 'raw', label: 'Raw HTTP', note: 'Use the streamable MCP endpoint directly.' },
];

export default function McpInstallPanel() {
  const [client, setClient] = useState<AgentClient>('claude-code');
  const [token, setToken] = useState('');
  const [copied, setCopied] = useState(false);
  const active = CLIENTS.find((entry) => entry.kind === client) ?? CLIENTS[0];
  const tokenValue = token.trim() || TOKEN_MARKER;
  const snippet = useMemo(() => agentInstallSnippet(client, tokenValue), [client, tokenValue]);
  const cursorUrl = useMemo(() => (token.trim() ? cursorInstallUrl(token.trim()) : null), [token]);

  async function copySnippet() {
    await navigator.clipboard.writeText(snippet);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="MCP client">
        {CLIENTS.map((entry) => {
          const selected = entry.kind === client;
          return (
            <button
              key={entry.kind}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setClient(entry.kind)}
              className={`min-h-[36px] rounded-md border px-3 py-2 font-mono text-[11px] uppercase tracking-[0.08em] transition-colors ${
                selected
                  ? 'border-terracotta bg-terracotta text-cream'
                  : 'border-border-light bg-transparent text-ink-secondary hover:border-terracotta hover:text-terracotta'
              }`}
            >
              {entry.label}
            </button>
          );
        })}
      </div>

      <p className="m-0 text-sm text-ink-secondary">{active.note}</p>

      <label className="block space-y-2">
        <span className="block font-mono text-[11px] uppercase tracking-[0.08em] text-ink-muted">
          Bearer key
        </span>
        <input
          value={token}
          onChange={(event) => setToken(event.target.value)}
          type="password"
          inputMode="text"
          autoComplete="off"
          className="min-h-[42px] w-full rounded-md border border-border-light bg-[rgba(255,250,242,0.75)] px-3 py-2 font-mono text-sm text-ink outline-none transition-colors focus:border-terracotta"
          aria-describedby="mcp-key-help"
        />
        <span id="mcp-key-help" className="block text-xs text-ink-muted">
          The value stays in this browser tab and is used only to complete the copy block and Cursor link.
        </span>
      </label>

      <div className="overflow-hidden rounded-lg border border-border-light bg-[rgba(255,250,242,0.7)]">
        <div className="flex items-center justify-between gap-3 border-b border-border-light px-3 py-2">
          <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-muted">
            Replace {TOKEN_MARKER} with a bearer from the Harness console
          </span>
          <button
            type="button"
            onClick={copySnippet}
            className="inline-flex min-h-[32px] items-center gap-1 rounded border border-border-light bg-parchment px-2 py-1 font-mono text-[11px] text-ink-secondary transition-colors hover:text-terracotta"
          >
            {copied ? <Check width={14} height={14} strokeWidth={2} /> : <Copy width={14} height={14} strokeWidth={2} />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        <pre className="m-0 overflow-x-auto p-3 font-mono text-[12px] leading-relaxed text-ink">
          <code>{snippet}</code>
        </pre>
      </div>

      <div className="flex flex-wrap gap-3">
        <a
          href={HARNESS_KEYS_URL}
          className="inline-flex min-h-[38px] items-center gap-2 rounded-md bg-ink px-3 py-2 font-mono text-[12px] uppercase tracking-[0.08em] text-cream no-underline transition-transform hover:-translate-y-0.5"
        >
          <OpenNewWindow width={15} height={15} strokeWidth={2} />
          Create key
        </a>
        {cursorUrl ? (
          <a
            href={cursorUrl}
            className="inline-flex min-h-[38px] items-center gap-2 rounded-md border border-border-light px-3 py-2 font-mono text-[12px] uppercase tracking-[0.08em] text-ink-secondary no-underline transition-colors hover:border-terracotta hover:text-terracotta"
          >
            <CursorPointer width={15} height={15} strokeWidth={2} />
            Add to Cursor
          </a>
        ) : (
          <span className="text-sm text-ink-muted">Paste a bearer key to generate the Cursor install link.</span>
        )}
      </div>

      <ol className="space-y-2 pl-5 text-sm text-ink-secondary">
        <li>Ask your agent to call <code>remember</code> with: <code>My install proof is working across sessions.</code></li>
        <li>Start a fresh agent session and ask it to <code>recall</code>: <code>install proof working across sessions.</code></li>
      </ol>
    </div>
  );
}
