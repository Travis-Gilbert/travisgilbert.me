import { buildTheoremGithubStatus } from '@/lib/theorem-github';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  return new Response(JSON.stringify(buildTheoremGithubStatus(req)), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
