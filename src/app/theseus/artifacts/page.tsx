import { redirect } from 'next/navigation';

/**
 * Redirect stub: preserves old /theseus/artifacts URLs.
 * Artifacts are now the Library panel within /theseus?view=library.
 */
export default function ArtifactsRedirect() {
  redirect('/theseus?view=library');
}
