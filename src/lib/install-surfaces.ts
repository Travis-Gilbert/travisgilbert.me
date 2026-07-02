import { THEOREM_HARNESS_MCP_URL } from './theorem-hosted';

export const HARNESS_MCP_NAME = 'theorems-harness';
export const HARNESS_MCP_URL =
  process.env.NEXT_PUBLIC_THEOREM_HARNESS_MCP_URL ??
  THEOREM_HARNESS_MCP_URL;
export const HARNESS_KEYS_URL =
  process.env.NEXT_PUBLIC_THEOREM_HARNESS_KEYS_URL ??
  'https://harness.theoremsweb.com/keys';
export const THEOREM_RELEASES_URL =
  'https://github.com/Travis-Gilbert/Theorem/releases/latest';
export const THEOREM_RELEASES_API_URL =
  'https://api.github.com/repos/Travis-Gilbert/Theorem/releases/latest';
export const RAILWAY_TEMPLATE_SOURCE_URL =
  'https://github.com/Travis-Gilbert/Theorem/tree/main/infra/railway/theorem-self-host';
export const RAILWAY_TEMPLATE_PUBLISHED =
  Boolean(process.env.NEXT_PUBLIC_THEOREM_RAILWAY_TEMPLATE_URL);
export const RAILWAY_TEMPLATE_URL =
  process.env.NEXT_PUBLIC_THEOREM_RAILWAY_TEMPLATE_URL ??
  RAILWAY_TEMPLATE_SOURCE_URL;

export type AgentClient = 'claude-code' | 'claude-desktop' | 'cursor' | 'codex' | 'raw';

interface RemoteMcpConfig {
  readonly type?: 'http';
  readonly url: string;
  readonly headers: {
    readonly Authorization: string;
  };
}

function remoteMcpConfig(token: string, includeType = false): RemoteMcpConfig {
  return {
    ...(includeType ? { type: 'http' as const } : {}),
    url: HARNESS_MCP_URL,
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };
}

function mcpServersJson(token: string, includeType = false): string {
  return JSON.stringify(
    {
      mcpServers: {
        [HARNESS_MCP_NAME]: remoteMcpConfig(token, includeType),
      },
    },
    null,
    2,
  );
}

function base64Json(value: unknown): string {
  const json = JSON.stringify(value);
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(json, 'utf8').toString('base64');
  }
  const bytes = new TextEncoder().encode(json);
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

export function cursorInstallUrl(token: string): string {
  const encodedConfig = encodeURIComponent(base64Json(remoteMcpConfig(token)));
  return `https://cursor.com/en/install-mcp?name=${encodeURIComponent(HARNESS_MCP_NAME)}&config=${encodedConfig}`;
}

export function agentInstallSnippet(client: AgentClient, token: string): string {
  switch (client) {
    case 'claude-code':
      return `claude mcp add --transport http ${HARNESS_MCP_NAME} \\\n  ${HARNESS_MCP_URL} \\\n  --header "Authorization: Bearer ${token}"`;
    case 'claude-desktop':
      return mcpServersJson(token, true);
    case 'cursor':
      return `${mcpServersJson(token)}\n\nAdd to Cursor:\n${cursorInstallUrl(token)}`;
    case 'codex':
      return `# ~/.codex/config.toml\n[mcp_servers.theorems-harness]\nurl = "${HARNESS_MCP_URL}"\nbearer_token_env_var = "HARNESS_API_KEY"\n\n# then, in your shell:\nexport HARNESS_API_KEY=${token}`;
    case 'raw':
      return `POST ${HARNESS_MCP_URL}\nAuthorization: Bearer ${token}\nContent-Type: application/json\n\n{ "jsonrpc": "2.0", "id": 1, "method": "tools/list" }`;
  }
}
