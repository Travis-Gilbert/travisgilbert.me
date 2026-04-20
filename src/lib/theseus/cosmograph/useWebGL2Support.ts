'use client';

import { useEffect, useState } from 'react';

/** Undetermined on the server; resolved synchronously on first client commit. */
export type WebGL2Support = 'unknown' | 'supported' | 'unsupported';

/**
 * Proactive WebGL2 capability probe. cosmos.gl's `Graph` silently fails
 * to initialize on browsers without WebGL2 (the canvas stays blank and
 * the internal luma.gl error propagates through an unhandled promise
 * rejection). Gate the mount upstream so we can render a plain empty
 * state instead of a broken canvas.
 *
 * Starts in `'unknown'` on SSR, resolves on the first client effect
 * tick. Consumers should render the canvas only when
 * `support === 'supported'`.
 */
export function useWebGL2Support(): WebGL2Support {
  const [support, setSupport] = useState<WebGL2Support>('unknown');

  useEffect(() => {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('webgl2');
      setSupport(ctx ? 'supported' : 'unsupported');
    } catch {
      setSupport('unsupported');
    }
  }, []);

  return support;
}
