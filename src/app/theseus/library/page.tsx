import { redirect } from 'next/navigation';

/**
 * Redirect stub: preserves old /theseus/library URLs.
 */
export default function LibraryRedirect() {
  redirect('/theseus?view=library');
}
