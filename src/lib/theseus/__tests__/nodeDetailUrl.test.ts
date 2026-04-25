import { afterEach, describe, expect, it, vi } from 'vitest';

const ENV_KEY = 'NEXT_PUBLIC_REFLEX_NODE_DETAIL_URL';

async function freshImport() {
  vi.resetModules();
  return await import('../nodeDetailUrl');
}

afterEach(() => {
  delete process.env[ENV_KEY];
  vi.unstubAllGlobals();
});

describe('nodeDetailUrl', () => {
  it('uses the production fallback when the env var is unset', async () => {
    delete process.env[ENV_KEY];
    const { nodeDetailUrl } = await freshImport();
    expect(nodeDetailUrl(42)).toBe('https://node.travisgilbert.me/n/42');
  });

  it('uses the env var when set', async () => {
    process.env[ENV_KEY] = 'http://localhost:3000';
    const { nodeDetailUrl } = await freshImport();
    expect(nodeDetailUrl(7)).toBe('http://localhost:3000/n/7');
  });

  it('trims trailing slashes from the env value', async () => {
    process.env[ENV_KEY] = 'http://localhost:3000/';
    const { nodeDetailUrl } = await freshImport();
    expect(nodeDetailUrl(7)).toBe('http://localhost:3000/n/7');
  });

  it('accepts string pk', async () => {
    delete process.env[ENV_KEY];
    const { nodeDetailUrl } = await freshImport();
    expect(nodeDetailUrl('1234')).toBe('https://node.travisgilbert.me/n/1234');
  });
});

describe('openNodeDetail', () => {
  it('calls window.open with the correct URL and flags', async () => {
    delete process.env[ENV_KEY];
    const open = vi.fn();
    vi.stubGlobal('window', { open });
    const { openNodeDetail } = await freshImport();
    openNodeDetail(99);
    expect(open).toHaveBeenCalledWith(
      'https://node.travisgilbert.me/n/99',
      '_blank',
      'noopener,noreferrer',
    );
  });

  it('is a no op when window is undefined', async () => {
    vi.stubGlobal('window', undefined);
    delete process.env[ENV_KEY];
    const { openNodeDetail } = await freshImport();
    expect(() => openNodeDetail(99)).not.toThrow();
  });
});
