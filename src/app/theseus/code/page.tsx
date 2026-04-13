import { redirect } from 'next/navigation';

/**
 * /theseus/code redirects to /theseus?view=code so the Code Workshop
 * panel renders inside the existing TheseusShell panel system.
 */
export default async function CodeRedirect() {
  redirect('/theseus?view=code');
}
