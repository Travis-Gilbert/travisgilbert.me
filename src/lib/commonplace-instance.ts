export const COMMONPLACE_INSTANCE_STORAGE_KEY = 'commonplace:instance:v1';
export const COMMONPLACE_INSTANCE_URL_HEADER = 'x-commonplace-instance-url';
export const COMMONPLACE_INSTANCE_KEY_HEADER = 'x-commonplace-instance-key';

export type CommonPlaceInstanceMode = 'cloud' | 'self-hosted';

export interface CommonPlaceInstanceSettings {
  mode: CommonPlaceInstanceMode;
  url: string;
  apiKey: string;
}

export interface CommonPlaceInstanceProbeResult {
  ok: boolean;
  message: string;
}

export const DEFAULT_LOCAL_COMMONPLACE_INSTANCE: CommonPlaceInstanceSettings = {
  mode: 'self-hosted',
  url: 'http://127.0.0.1:50090',
  apiKey: 'dev-key',
};

export function readCommonPlaceInstanceSettings(): CommonPlaceInstanceSettings {
  if (typeof window === 'undefined') {
    return { mode: 'cloud', url: '', apiKey: '' };
  }

  try {
    const raw = window.localStorage.getItem(COMMONPLACE_INSTANCE_STORAGE_KEY);
    if (!raw) return { mode: 'cloud', url: '', apiKey: '' };
    const value = JSON.parse(raw) as Partial<CommonPlaceInstanceSettings>;
    if (value.mode !== 'self-hosted') return { mode: 'cloud', url: '', apiKey: '' };
    return {
      mode: 'self-hosted',
      url: text(value.url),
      apiKey: text(value.apiKey),
    };
  } catch {
    return { mode: 'cloud', url: '', apiKey: '' };
  }
}

export function saveCommonPlaceInstanceSettings(settings: CommonPlaceInstanceSettings): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(
    COMMONPLACE_INSTANCE_STORAGE_KEY,
    JSON.stringify({
      mode: settings.mode,
      url: settings.url.trim(),
      apiKey: settings.apiKey.trim(),
    }),
  );
}

export function clearCommonPlaceInstanceSettings(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(COMMONPLACE_INSTANCE_STORAGE_KEY);
}

export function commonPlaceInstanceProxyHeaders(
  settings: CommonPlaceInstanceSettings = readCommonPlaceInstanceSettings(),
): HeadersInit {
  if (settings.mode !== 'self-hosted') return {};
  const url = settings.url.trim();
  const apiKey = settings.apiKey.trim();
  if (!url) return {};
  return {
    [COMMONPLACE_INSTANCE_URL_HEADER]: url,
    ...(apiKey ? { [COMMONPLACE_INSTANCE_KEY_HEADER]: apiKey } : {}),
  };
}

export async function probeCommonPlaceInstance(
  settings: CommonPlaceInstanceSettings,
): Promise<CommonPlaceInstanceProbeResult> {
  const url = settings.url.trim();
  const apiKey = settings.apiKey.trim();
  if (!url) return { ok: false, message: 'Enter a local instance URL.' };

  const response = await fetch('/api/theorem/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...commonPlaceInstanceProxyHeaders({ mode: 'self-hosted', url, apiKey }),
    },
    body: JSON.stringify({ query: 'query CommonPlaceInstanceProbe { __typename }' }),
    cache: 'no-store',
  });
  const body = (await response.json().catch(() => null)) as {
    errors?: Array<{ message?: string }>;
  } | null;

  if (!response.ok) {
    return {
      ok: false,
      message: body?.errors?.[0]?.message ?? `Instance returned HTTP ${response.status}.`,
    };
  }
  if (body?.errors?.length) {
    return {
      ok: false,
      message: body.errors[0]?.message ?? 'Instance rejected the connection.',
    };
  }
  return { ok: true, message: 'Connected to local CommonPlace.' };
}

export function normalizeCommonPlaceGraphqlEndpoint(raw: string): string | null {
  const input = raw.trim();
  if (!input) return null;
  try {
    const url = new URL(input);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    const pathname = trimTrailingSlash(url.pathname);
    url.pathname = pathname.endsWith('/graphql')
      ? pathname
      : `${pathname || ''}/graphql`;
    url.search = '';
    url.hash = '';
    return trimTrailingSlash(url.toString());
  } catch {
    return null;
  }
}

export function isAllowedLocalCommonPlaceHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host === '::1' || host === '0.0.0.0') return true;
  if (host.endsWith('.local')) return true;
  const octets = host.split('.').map((part) => Number.parseInt(part, 10));
  if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part))) return false;
  const [a, b] = octets;
  return (
    a === 10 ||
    a === 127 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}
