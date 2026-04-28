import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import TheseusLanding from '@/components/theseus/landing/TheseusLanding';

// Mobile Shell 2.0 (2026-04-28): /theseus is the public landing.
// Authenticated visitors are sent straight to the workbench at
// /theseus/threads. The old client-only PanelManager mount has moved
// to /theseus/threads/page.tsx. Preserve any ?view= or other deep-link
// params so existing bookmarks (?view=explorer, ?view=plugins) keep
// landing on the right panel after the redirect.
interface TheseusEntryProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function TheseusEntry({ searchParams }: TheseusEntryProps) {
  const session = await auth();
  if (session?.user) {
    const params = await searchParams;
    const qs = new URLSearchParams();
    for (const [key, value] of Object.entries(params ?? {})) {
      if (Array.isArray(value)) {
        for (const v of value) qs.append(key, v);
      } else if (typeof value === 'string') {
        qs.set(key, value);
      }
    }
    const search = qs.toString();
    redirect(`/theseus/threads${search ? `?${search}` : ''}`);
  }
  return <TheseusLanding />;
}
