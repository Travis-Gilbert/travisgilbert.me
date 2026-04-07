import { redirect } from 'next/navigation';

/**
 * The /theseus/ask route used to host the full ask experience. As of
 * 2026-04-07 the experience lives at /theseus directly (see
 * AskExperience component) and this route is a permanent redirect so
 * existing bookmarks, share links, and external integrations
 * continue to work.
 *
 * The query string is preserved in full so /theseus/ask?q=foo lands
 * on /theseus?q=foo and immediately enters THINKING.
 */
export default async function AskRedirect({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; saved?: string }>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();
  if (params.q) query.set('q', params.q);
  if (params.saved) query.set('saved', params.saved);
  const qs = query.toString();
  redirect(qs ? `/theseus?${qs}` : '/theseus');
}
