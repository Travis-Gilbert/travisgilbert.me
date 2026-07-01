const WEBHOOK_PATH = '/github/webhook';
const API_WEBHOOK_PATH = '/api/github/webhook';

const EXACT_WEBHOOK_ENVS = [
  'THEOREM_GITHUB_WEBHOOK_UPSTREAM_URL',
  'THEOREM_HARNESS_GITHUB_WEBHOOK_URL',
] as const;

const BASE_WEBHOOK_ENVS = [
  'THEOREM_HARNESS_HTTP_URL',
  'THEOREM_HARNESS_URL',
  'THEOREM_PRODUCT_API_URL',
  'THEOREM_API_URL',
  'RUSTYRED_THG_URL',
  'NEXT_PUBLIC_HARNESS_URL',
] as const;

const INSTALL_URL_ENVS = [
  'THEOREM_GITHUB_APP_INSTALL_URL',
  'NEXT_PUBLIC_THEOREM_GITHUB_APP_INSTALL_URL',
  'GITHUB_APP_INSTALL_URL',
] as const;

const PUBLIC_WEBHOOK_URL_ENVS = [
  'THEOREM_GITHUB_WEBHOOK_PUBLIC_URL',
  'NEXT_PUBLIC_THEOREM_GITHUB_WEBHOOK_URL',
] as const;

const GITHUB_HEADER_NAMES = [
  'content-type',
  'user-agent',
  'x-github-delivery',
  'x-github-event',
  'x-github-hook-id',
  'x-github-hook-installation-target-id',
  'x-github-hook-installation-target-type',
  'x-hub-signature',
  'x-hub-signature-256',
] as const;

export type TheoremGithubStatus = {
  ok: true;
  webhook: {
    proxyPath: string;
    publicUrl: string;
    upstreamConfigured: boolean;
  };
  installation: {
    configured: boolean;
    installUrl: string | null;
  };
};

export async function forwardTheoremGithubWebhook(req: Request): Promise<Response> {
  const upstream = resolveTheoremGithubWebhookUpstream(req.url);
  if (!upstream) {
    return json(
      {
        ok: false,
        error: 'theorem_github_webhook_upstream_unconfigured',
        message: 'Configure THEOREM_GITHUB_WEBHOOK_UPSTREAM_URL or THEOREM_HARNESS_URL.',
      },
      503,
    );
  }

  const body = new Uint8Array(await req.arrayBuffer());
  try {
    const upstreamResponse = await fetch(upstream, {
      method: 'POST',
      headers: githubForwardHeaders(req),
      body,
      cache: 'no-store',
    });
    const text = await upstreamResponse.text();
    const contentType = upstreamResponse.headers.get('content-type') ?? 'application/json';
    return new Response(text, {
      status: upstreamResponse.status,
      headers: { 'Content-Type': contentType },
    });
  } catch {
    return json(
      {
        ok: false,
        error: 'theorem_github_webhook_forward_failed',
        message: 'Theorem GitHub webhook upstream could not be reached.',
      },
      502,
    );
  }
}

export function buildTheoremGithubStatus(req: Request): TheoremGithubStatus {
  const installUrl = resolveInstallUrl();
  return {
    ok: true,
    webhook: {
      proxyPath: WEBHOOK_PATH,
      publicUrl: resolvePublicWebhookUrl(req),
      upstreamConfigured: Boolean(resolveTheoremGithubWebhookUpstream(req.url)),
    },
    installation: {
      configured: Boolean(installUrl),
      installUrl,
    },
  };
}

export function resolveTheoremGithubWebhookUpstream(requestUrl?: string): string | undefined {
  const exact = EXACT_WEBHOOK_ENVS.map((name) => normalizeWebhookUrl(process.env[name]));
  const bases = BASE_WEBHOOK_ENVS.map((name) => normalizeWebhookUrl(process.env[name]));
  return unique([...exact, ...bases])
    .filter((candidate): candidate is string => Boolean(candidate))
    .find((candidate) => !isSameProxyRoute(candidate, requestUrl));
}

function githubForwardHeaders(req: Request): Headers {
  const headers = new Headers();
  for (const name of GITHUB_HEADER_NAMES) {
    const value = req.headers.get(name);
    if (value) headers.set(name, value);
  }

  if (!headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }

  const sourceUrl = new URL(req.url);
  headers.set('x-commonplace-webhook-proxy', 'github');
  headers.set('x-forwarded-host', firstHeader(req.headers.get('x-forwarded-host')) ?? req.headers.get('host') ?? sourceUrl.host);
  headers.set('x-forwarded-proto', firstHeader(req.headers.get('x-forwarded-proto')) ?? sourceUrl.protocol.replace(/:$/, ''));
  return headers;
}

function resolvePublicWebhookUrl(req: Request): string {
  for (const name of PUBLIC_WEBHOOK_URL_ENVS) {
    const configured = normalizeWebhookUrl(process.env[name]);
    if (configured) return configured;
  }

  const sourceUrl = new URL(req.url);
  const host = firstHeader(req.headers.get('x-forwarded-host')) ?? firstHeader(req.headers.get('host')) ?? sourceUrl.host;
  const proto = firstHeader(req.headers.get('x-forwarded-proto')) ?? sourceUrl.protocol.replace(/:$/, '');
  return `${proto}://${host}${WEBHOOK_PATH}`;
}

function resolveInstallUrl(): string | null {
  for (const name of INSTALL_URL_ENVS) {
    const url = text(process.env[name]);
    if (url) return url;
  }
  return null;
}

function normalizeWebhookUrl(value: unknown): string | undefined {
  const raw = text(value);
  if (!raw) return undefined;

  try {
    const url = new URL(raw);
    const pathname = trimSlash(url.pathname);
    if (!pathname) {
      url.pathname = WEBHOOK_PATH;
    } else if (pathname.endsWith(WEBHOOK_PATH) || pathname.endsWith('/github/webhooks')) {
      url.pathname = pathname;
    } else {
      const basePath = pathname.replace(/\/(?:graphql|mcp|api\/theorem\/agent|v1\/theorem\/agent\/run)$/i, '');
      url.pathname = `${basePath}${WEBHOOK_PATH}`.replace(/\/{2,}/g, '/');
    }
    url.search = '';
    url.hash = '';
    return trimSlash(url.toString());
  } catch {
    return undefined;
  }
}

function isSameProxyRoute(candidate: string, requestUrl?: string): boolean {
  if (!requestUrl) return false;

  try {
    const candidateUrl = new URL(candidate);
    const rootProxy = new URL(WEBHOOK_PATH, requestUrl);
    const apiProxy = new URL(API_WEBHOOK_PATH, requestUrl);
    const candidatePath = trimSlash(candidateUrl.pathname);
    return (
      candidateUrl.origin === rootProxy.origin &&
      (candidatePath === trimSlash(rootProxy.pathname) || candidatePath === trimSlash(apiProxy.pathname))
    );
  } catch {
    return false;
  }
}

function json(value: unknown, status: number): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function unique(values: Array<string | undefined>): Array<string | undefined> {
  return Array.from(new Set(values));
}

function firstHeader(value: string | null): string | undefined {
  return text(value?.split(',')[0]);
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function trimSlash(value: string): string {
  return value.replace(/\/+$/, '');
}
