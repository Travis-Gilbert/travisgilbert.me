'use client';

import { useEffect, useRef, useState } from 'react';
import type { FC } from 'react';
import { parseSpec, astToDOM } from '@uwdata/mosaic-spec';
import { initMosaicCoordinator } from '@/lib/theseus/mosaic/coordinator';
import { isMosaicSpec, type MosaicSpec } from '@/lib/theseus/mosaic/specs';

interface MosaicPartProps {
  spec: unknown;
}

/**
 * Inline Mosaic chart rendered inside a chat answer. Takes a Django-
 * emitted MosaicSpec JSON, parses it via @uwdata/mosaic-spec, and mounts
 * the returned DOM element into a parchment-register wrapper.
 *
 * If `spec` is not a valid MosaicSpec shape, renders an honest empty
 * state rather than a fake preview (see CLAUDE.md).
 */
const MosaicPart: FC<MosaicPartProps> = ({ spec }) => {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!isMosaicSpec(spec)) {
      setError('Mosaic spec not recognized.');
      return;
    }
    const typed: MosaicSpec = spec;

    (async () => {
      try {
        await initMosaicCoordinator();
        const ast = parseSpec(typed as unknown as Parameters<typeof parseSpec>[0]);
        const { element } = await astToDOM(ast);
        if (cancelled || !hostRef.current) return;
        hostRef.current.replaceChildren(element);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
      }
    })();

    return () => {
      cancelled = true;
      if (hostRef.current) hostRef.current.replaceChildren();
    };
  }, [spec]);

  if (error) {
    return (
      <div
        className="aui-mosaic-error"
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          color: 'var(--color-ink-muted)',
          padding: '8px 0',
        }}
      >
        Chart unavailable: {error}
      </div>
    );
  }

  return (
    <div
      ref={hostRef}
      className="aui-mosaic-part"
      style={{
        background: 'var(--color-theseus-panel)',
        border: '1px solid var(--color-border)',
        borderRadius: 6,
        padding: '16px 18px',
        boxShadow: 'var(--shadow-warm-sm)',
      }}
    />
  );
};

export default MosaicPart;
