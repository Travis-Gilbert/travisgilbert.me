import { buildCommonPlaceCodeStatus } from '@/lib/commonplace-code-server';
import { auth } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await auth();
  const isOwner = (session?.user as { isOwner?: boolean } | undefined)?.isOwner === true;
  if (!isOwner) {
    return Response.json(
      { ok: false, error: 'Owner authentication is required for CommonPlace code workspace status.' },
      {
        status: 401,
        headers: { 'Cache-Control': 'no-store' },
      },
    );
  }

  try {
    return Response.json(await buildCommonPlaceCodeStatus(), {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
      {
        status: 500,
        headers: { 'Cache-Control': 'no-store' },
      },
    );
  }
}
