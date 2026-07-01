import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { GET } from '@/app/api/theorem/github/status/route';

const STATUS_ENV = [
  'THEOREM_GITHUB_WEBHOOK_UPSTREAM_URL',
  'THEOREM_HARNESS_GITHUB_WEBHOOK_URL',
  'THEOREM_HARNESS_HTTP_URL',
  'THEOREM_HARNESS_URL',
  'THEOREM_PRODUCT_API_URL',
  'THEOREM_API_URL',
  'RUSTYRED_THG_URL',
  'NEXT_PUBLIC_HARNESS_URL',
  'THEOREM_GITHUB_WEBHOOK_PUBLIC_URL',
  'NEXT_PUBLIC_THEOREM_GITHUB_WEBHOOK_URL',
  'THEOREM_GITHUB_APP_INSTALL_URL',
  'NEXT_PUBLIC_THEOREM_GITHUB_APP_INSTALL_URL',
  'GITHUB_APP_INSTALL_URL',
] as const;

describe('GET /api/theorem/github/status', () => {
  const originalEnv = Object.fromEntries(STATUS_ENV.map((name) => [name, process.env[name]]));

  beforeEach(() => {
    for (const name of STATUS_ENV) {
      delete process.env[name];
    }
  });

  afterEach(() => {
    for (const name of STATUS_ENV) {
      restoreEnv(name, originalEnv[name]);
    }
  });

  it('reports configured webhook and install state without exposing the upstream URL', async () => {
    process.env.THEOREM_GITHUB_WEBHOOK_UPSTREAM_URL = 'https://harness.example/github/webhook';
    process.env.THEOREM_GITHUB_WEBHOOK_PUBLIC_URL = 'https://travisgilbert.me/github/webhook';
    process.env.THEOREM_GITHUB_APP_INSTALL_URL = 'https://github.com/apps/theorem/installations/new';

    const response = await GET(statusRequest());
    const payload = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      ok: true,
      webhook: {
        proxyPath: '/github/webhook',
        publicUrl: 'https://travisgilbert.me/github/webhook',
        upstreamConfigured: true,
      },
      installation: {
        configured: true,
        installUrl: 'https://github.com/apps/theorem/installations/new',
      },
    });
    expect(JSON.stringify(payload)).not.toContain('harness.example');
  });

  it('falls back to request host for the public webhook URL', async () => {
    const response = await GET(
      new Request('http://internal.local/api/theorem/github/status', {
        headers: {
          'X-Forwarded-Proto': 'https',
          'X-Forwarded-Host': 'travisgilbert.me',
        },
      }),
    );
    const payload = (await response.json()) as {
      webhook?: { publicUrl?: string; upstreamConfigured?: boolean };
      installation?: { configured?: boolean; installUrl?: string | null };
    };

    expect(response.status).toBe(200);
    expect(payload.webhook?.publicUrl).toBe('https://travisgilbert.me/github/webhook');
    expect(payload.webhook?.upstreamConfigured).toBe(false);
    expect(payload.installation).toEqual({ configured: false, installUrl: null });
  });
});

function statusRequest(): Request {
  return new Request('https://travisgilbert.me/api/theorem/github/status');
}

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
    return;
  }
  process.env[name] = value;
}
