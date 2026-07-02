import type {
  TheoremAgentClaim,
  TheoremAgentNormalizedInput,
  TheoremAgentRunResult,
} from '@/lib/theorem-agent';

interface ProviderProfile {
  readonly provider: string;
  readonly aliases: readonly string[];
  readonly keyEnv: string;
  readonly alternateKeyEnvs?: readonly string[];
  readonly endpointEnv: string;
  readonly baseUrlEnv: string;
  readonly modelEnv: string;
  readonly defaultEndpoint: string;
  readonly defaultModel: string;
  readonly baseUsesV1Path: boolean;
}

interface DirectProviderHead {
  readonly headId: string;
  readonly profile: ProviderProfile;
  readonly model: string;
  readonly endpoint: string;
  readonly keyEnv: string;
  readonly apiKey?: string;
}

interface DirectProviderSuccess {
  readonly configured: true;
  readonly result: TheoremAgentRunResult;
  readonly attempts: readonly string[];
}

interface DirectProviderFailure {
  readonly configured: boolean;
  readonly result?: undefined;
  readonly attempts: readonly string[];
}

export type DirectProviderRun = DirectProviderSuccess | DirectProviderFailure;

const PROVIDER_PROFILES: readonly ProviderProfile[] = [
  {
    provider: 'deepseek',
    aliases: ['deepseek'],
    keyEnv: 'DEEPSEEK_API_KEY',
    endpointEnv: 'DEEPSEEK_CHAT_URL',
    baseUrlEnv: 'DEEPSEEK_BASE_URL',
    modelEnv: 'DEEPSEEK_MODEL',
    defaultEndpoint: 'https://api.deepseek.com/chat/completions',
    defaultModel: 'deepseek-v4-pro',
    baseUsesV1Path: false,
  },
  {
    provider: 'mistral',
    aliases: ['mistral'],
    keyEnv: 'MISTRAL_API_KEY',
    endpointEnv: 'MISTRAL_CHAT_URL',
    baseUrlEnv: 'MISTRAL_BASE_URL',
    modelEnv: 'MISTRAL_MODEL',
    defaultEndpoint: 'https://api.mistral.ai/v1/chat/completions',
    defaultModel: 'mistral-large-latest',
    baseUsesV1Path: true,
  },
  {
    provider: 'minimax',
    aliases: ['minimax'],
    keyEnv: 'MINIMAX_API_KEY',
    endpointEnv: 'MINIMAX_CHAT_URL',
    baseUrlEnv: 'MINIMAX_BASE_URL',
    modelEnv: 'MINIMAX_MODEL',
    defaultEndpoint: 'https://api.minimaxi.com/v1/chat/completions',
    defaultModel: 'MiniMax-M3',
    baseUsesV1Path: true,
  },
  {
    provider: 'qwen',
    aliases: ['qwen', 'dashscope', 'aliyun'],
    keyEnv: 'QWEN_API_KEY',
    alternateKeyEnvs: ['DASHSCOPE_API_KEY'],
    endpointEnv: 'QWEN_CHAT_URL',
    baseUrlEnv: 'QWEN_BASE_URL',
    modelEnv: 'QWEN_MODEL',
    defaultEndpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    defaultModel: 'qwen-plus',
    baseUsesV1Path: true,
  },
  {
    provider: 'openai',
    aliases: ['openai', 'openapi'],
    keyEnv: 'OPENAI_API_KEY',
    endpointEnv: 'OPENAI_CHAT_URL',
    baseUrlEnv: 'OPENAI_BASE_URL',
    modelEnv: 'OPENAI_MODEL',
    defaultEndpoint: 'https://api.openai.com/v1/chat/completions',
    defaultModel: 'gpt-4.1-mini',
    baseUsesV1Path: true,
  },
];

