'use client';

import { useEffect, useRef } from 'react';
import type { FC } from 'react';
import { parseSpec, astToDOM } from '@uwdata/mosaic-spec';
import { initMosaicCoordinator } from '@/lib/theseus/mosaic/coordinator';

interface MosaicWidgetProps {
  spec: unknown;
}

/**
 * Generic Mosaic spec mount. Used by every intelligence widget that
 * receives a server-authored spec. Rendering failures bubble up as
 * thrown errors so the enclosing error boundary can show the widget's
 * "Unavailable" state without breaking the grid.
 */
const MosaicWidget: FC<MosaicWidgetProps> = ({ spec }) => {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await initMosaicCoordinator();
      const ast = parseSpec(spec as unknown as Parameters<typeof parseSpec>[0]);
      const { element } = await astToDOM(ast);
      if (cancelled || !hostRef.current) return;
      hostRef.current.replaceChildren(element);
    })();
    return () => {
      cancelled = true;
      if (hostRef.current) hostRef.current.replaceChildren();
    };
  }, [spec]);

  return <div ref={hostRef} style={{ width: '100%', height: '100%' }} />;
};

export default MosaicWidget;
