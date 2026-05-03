const DEFAULT_INDEX_API_URL = 'https://index-api-production.up.railway.app';

export function getPublicIndexApiBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_INDEX_API_URL ||
    process.env.INDEX_API_URL ||
    DEFAULT_INDEX_API_URL
  ).replace(/\/$/, '');
}

export async function fetchPublicIndexJson<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const baseUrl = getPublicIndexApiBaseUrl();
  const headers = new Headers(init.headers);
  headers.set('Accept', headers.get('Accept') ?? 'application/json');

  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers,
    next: { revalidate: 300 },
  });

  if (!response.ok) {
    throw new Error(`Index API ${path} returned ${response.status}`);
  }

  return response.json() as Promise<T>;
}
