import { redirect } from 'next/navigation';

/**
 * Redirect stub: preserves old /theseus/explorer URLs.
 * The explorer now lives as a panel within /theseus?view=explorer.
 */
export default function ExplorerRedirect() {
  redirect('/theseus?view=explorer');
}
