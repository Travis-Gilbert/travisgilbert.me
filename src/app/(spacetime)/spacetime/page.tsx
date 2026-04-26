import { Suspense } from 'react';
import SpacetimeApp from '@/components/spacetime/SpacetimeApp';

/**
 * /spacetime: server entry.
 *
 * `<SpacetimeApp />` is a Client Component that uses `useSearchParams`,
 * so it must mount inside a Suspense boundary. The globe canvas touches
 * `window` only inside `useEffect`, which never fires during SSR.
 */
export default function Page() {
  return (
    <Suspense fallback={null}>
      <SpacetimeApp />
    </Suspense>
  );
}
