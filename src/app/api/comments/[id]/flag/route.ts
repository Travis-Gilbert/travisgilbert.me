/**
 * POST /api/comments/:id/flag
 * Proxies to Django's flag endpoint. Returns the updated comment.
 */

export const dynamic = 'force-dynamic';

const DJANGO_BASE = process.env.COMMENTS_API_URL ?? '';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(_request: Request, { params }: RouteContext) {
  const { id } = await params;

  if (!DJANGO_BASE) {
    return Response.json({ error: 'Comments not configured' }, { status: 503 });
  }

  const res = await fetch(`${DJANGO_BASE}/api/comments/${id}/flag/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  const data = await res.json();
  return Response.json(data, { status: res.status });
}
