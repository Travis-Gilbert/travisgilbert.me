import { NextResponse, type NextRequest } from 'next/server';

const COMMONPLACE_APP_HOSTS = new Set(['app.theoremharness.com']);

const PASSTHROUGH_PREFIXES = [
  '/_next',
  '/api',
  '/commonplace',
  '/favicon',
  '/manifest',
  '/opengraph',
  '/pagefind',
  '/robots',
  '/sitemap',
];

export function middleware(request: NextRequest) {
  const host = request.headers.get('host')?.split(':')[0]?.toLowerCase();
  if (!host || !COMMONPLACE_APP_HOSTS.has(host)) return NextResponse.next();

  const { pathname } = request.nextUrl;
  if (PASSTHROUGH_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  if (pathname === '/') {
    const url = request.nextUrl.clone();
    url.pathname = '/commonplace';
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