export async function runDirectProviderHead(
  input: TheoremAgentNormalizedInput,
): Promise<DirectProviderRun> {
  const heads = configuredProviderHeads();
  if (!heads.length) {
    return {
      configured: false,
      attempts: [
        'direct provider: no runnable API head found. Set DEEPSEEK_API_KEY, MISTRAL_API_KEY, MINIMAX_API_KEY, QWEN_API_KEY, or DASHSCOPE_API_KEY; optionally set THEOREM_AGENT_HEADS=deepseek,mistral,minimax,qwen.',
      ],
    };
  }

  const attempts: string[] = [];
  for (const head of heads) {
    if (!head.apiKey) {
      attempts.push(`${head.headId}: missing ${head.keyEnv}`);
      continue;
    }

    try {
      return {
        configured: true,
        result: await callOpenAiCompatibleHead(head, input),
        attempts,
      };
    } catch (err) {
      attempts.push(`${head.headId}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return { configured: true, attempts };
}

export function hasDirectProviderHeadConfig(): boolean {
  return configuredProviderHeads().length > 0;
}

export function directProviderEnvNames(): readonly string[] {
  return [
    'THEOREM_AGENT_HEADS',
    ...PROVIDER_PROFILES.flatMap((profile) => [
      profile.keyEnv,
      ...(profile.alternateKeyEnvs ?? []),
      profile.modelEnv,
      profile.endpointEnv,
      profile.baseUrlEnv,
    ]),
  ];
}

function configuredProviderHeads(): DirectProviderHead[] {
  const explicitHeads = splitHeadList(process.env.THEOREM_AGENT_HEADS);
  if (explicitHeads.length) {
    return explicitHeads.map(resolveHead).filter(nonNullable);
  }

  return PROVIDER_PROFILES.filter((profile) => providerCredentialEnv(profile)).map((profile) =>
    buildHead(profile.provider, profile, providerCredentialEnv(profile) ?? profile.keyEnv),
  );
}

function resolveHead(headId: string): DirectProviderHead | null {
  const headSlug = envSlug(headId);
  const providerName =
    text(process.env[`THEOREM_AGENT_HEAD_${headSlug}_PROVIDER`]) ??
    text(process.env[`${headSlug}_PROVIDER`]) ??
    headId;
  const profile = providerProfile(providerName);
  if (!profile) return null;

  const credentialRef =
    text(process.env[`THEOREM_AGENT_HEAD_${headSlug}_CREDENTIAL_REF`]) ??
    text(process.env[`THEOREM_AGENT_HEAD_${headSlug}_CREDENTIAL`]);
  const keyEnv = credentialEnvName(credentialRef) ?? providerCredentialEnv(profile) ?? profile.keyEnv;
  return buildHead(headId, profile, keyEnv);
}

function buildHead(
  headId: string,
  profile: ProviderProfile,
  keyEnv: string,
): DirectProviderHead {
  const headSlug = envSlug(headId);
  const endpoint =
    text(process.env[`THEOREM_AGENT_HEAD_${headSlug}_CHAT_URL`]) ??
    text(process.env[`${headSlug}_CHAT_URL`]) ??
    text(process.env[profile.endpointEnv]) ??
    normalizeProviderBaseUrl(
      text(process.env[`THEOREM_AGENT_HEAD_${headSlug}_BASE_URL`]) ??
        text(process.env[`${headSlug}_BASE_URL`]) ??
        text(process.env[profile.baseUrlEnv]),
      profile,
    ) ??
    profile.defaultEndpoint;
  const model =
    text(process.env[`THEOREM_AGENT_HEAD_${headSlug}_MODEL`]) ??
    text(process.env[`${headSlug}_MODEL`]) ??
    text(process.env[profile.modelEnv]) ??
    profile.defaultModel;

  return {
    headId,
    profile,
    model,
    endpoint,
    keyEnv,
    apiKey: text(process.env[keyEnv]),
  };
}

async function callOpenAiCompatibleHead(
  head: DirectProviderHead,
  input: TheoremAgentNormalizedInput,
): Promise<TheoremAgentRunResult> {
  const timeout = timeoutController(input.requestTimeoutMs);
  let response: Response;
  let value: unknown;
  try {
    response = await fetch(head.endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${head.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: head.model,
        messages: messagesForInput(input),
        stream: false,
      }),
      cache: 'no-store',
      signal: timeout.signal,
    });
    value = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(providerErrorMessage(response.status, value));
    }
  } catch (err) {
    if (isAbortError(err)) {
      throw new Error(`${head.profile.provider} timed out after ${input.requestTimeoutMs}ms`);
    }
    throw err;
  } finally {
    timeout.clear();
  }

  const answer = chatCompletionText(value);
  if (!answer) {
    throw new Error(`${head.profile.provider} returned no message content`);
  }

  return {
    mode: input.mode,
    task: input.task,
    answer,
    answerKind: 'MODEL',
    bindingId: input.bindingId,
    runId: `direct:${head.headId}:${Date.now().toString(36)}`,
    heads: [head.headId],
    claims: input.claims,
    evidenceCount: input.claims.length,
    raw: {
      provider: head.profile.provider,
      model: head.model,
      response: value,
    },
  };
}

function messagesForInput(input: TheoremAgentNormalizedInput): Array<{
  role: 'system' | 'user';
  content: string;
}> {
  const system = [
    'Your name is Theorem. You are an AI agent running inside CommonPlace.',
    'Theorem is your agent name and product identity, not a mathematical theorem or an interactive proof system.',
    'If asked who you are, say you are Theorem, the CommonPlace agent for synthesis, retrieval, and grounded work.',
    'Answer the user directly and preserve useful provenance when evidence is supplied.',
  ];
  if (input.claims.length) {
    system.push(`Evidence:\n${claimsBlock(input.claims)}`);
  }
  return [
    { role: 'system', content: system.join('\n\n') },
    { role: 'user', content: input.task },
  ];
}

function claimsBlock(claims: readonly TheoremAgentClaim[]): string {
  return claims
    .map((claim, index) => `[${index + 1}] ${claim.text}\nProvenance: ${claim.provenance}`)
    .join('\n\n');
}

function providerErrorMessage(status: number, value: unknown): string {
  const record = asRecord(value);
  const error = asRecord(record?.error);
  const message = text(error?.message) ?? text(record?.message) ?? text(record?.error);
  return message ? `provider HTTP ${status}: ${message}` : `provider HTTP ${status}`;
}

function chatCompletionText(value: unknown): string | undefined {
  const root = asRecord(value);
  const choice = asRecord(asArray(root?.choices)[0]);
  const message = asRecord(choice?.message);
  const content = message?.content;
  if (typeof content === 'string' && content.trim()) return content.trim();
  if (Array.isArray(content)) {
    const textParts = content
      .map((part) => asRecord(part))
      .map((part) => text(part?.text) ?? text(part?.content))
      .filter(nonNullable);
    const joined = textParts.join('\n').trim();
    return joined || undefined;
  }
  return undefined;
}

function providerProfile(value: string): ProviderProfile | undefined {
  const normalized = value.trim().toLowerCase();
  return PROVIDER_PROFILES.find(
    (profile) =>
      profile.provider === normalized || profile.aliases.some((alias) => alias === normalized),
  );
}

function providerCredentialEnv(profile: ProviderProfile): string | undefined {
  return [profile.keyEnv, ...(profile.alternateKeyEnvs ?? [])].find((name) =>
    text(process.env[name]),
  );
}

function credentialEnvName(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed.toLowerCase().startsWith('env:')) return undefined;
  return envSlug(trimmed.slice(4));
}

function normalizeProviderBaseUrl(
  value: string | undefined,
  profile: ProviderProfile,
): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim().replace(/\/+$/, '');
  if (trimmed.endsWith('/chat/completions')) return trimmed;
  if (trimmed.endsWith('/v1')) return `${trimmed}/chat/completions`;
  return profile.baseUsesV1Path
    ? `${trimmed}/v1/chat/completions`
    : `${trimmed}/chat/completions`;
}

function splitHeadList(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(/[,\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function envSlug(value: string): string {
  return value.trim().replace(/[^a-zA-Z0-9]+/g, '_').toUpperCase();
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function nonNullable<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

function timeoutController(timeoutMs: number): {
  signal: AbortSignal;
  clear: () => void;
} {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  return {
    signal: controller.signal,
    clear: () => clearTimeout(timeout),
  };
}

function isAbortError(value: unknown): boolean {
  return value instanceof Error && value.name === 'AbortError';
}
