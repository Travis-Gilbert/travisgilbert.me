import { redirect } from 'next/navigation';

/**
 * /connections now lives as the "Connections" tab in Paper Trails (/research).
 * Redirect visitors with old bookmarks.
 */
export default function ConnectionsRedirect() {
  redirect('/research');
}
