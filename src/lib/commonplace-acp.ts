export const ACP_AGENTS = [
  {
    agentId: 'claude',
    command: '/claude',
    label: 'Claude Code',
    hint: 'Dock Claude through ACP',
  },
  {
    agentId: 'codex',
    command: '/codex',
    label: 'Codex',
    hint: 'Dock Codex through ACP',
  },
  {
    agentId: 'deepseek',
    command: '/deepseek',
    label: 'DeepSeek',
    hint: 'Dock DeepSeek through ACP',
  },
  {
    agentId: 'gemini',
    command: '/gemini',
    label: 'Gemini CLI',
    hint: 'Dock Gemini through ACP',
  },
  {
    agentId: 'opencode',
    command: '/opencode',
    label: 'OpenCode',
    hint: 'Dock OpenCode through ACP',
  },
] as const;

export type AcpAgentId = (typeof ACP_AGENTS)[number]['agentId'];

export type AcpConnectionStatus = 'idle' | 'connecting' | 'connected' | 'offline';

export interface AcpSessionStarted {
  type: 'session_started';
  session_id: string;
  agent_id: AcpAgentId | string;
}

export interface AcpSessionUpdate {
  type: 'session_update';
  session_id: string;
  agent_id: AcpAgentId | string;
  update: unknown;
}

export interface AcpFileWriteReview {
  type: 'file_write_review';
  session_id: string;
  agent_id: AcpAgentId | string;
  review: {
    request_id: string;
    path: string;
    content: string;
    previous_content?: string | null;
  };
}

export interface AcpCommandApproval {
  type: 'command_approval';
  session_id: string;
  agent_id: AcpAgentId | string;
  approval: {
    terminal_id: string;
    command: string;
    args?: string[];
    cwd?: string;
  };
}

export interface AcpCommandOutput {
  type: 'command_output';
  session_id: string;
  agent_id: AcpAgentId | string;
  output: {
    terminal_id: string;
    stdout?: string;
    stderr?: string;
    status?: {
      exitCode?: number;
      exit_code?: number;
      signal?: string | null;
    };
  };
}

export interface AcpErrorEvent {
  type: 'error';
  session_id?: string | null;
  agent_id?: AcpAgentId | string | null;
  message: string;
}

export type AcpFrontendEvent =
  | AcpSessionStarted
  | AcpSessionUpdate
  | AcpFileWriteReview
  | AcpCommandApproval
  | AcpCommandOutput
  | AcpErrorEvent;

export function acpAgentLabel(agentId: string): string {
  return ACP_AGENTS.find((agent) => agent.agentId === agentId)?.label ?? agentId;
}

export function buildAcpWebSocketUrl(): string {
  const configured = process.env.NEXT_PUBLIC_COMMONPLACE_ACP_WS_URL;
  if (configured) return configured;
  if (typeof window === 'undefined') return 'ws://127.0.0.1:8380/v1/commonplace/acp/ws';

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = process.env.NEXT_PUBLIC_THEOREM_LOOPBACK_HOST ?? '127.0.0.1:8380';
  return `${protocol}//${host}/v1/commonplace/acp/ws`;
}

export function acpWorkspaceCwd(): string {
  return process.env.NEXT_PUBLIC_COMMONPLACE_ACP_CWD ?? '';
}

export function textFromAcpUpdate(update: unknown): string {
  const fragments: string[] = [];

  const visit = (value: unknown) => {
    if (!value || typeof value !== 'object') return;
    const record = value as Record<string, unknown>;
    if (typeof record.text === 'string') fragments.push(record.text);
    if (typeof record.content === 'string') fragments.push(record.content);
    if (Array.isArray(record.content)) record.content.forEach(visit);
    if (Array.isArray(record.parts)) record.parts.forEach(visit);
    if (Array.isArray(record.messages)) record.messages.forEach(visit);
    if (record.update) visit(record.update);
  };

  visit(update);
  return fragments.join('');
}

export function diffFromAcpUpdate(update: unknown): string | null {
  if (!update || typeof update !== 'object') return null;
  const record = update as Record<string, unknown>;
  if (typeof record.diff === 'string') return record.diff;
  if (typeof record.patch === 'string') return record.patch;
  if (record.update && typeof record.update === 'object') return diffFromAcpUpdate(record.update);
  return null;
}
