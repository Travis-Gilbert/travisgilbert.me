/**
 * Proxy route: Next.js forwards comment requests to the Django backend.
 *
 * Why proxy instead of calling Django directly from the browser?
 * - The Django RECAPTCHA_SECRET_KEY never leaves the server boundary.
 * - The browser talks only to travisgilbert.me (no CORS complexity).
 * - Future rate-limiting or auth headers can be added here centrally.
 *
 * Set COMMENTS_API_URL in Vercel environment variables (not NEXT_PUBLIC_):
 *   COMMENTS_API_URL=https://your-django-app.railway.app
 */

export const dynamic = 'force-dynamic';

const DJANGO_BASE = process.env.COMMENTS_API_URL ?? '';

function djangoUrl(path: string): string {
  return `${DJANGO_BASE}${path}`;
}

/** GET /api/comments?type=essays&slug=the-sidewalk-tax */
export async function GET(request: Request) {
  if (!DJANGO_BASE) {
    return Response.json({ comments: [] }, { status: 200 });
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type');
  const slug = searchParams.get('slug');

  if (!type || !slug) {
    return Response.json({ error: 'Missing type or slug' }, { status: 400 });
  }

  const res = await fetch(djangoUrl(`/api/comments/?type=${type}&slug=${slug}`), {
    headers: { 'Accept': 'application/json' },
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    return Response.json({ error: 'Upstream error' }, { status: res.status });
  }

  const data = await res.json();
  return Response.json(data);
}

/** POST /api/comments: create a new comment */
export async function POST(request: Request) {
  if (!DJANGO_BASE) {
    return Response.json({ error: 'Comments not configured' }, { status: 503 });
  }

  const body = await request.json();

  const res = await fetch(djangoUrl('/api/comments/'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  return Response.json(data, { status: res.status });
}
