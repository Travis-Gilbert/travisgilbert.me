'use client';

import { useSearchParams } from 'next/navigation';

export default function LensView() {
  const params = useSearchParams();
  const node = params?.get('node');
  if (!node) {
    return <div className="lens-empty">Pick a node to focus the Lens.</div>;
  }
  return <div className="lens-empty">Lens scaffold: focused on node {node}.</div>;
}
