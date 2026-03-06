'use client';

import { useEffect, useRef } from 'react';
import { mountWealthHealth } from '@/lib/charts/wealthHealth';

export default function WealthHealthChart({
  dataUrl = '/charts/nations.json',
  width = 960,
  height = 560,
}: {
  dataUrl?: string;
  width?: number;
  height?: number;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const cleanup = mountWealthHealth(node, { dataUrl, width, height });
    return () => cleanup();
  }, [dataUrl, height, width]);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        color: '#2A2420',
      }}
    />
  );
}

