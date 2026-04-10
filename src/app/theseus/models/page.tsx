import { redirect } from 'next/navigation';

/**
 * Redirect stub: preserves old /theseus/models URLs.
 * Models are now part of the Library panel within /theseus?view=library.
 */
export default function ModelsRedirect() {
  redirect('/theseus?view=library');
}
